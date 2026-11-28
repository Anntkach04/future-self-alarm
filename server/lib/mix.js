const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findBedFile, findSoundFile, listBeds, BEDS_DIR } = require('./beds');

/** Apple custom alarm / notification sound must be <30s. Keep MP3 = CAF. */
const WAKE_MAX_SECONDS = 28;

function getFfmpegPath() {
  try {
    return require('ffmpeg-static');
  } catch {
    return null;
  }
}

function runFfmpeg(args) {
  const ffmpegPath = getFfmpegPath();
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg-static is not installed'));
      return;
    }
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(stderr.slice(-800) || `ffmpeg exited ${code}`));
    });
  });
}

/** ffmpeg -i prints duration on stderr and exits non-zero without an output file. */
function probeDurationSec(filePath) {
  const ffmpegPath = getFfmpegPath();
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg-static is not installed'));
      return;
    }
    const child = spawn(ffmpegPath, ['-i', filePath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!match) {
        reject(new Error('Could not read audio duration'));
        return;
      }
      const sec =
        Number(match[1]) * 3600 + Number(match[2]) * 60 + parseFloat(match[3]);
      resolve(sec);
    });
  });
}

/** Hard cap — Instant Clone uploads must stay small. */
const CLONE_MAX_SECONDS = 90;
const CLONE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Clone samples keep full quality: 44.1 kHz / 128 kbps mono is ~1 MB a
 * minute, far under the cap. (They used to be cut to 22 kHz at 48-64 kbps,
 * which dulled the voice the clone learned from.)
 */
const CLONE_RATE = '44100';
const CLONE_BITRATE = '128k';

/**
 * Before cloning: cut handling thumps and rumble below 70 Hz, then bring
 * the take to a normal speech level. ElevenLabs copies the sample's level,
 * so a quiet take made a quiet clone that later had to be boosted ~20 dB,
 * noise and all. Duration and timing are unchanged.
 */
const CLONE_FILTER = 'highpass=f=70,highpass=f=70,loudnorm=I=-20:TP=-2:LRA=11';

function cloneSampleFromFile(filePath, name) {
  return {
    buffer: fs.readFileSync(filePath),
    originalname: name,
    mimetype: 'audio/mpeg',
  };
}

/** Mono MP3 well under ElevenLabs' 11MB upload cap (iOS persist is often huge PCM). */
async function transcodeCloneMp3(inPath, outPath, opts = {}) {
  const maxSeconds = opts.maxSeconds ?? CLONE_MAX_SECONDS;
  const bitrate = opts.bitrate ?? CLONE_BITRATE;
  const rate = opts.rate ?? CLONE_RATE;
  const extra = [];
  if (opts.start != null) extra.push('-ss', Number(opts.start).toFixed(2));
  extra.push('-t', Number(opts.duration ?? maxSeconds).toFixed(2));
  await runFfmpeg([
    '-y',
    ...extra,
    '-i',
    inPath,
    '-af',
    CLONE_FILTER,
    '-ac',
    '1',
    '-ar',
    rate,
    '-c:a',
    'libmp3lame',
    '-b:a',
    bitrate,
    outPath,
  ]);
}

async function compressWholeTake(inPath, stamp) {
  const outPath = path.join(os.tmpdir(), `fs-clone-full-${stamp}.mp3`);
  // Always cap length + bitrate so clone never fails with "too large".
  await transcodeCloneMp3(inPath, outPath, {
    maxSeconds: CLONE_MAX_SECONDS,
  });
  let sample = cloneSampleFromFile(outPath, 'sample.mp3');
  if (sample.buffer.length > CLONE_MAX_BYTES) {
    await transcodeCloneMp3(inPath, outPath, {
      bitrate: '32k',
      rate: '16000',
      maxSeconds: 75,
    });
    sample = cloneSampleFromFile(outPath, 'sample.mp3');
  }
  if (sample.buffer.length > CLONE_MAX_BYTES) {
    await transcodeCloneMp3(inPath, outPath, {
      bitrate: '24k',
      rate: '16000',
      maxSeconds: 60,
    });
    sample = cloneSampleFromFile(outPath, 'sample.mp3');
  }
  return { sample, outPath };
}

/**
 * Hybrid IVC (fast + better + cheap, no PVC):
 * one user take → compressed clips for ElevenLabs Instant Clone.
 * Always transcode — never upload raw iOS CAF/PCM (hits the 11MB cap).
 */
async function buildHybridCloneSamples(buffer, originalname, mimetype) {
  const fallback = [
    {
      buffer,
      originalname: originalname || 'sample.m4a',
      mimetype: mimetype || 'audio/m4a',
    },
  ];
  if (!getFfmpegPath() || !buffer?.length) return fallback;

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ext = String(originalname || 'sample.m4a').split('.').pop() || 'm4a';
  const inPath = path.join(os.tmpdir(), `fs-clone-in-${stamp}.${ext}`);
  fs.writeFileSync(inPath, buffer);

  const outPaths = [];
  try {
    const compressed = await compressWholeTake(inPath, stamp);
    outPaths.push(compressed.outPath);
    if (compressed.sample.buffer.length > CLONE_MAX_BYTES) {
      throw new Error('Compressed clone sample still exceeds 11MB');
    }

    let duration = 0;
    try {
      duration = await probeDurationSec(compressed.outPath);
    } catch {
      duration = 0;
    }

    // Too short → single compressed file.
    if (!(duration >= 42)) {
      console.log(
        `[clone] single IVC: ${(compressed.sample.buffer.length / 1024).toFixed(0)}KB from ${duration.toFixed(1)}s take`
      );
      return [compressed.sample];
    }

    const windows =
      duration >= 75
        ? [
            [0, Math.min(duration * 0.42, duration)],
            [duration * 0.28, Math.min(duration * 0.72, duration)],
            [duration * 0.55, duration],
          ]
        : [
            [0, Math.min(duration * 0.58, duration)],
            [duration * 0.38, duration],
          ];

    const samples = [];
    for (let i = 0; i < windows.length; i += 1) {
      const [start, end] = windows[i];
      const len = Math.max(0.8, end - start);
      const outPath = path.join(os.tmpdir(), `fs-clone-part-${stamp}-${i}.mp3`);
      outPaths.push(outPath);
      await transcodeCloneMp3(inPath, outPath, {
        start,
        duration: len,
      });
      samples.push(cloneSampleFromFile(outPath, `sample-${i + 1}.mp3`));
    }

    const total = samples.reduce((sum, row) => sum + row.buffer.length, 0);
    if (!samples.length || total > CLONE_MAX_BYTES) {
      console.log('[clone] hybrid too large, using single compressed take');
      return [compressed.sample];
    }

    console.log(
      `[clone] hybrid IVC: ${samples.length} clips, ${(total / 1024).toFixed(0)}KB from ${duration.toFixed(1)}s take`
    );
    return samples;
  } catch (error) {
    console.warn('[clone] compress/split failed', error?.message || error);
    // Last resort: force a tiny mono clip so clone never hard-fails on size.
    try {
      const emergency = path.join(os.tmpdir(), `fs-clone-em-${stamp}.mp3`);
      outPaths.push(emergency);
      await transcodeCloneMp3(inPath, emergency, {
        bitrate: '24k',
        rate: '16000',
        maxSeconds: 45,
      });
      return [cloneSampleFromFile(emergency, 'sample.mp3')];
    } catch {
      if (buffer.length <= CLONE_MAX_BYTES) return fallback;
      const tooBig = new Error(
        'Could not process this recording. Tap re-record and try again.'
      );
      tooBig.status = 400;
      throw tooBig;
    }
  } finally {
    for (const file of [inPath, ...outPaths]) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Voice-message-from-a-phone color (picked by ear, A/B tested):
 * muffled (HP 300 / LP 3.5 kHz, 12 dB/oct, filtered again after the
 * saturation so it never gets harsh), ~5 dB of 3:1 compression, audible
 * soft-clip roughness on vowels. Input is normalized to -18 LUFS first; the
 * chain lands at about -31, +7 dB puts the voice at about -24 LUFS.
 */
const PHONE_VOICE_CHAIN = [
  'aformat=sample_fmts=fltp:channel_layouts=mono:sample_rates=44100',
  'highpass=f=300:poles=2',
  'acompressor=threshold=-21dB:ratio=3:attack=10:release=100:makeup=1',
  'volume=9dB',
  'asoftclip=type=tanh:oversample=4',
  'volume=-6dB',
  'highpass=f=300:poles=2',
  'lowpass=f=3500:poles=2',
  'lowpass=f=3500:poles=2',
  'volume=7dB',
].join(',');

/**
 * Very quiet 1–5 kHz hiss, ~30 dB under the voice, gated by the voice so it
 * only breathes while speaking and fades out in pauses. PHONE_NOISE=off
 * keeps only the roughness.
 */
function phoneNoiseOn() {
  return process.env.PHONE_NOISE !== 'off';
}

/**
 * Even, phone-friendly loudness. Raw ElevenLabs audio arrives around -37 LUFS,
 * which played back almost inaudibly on the preview screen. Duration and
 * timing are unchanged (word timestamps stay valid).
 */
/**
 * Quick check of a voice take before cloning. Rejects only takes that cannot
 * make a good clone: nearly silent, or background noise almost as loud as
 * the voice. Quiet-but-clean takes pass (they are levelled before cloning).
 */
const TAKE_MIN_LUFS = -55;
const TAKE_MIN_SNR_DB = 10;

async function assessCloneTake(buffer, ext = 'm4a') {
  if (!getFfmpegPath() || !buffer?.length) return { ok: true };
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inPath = path.join(os.tmpdir(), `fs-take-${stamp}.${ext}`);
  fs.writeFileSync(inPath, buffer);
  try {
    const lufs = await measureLufs(inPath);
    let rms = null;
    let noise = null;
    try {
      const stderr = await runFfmpeg([
        '-hide_banner',
        '-nostats',
        '-i',
        inPath,
        '-af',
        'highpass=f=70,astats=measure_overall=RMS_level+Noise_floor:measure_perchannel=0',
        '-f',
        'null',
        '-',
      ]);
      const num = (label) => {
        const m = stderr.match(new RegExp(`${label}:\\s*(-?[0-9.]+|-inf)`));
        return m && m[1] !== '-inf' ? Number(m[1]) : null;
      };
      rms = num('RMS level dB');
      noise = num('Noise floor dB');
    } catch {
      // measuring is best effort
    }
    const snrDb = rms != null && noise != null ? rms - noise : null;
    console.log(
      `[clone] take level ${lufs?.toFixed(1) ?? '?'} LUFS, voice-to-noise ${snrDb?.toFixed(1) ?? '?'} dB`
    );
    const silent = (lufs == null && rms != null && rms < -60) || (rms != null && rms < -65);
    if (silent || (lufs != null && lufs < TAKE_MIN_LUFS)) {
      return { ok: false, reason: 'sample_too_quiet', lufs, snrDb };
    }
    if (snrDb != null && snrDb < TAKE_MIN_SNR_DB) {
      return { ok: false, reason: 'sample_too_noisy', lufs, snrDb };
    }
    return { ok: true, lufs, snrDb };
  } finally {
    try {
      fs.unlinkSync(inPath);
    } catch {
      // ignore
    }
  }
}

/** Most a quiet clip may be raised. More than this lifts the noise baked into
 * clones made from quiet takes until it is clearly audible. */
const MAX_LOUDNESS_GAIN_DB = 12;

/** Integrated loudness (LUFS) of a file, or null if it can't be measured. */
async function measureLufs(filePath) {
  try {
    const stderr = await runFfmpeg([
      '-hide_banner',
      '-nostats',
      '-i',
      filePath,
      '-af',
      'loudnorm=print_format=json',
      '-f',
      'null',
      '-',
    ]);
    const json = stderr.slice(stderr.lastIndexOf('{'));
    const value = Number(JSON.parse(json).input_i);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function normalizeLoudness(buffer, targetLufs = -16) {
  if (!getFfmpegPath()) return buffer;
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inPath = path.join(os.tmpdir(), `fs-ln-in-${stamp}.mp3`);
  const outPath = path.join(os.tmpdir(), `fs-ln-out-${stamp}.mp3`);
  fs.writeFileSync(inPath, buffer);
  try {
    const inputLufs = await measureLufs(inPath);
    const target =
      inputLufs == null
        ? targetLufs
        : Math.min(targetLufs, inputLufs + MAX_LOUDNESS_GAIN_DB);
    await runFfmpeg([
      '-y',
      '-i',
      inPath,
      '-af',
      `loudnorm=I=${target.toFixed(1)}:TP=-1.5:LRA=11`,
      '-ar',
      '44100',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      outPath,
    ]);
    return fs.readFileSync(outPath);
  } catch (error) {
    console.warn('[mix] loudness normalize failed', error?.message || error);
    return buffer;
  } finally {
    for (const f of [inPath, outPath]) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Voice + chosen music (bedId, 'none' = no music) + chosen nature sound
 * (levels.soundId, 'none' = no sound).
 */
async function mixVoiceWithBed(voiceBuffer, bedId, levels = {}) {
  if (!getFfmpegPath()) {
    return { buffer: voiceBuffer, mixed: false, reason: 'no_ffmpeg' };
  }

  // Client-supplied levels are untrusted: clamp to 0–1 (huge values clip).
  const unit = (v, fallback) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
  const voiceUi = unit(levels.voiceLevel, 0.85);
  const bedUi = unit(levels.bedLevel, 0.35);
  // Default level = unity; the slider only trims a few dB either way.
  const voiceGain = (0.7 + voiceUi * 0.35).toFixed(3);
  // Quiet calm pad under the call (x1.26: the new voice sits ~2 dB louder).
  const bedVol = ((0.025 + bedUi * 0.06) * 1.26).toFixed(3);
  const bedFile = findBedFile(bedId);
  // Optional: drop assets/beds/morning-birds.(mp3|m4a) in and every wake
  // message gets soft birdsong under the voice.
  const birdsFile = findSoundFile(levels.soundId);
  // Bed file is normalized to -26 LUFS; ~0.39 at the default level puts the
  // birds about 22 dB under the voice, fading in over 5 s: present, never competing.
  const birdsVol = ((0.15 + bedUi * 0.3) * 1.26).toFixed(3);

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const voicePath = path.join(os.tmpdir(), `fs-voice-${stamp}.mp3`);
  const normPath = path.join(os.tmpdir(), `fs-norm-${stamp}.wav`);
  const coloredPath = path.join(os.tmpdir(), `fs-phone-${stamp}.mp3`);
  const outPath = path.join(os.tmpdir(), `fs-mix-${stamp}.mp3`);

  fs.writeFileSync(voicePath, voiceBuffer);

  try {
    // Pass 0: even loudness in (TTS level varies), so the chain behaves the
    // same on every message. Separate pass: loudnorm-in-graph broke anoisesrc.
    await runFfmpeg([
      '-y',
      '-i',
      voicePath,
      '-af',
      'aformat=sample_fmts=fltp:channel_layouts=mono:sample_rates=44100,loudnorm=I=-18:TP=-2:LRA=11',
      '-ar',
      '44100',
      normPath,
    ]);

    // Pass 1: phone color (+ voice-gated hiss), wake length, fade-out.
    // Pad to the full wake length so birds + music play on after the last
    // word and fade out together (they used to stop dead with the voice).
    const fade = `apad=whole_dur=${WAKE_MAX_SECONDS},afade=t=out:st=${WAKE_MAX_SECONDS - 3}:d=3`;
    const graph = phoneNoiseOn()
      ? [
          `[0:a]${PHONE_VOICE_CHAIN},volume=${voiceGain}[pv]`,
          '[pv]asplit=2[v][key]',
          `anoisesrc=color=white:amplitude=0.00625:sample_rate=44100:duration=${WAKE_MAX_SECONDS + 2},highpass=f=1000:poles=2,lowpass=f=5000:poles=2[n]`,
          '[n][key]sidechaingate=threshold=0.02:ratio=10:attack=20:release=300:range=0.001[ng]',
          `[v][ng]amix=inputs=2:normalize=0:duration=first,${fade}[out]`,
        ].join(';')
      : `[0:a]${PHONE_VOICE_CHAIN},volume=${voiceGain},${fade}[out]`;
    await runFfmpeg([
      '-y',
      '-i',
      normPath,
      '-filter_complex',
      graph,
      '-map',
      '[out]',
      '-t',
      String(WAKE_MAX_SECONDS),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      coloredPath,
    ]);

    // No hiss / crackle pass any more: the voice goes straight to the bed.
    fs.copyFileSync(coloredPath, outPath);

    if (!bedFile && !birdsFile) {
      return {
        buffer: await normalizeLoudness(fs.readFileSync(outPath), -18),
        mixed: true,
        reason: 'phone',
        bedFile: null,
        bedId: null,
      };
    }

    const withBedPath = path.join(os.tmpdir(), `fs-bed-${stamp}.mp3`);
    // Inputs: 0 = voice, then music and/or sound, each looped under it.
    const layers = [];
    const inputs = [];
    let idx = 1;
    if (bedFile) {
      inputs.push('-stream_loop', '-1', '-i', bedFile);
      layers.push(
        `[${idx}:a]aformat=sample_fmts=fltp:channel_layouts=mono,volume=${bedVol},highpass=f=180,lowpass=f=3800,afade=t=in:d=3[bed]`
      );
      idx += 1;
    }
    if (birdsFile) {
      inputs.push('-stream_loop', '-1', '-i', birdsFile);
      layers.push(
        `[${idx}:a]aformat=sample_fmts=fltp:channel_layouts=mono,volume=${birdsVol},highpass=f=300,lowpass=f=9000,afade=t=in:d=5[birds]`
      );
    }
    const labels = `[phone]${bedFile ? '[bed]' : ''}${birdsFile ? '[birds]' : ''}`;
    await runFfmpeg([
      '-y',
      '-fflags',
      '+genpts',
      '-i',
      outPath,
      ...inputs,
      '-filter_complex',
      [
        '[0:a]aformat=sample_fmts=fltp:channel_layouts=mono[phone]',
        ...layers,
        `${labels}amix=inputs=${1 + layers.length}:duration=first:dropout_transition=2:normalize=0,alimiter=limit=0.95[out]`,
      ].join(';'),
      '-map',
      '[out]',
      '-t',
      String(WAKE_MAX_SECONDS),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      withBedPath,
    ]);
    const buffer = await normalizeLoudness(fs.readFileSync(withBedPath), -18);
    try {
      fs.unlinkSync(withBedPath);
    } catch {
      // ignore
    }
    return {
      buffer,
      mixed: true,
      reason: ['phone', bedFile && 'bed', birdsFile && 'sound'].filter(Boolean).join('+'),
      bedFile: bedFile ? path.basename(bedFile) : null,
      bedId: bedFile ? path.basename(bedFile, path.extname(bedFile)) : null,
      soundFile: birdsFile ? path.basename(birdsFile) : null,
    };
  } finally {
    for (const file of [voicePath, normPath, coloredPath, outPath]) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore cleanup
      }
    }
  }
}

/**
 * Convert MP3 to a short CAF for iOS notification / AlarmKit custom sounds (≤30s).
 * Must use Apple IMA ADPCM (`ima4`) — same as bundled fs_fallback.caf.
 * Linear PCM CAF often schedules OK but plays the *system default* instead.
 */
async function mp3BufferToAlarmCaf(inputBuffer, maxSeconds = WAKE_MAX_SECONDS) {
  if (!getFfmpegPath()) {
    const error = new Error('ffmpeg-static is not installed');
    error.status = 500;
    throw error;
  }
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inPath = path.join(os.tmpdir(), `fs-in-${stamp}.mp3`);
  const pcmPath = path.join(os.tmpdir(), `fs-pcm-${stamp}.caf`);
  const outPath = path.join(os.tmpdir(), `fs-alarm-${stamp}.caf`);
  fs.writeFileSync(inPath, inputBuffer);
  try {
    const cap = Math.min(30, Math.max(5, Number(maxSeconds) || WAKE_MAX_SECONDS));
    let contentSec = cap;
    try {
      contentSec = Math.min(cap, await probeDurationSec(inPath));
    } catch {
      // keep cap
    }
    // Fade out near end of speech, then pad with silence to `cap` so AlarmKit’s
    // OS re-loop has a quiet gap instead of slamming the same words again.
    const fadeStart = Math.max(1, contentSec - 1.15).toFixed(2);
    await runFfmpeg([
      '-y',
      '-i',
      inPath,
      '-t',
      String(cap),
      '-ac',
      '1',
      '-ar',
      '22050',
      '-af',
      `volume=1.2,alimiter=limit=0.98,afade=t=out:st=${fadeStart}:d=1.05,apad=whole_dur=${cap}`,
      '-c:a',
      'pcm_s16le',
      pcmPath,
    ]);
    // Pass B — Apple ima4 CAF (what AlarmKit / UNNotificationSound actually play).
    await runFfmpeg([
      '-y',
      '-i',
      pcmPath,
      '-ac',
      '1',
      '-ar',
      '22050',
      '-c:a',
      'adpcm_ima_qt',
      '-f',
      'caf',
      outPath,
    ]);
    return {
      buffer: fs.readFileSync(outPath),
      mimeType: 'audio/x-caf',
      maxSeconds: cap,
    };
  } finally {
    for (const file of [inPath, pcmPath, outPath]) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Strip room hiss / fan / AC from a clone sample or TTS take.
 * Keeps speech; cuts low rumble + broadband noise.
 */
async function denoiseVoiceBuffer(inputBuffer, ext = 'm4a') {
  if (!getFfmpegPath() || !inputBuffer?.length) {
    return inputBuffer;
  }
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const safeExt = String(ext || 'm4a').replace(/^\./, '').slice(0, 8) || 'm4a';
  const inPath = path.join(os.tmpdir(), `fs-denoise-in-${stamp}.${safeExt}`);
  const outPath = path.join(os.tmpdir(), `fs-denoise-out-${stamp}.mp3`);
  fs.writeFileSync(inPath, inputBuffer);
  try {
    await runFfmpeg([
      '-y',
      '-i',
      inPath,
      '-ac',
      '1',
      '-ar',
      '44100',
      '-af',
      [
        'highpass=f=90',
        'afftdn=nf=-25:nr=12:nt=w',
        'agate=threshold=0.02:ratio=2:attack=10:release=120',
        'loudnorm=I=-16:TP=-1.5:LRA=11',
      ].join(','),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      outPath,
    ]);
    return fs.readFileSync(outPath);
  } catch (error) {
    console.warn('[denoise] ffmpeg failed, using original', error?.message || error);
    return inputBuffer;
  } finally {
    for (const file of [inPath, outPath]) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * The person's own voice note first, a short breath, then Future You.
 * Both are levelled so the note is as loud as the generated voice.
 */
async function prependVoiceNote(voiceBuffer, noteBuffer, noteExt = 'm4a') {
  if (!getFfmpegPath() || !noteBuffer?.length) return voiceBuffer;
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const notePath = path.join(os.tmpdir(), `fs-note-${stamp}.${noteExt}`);
  const voicePath = path.join(os.tmpdir(), `fs-note-voice-${stamp}.mp3`);
  const outPath = path.join(os.tmpdir(), `fs-note-out-${stamp}.mp3`);
  fs.writeFileSync(notePath, noteBuffer);
  fs.writeFileSync(voicePath, voiceBuffer);
  try {
    await runFfmpeg([
      '-y',
      '-t',
      String(VOICE_NOTE_MAX_SECONDS),
      '-i',
      notePath,
      '-i',
      voicePath,
      '-filter_complex',
      [
        '[0:a]aformat=sample_fmts=fltp:channel_layouts=mono:sample_rates=44100,highpass=f=70,loudnorm=I=-18:TP=-2:LRA=11,apad=pad_dur=0.6[n]',
        '[1:a]aformat=sample_fmts=fltp:channel_layouts=mono:sample_rates=44100[v]',
        '[n][v]concat=n=2:v=0:a=1[out]',
      ].join(';'),
      '-map',
      '[out]',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      outPath,
    ]);
    return fs.readFileSync(outPath);
  } catch (error) {
    console.warn('[mix] voice note prepend failed', error?.message || error);
    return voiceBuffer;
  } finally {
    for (const f of [notePath, voicePath, outPath]) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

/** A voice note longer than this is cut, so the whole ring fits in 28 s. */
const VOICE_NOTE_MAX_SECONDS = 10;

module.exports = {
  prependVoiceNote,
  VOICE_NOTE_MAX_SECONDS,
  normalizeLoudness,
  measureLufs,
  assessCloneTake,
  mixVoiceWithBed,
  mp3BufferToAlarmCaf,
  denoiseVoiceBuffer,
  buildHybridCloneSamples,
  findBedFile,
  getFfmpegPath,
  listBeds,
  BEDS_DIR,
};

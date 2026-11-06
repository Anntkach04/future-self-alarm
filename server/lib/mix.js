const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findBedFile, listBeds, BEDS_DIR } = require('./beds');

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
  const bitrate = opts.bitrate ?? '64k';
  const rate = opts.rate ?? '22050';
  const extra = [];
  if (opts.start != null) extra.push('-ss', Number(opts.start).toFixed(2));
  extra.push('-t', Number(opts.duration ?? maxSeconds).toFixed(2));
  await runFfmpeg([
    '-y',
    ...extra,
    '-i',
    inPath,
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
    bitrate: '48k',
    rate: '22050',
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
        bitrate: '64k',
        rate: '22050',
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
 * Vintage telephone / old landline — narrow, muffled, grainy; words stay clear.
 * No loudnorm in-graph (breaks anoisesrc). No reverb/echo. Pitch/speed unchanged.
 */
function phoneVoiceAf(volumeExpr) {
  return [
    'aformat=sample_fmts=fltp:channel_layouts=mono',
    `volume=${volumeExpr}`,
    'highpass=f=300',
    'lowpass=f=3000',
    // Midrange boost +3 dB around 1500 Hz
    'equalizer=f=1500:t=q:w=1.2:g=3',
    // Compression 4:1
    'acompressor=threshold=-18dB:ratio=4:attack=6:release=55:makeup=2.5',
    // Soft saturation ~8% (gentle tanh drive, not crushed)
    'asoftclip=type=tanh:threshold=0.88',
    'alimiter=limit=0.94',
  ].join(',');
}

/**
 * Continuous white hiss (~−38 dB) + sparse crackles for unstable analog line.
 * Hiss stays audible in pauses (amix duration=first / longest hiss).
 */
function phoneHissMixGraph(durationSec = WAKE_MAX_SECONDS) {
  const d = Math.max(5, Number(durationSec) || WAKE_MAX_SECONDS).toFixed(2);
  // −38 dB ≈ amplitude 0.0126 on anoisesrc
  const hissAmp = (10 ** (-38 / 20)).toFixed(4);
  return [
    '[0:a]aformat=sample_fmts=fltp:channel_layouts=mono,volume=1.0[voice]',
    [
      `anoisesrc=color=white:amplitude=${hissAmp}:duration=${d}:sample_rate=44100`,
      'aformat=sample_fmts=fltp:channel_layouts=mono',
      'highpass=f=300',
      'lowpass=f=3000',
      'volume=1.0',
    ].join(',') + '[hiss]',
    [
      // Occasional crackles / interference — quiet, band-limited pops
      `anoisesrc=color=white:amplitude=0.045:duration=${d}:sample_rate=44100`,
      'aformat=sample_fmts=fltp:channel_layouts=mono',
      'highpass=f=1200',
      'lowpass=f=4500',
      // Gate-ish: mostly quiet, tiny bursts (volume low overall)
      'volume=0.07',
      'apulsator=mode=sine:hz=0.35:amount=0.85',
    ].join(',') + '[crackle]',
    '[voice][hiss][crackle]amix=inputs=3:duration=longest:dropout_transition=0:normalize=0,aformat=channel_layouts=mono,alimiter=limit=0.95,atrim=0:' +
      d +
      '[phone]',
  ].join(';');
}

async function mixVoiceWithBed(voiceBuffer, bedId, levels = {}) {
  if (!getFfmpegPath()) {
    return { buffer: voiceBuffer, mixed: false, reason: 'no_ffmpeg' };
  }

  const voiceUi =
    typeof levels.voiceLevel === 'number' ? levels.voiceLevel : 0.85;
  const bedUi = typeof levels.bedLevel === 'number' ? levels.bedLevel : 0.35;
  const voiceVol = (0.9 + voiceUi * 1.1).toFixed(2);
  // Quiet calm pad under the call — never spa/bali-loud
  const bedVol = (0.025 + bedUi * 0.06).toFixed(3);
  const bedFile = findBedFile(bedId);

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const voicePath = path.join(os.tmpdir(), `fs-voice-${stamp}.mp3`);
  const coloredPath = path.join(os.tmpdir(), `fs-phone-${stamp}.mp3`);
  const outPath = path.join(os.tmpdir(), `fs-mix-${stamp}.mp3`);

  fs.writeFileSync(voicePath, voiceBuffer);

  try {
    // Pass 1 — tinny handset (separate file; loudnorm-in-graph was empty output).
    await runFfmpeg([
      '-y',
      '-i',
      voicePath,
      '-af',
      `${phoneVoiceAf(voiceVol)},afade=t=out:st=${WAKE_MAX_SECONDS - 2}:d=2`,
      '-t',
      String(WAKE_MAX_SECONDS),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      coloredPath,
    ]);

    // Pass 2 — landline hiss + crackles (never re-normalize after this).
    await runFfmpeg([
      '-y',
      '-i',
      coloredPath,
      '-filter_complex',
      phoneHissMixGraph(WAKE_MAX_SECONDS),
      '-map',
      '[phone]',
      '-t',
      String(WAKE_MAX_SECONDS),
      '-ac',
      '1',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      outPath,
    ]);

    if (!bedFile) {
      return {
        buffer: fs.readFileSync(outPath),
        mixed: true,
        reason: 'nokia_hiss',
        bedFile: null,
        bedId: null,
      };
    }

    const withBedPath = path.join(os.tmpdir(), `fs-bed-${stamp}.mp3`);
    await runFfmpeg([
      '-y',
      '-fflags',
      '+genpts',
      '-i',
      outPath,
      '-i',
      bedFile,
      '-filter_complex',
      [
        '[0:a]aformat=sample_fmts=fltp:channel_layouts=mono[phone]',
        `[1:a]aformat=sample_fmts=fltp:channel_layouts=mono,volume=${bedVol},highpass=f=180,lowpass=f=3800,afade=t=in:d=3[bed]`,
        '[phone][bed]amix=inputs=2:duration=first:dropout_transition=2:normalize=0,alimiter=limit=0.95[out]',
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
    const buffer = fs.readFileSync(withBedPath);
    try {
      fs.unlinkSync(withBedPath);
    } catch {
      // ignore
    }
    return {
      buffer,
      mixed: true,
      reason: 'nokia_hiss+bed',
      bedFile: path.basename(bedFile),
      bedId: path.basename(bedFile, '.mp3'),
    };
  } finally {
    for (const file of [voicePath, coloredPath, outPath]) {
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

module.exports = {
  mixVoiceWithBed,
  mp3BufferToAlarmCaf,
  denoiseVoiceBuffer,
  buildHybridCloneSamples,
  findBedFile,
  getFfmpegPath,
  listBeds,
  BEDS_DIR,
};

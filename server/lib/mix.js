const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findBedFile, listBeds, BEDS_DIR } = require('./beds');

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
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-800) || `ffmpeg exited ${code}`));
    });
  });
}

async function mixVoiceWithBed(voiceBuffer, bedId) {
  const bedFile = findBedFile(bedId);
  if (!bedFile) {
    return { buffer: voiceBuffer, mixed: false, reason: 'no_bed' };
  }
  if (!getFfmpegPath()) {
    return { buffer: voiceBuffer, mixed: false, reason: 'no_ffmpeg' };
  }

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const voicePath = path.join(os.tmpdir(), `fs-voice-${stamp}.mp3`);
  const outPath = path.join(os.tmpdir(), `fs-mix-${stamp}.mp3`);

  fs.writeFileSync(voicePath, voiceBuffer);

  try {
    await runFfmpeg([
      '-y',
      '-fflags',
      '+genpts',
      '-i',
      voicePath,
      '-i',
      bedFile,
      '-filter_complex',
      [
        // Beds are longer than the spoken line — trim to voice. Avoid
        // -stream_loop on m4a (ffmpeg emits bogus negative timestamps).
        // Soft bed under clear voice — original balance users liked.
        '[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo,volume=1.55,acompressor=threshold=-18dB:ratio=3:attack=5:release=50[voice]',
        '[1:a]aformat=sample_fmts=fltp:channel_layouts=stereo,volume=0.06,highpass=f=120,lowpass=f=4200,afade=t=in:d=3[bed]',
        '[voice][bed]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[mix]',
        '[mix]loudnorm=I=-12:TP=-1.2:LRA=8,areverse,afade=t=in:d=2.5,areverse[out]',
      ].join(';'),
      '-map',
      '[out]',
      '-t',
      '45',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      outPath,
    ]);

    return {
      buffer: fs.readFileSync(outPath),
      mixed: true,
      bedFile: path.basename(bedFile),
      bedId: path.basename(bedFile, '.mp3'),
    };
  } finally {
    for (const file of [voicePath, outPath]) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore cleanup
      }
    }
  }
}

/**
 * Convert MP3 (or other ffmpeg-readable audio) to a short linear PCM CAF
 * suitable for iOS notification / AlarmKit custom sounds (≤30s).
 */
async function mp3BufferToAlarmCaf(inputBuffer, maxSeconds = 28) {
  if (!getFfmpegPath()) {
    const error = new Error('ffmpeg-static is not installed');
    error.status = 500;
    throw error;
  }
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inPath = path.join(os.tmpdir(), `fs-in-${stamp}.mp3`);
  const outPath = path.join(os.tmpdir(), `fs-alarm-${stamp}.caf`);
  fs.writeFileSync(inPath, inputBuffer);
  try {
    // Loud wake cut: normalize hot for notification playback (ringer volume
    // still applies, but a quiet file stays quiet even at max ringer).
    await runFfmpeg([
      '-y',
      '-i',
      inPath,
      '-t',
      String(maxSeconds),
      '-ac',
      '1',
      '-ar',
      '22050',
      '-af',
      [
        'loudnorm=I=-9:TP=-1:LRA=7',
        'volume=2.2',
        'alimiter=limit=0.97:level=disabled',
      ].join(','),
      // IMA ADPCM in CAF — Apple’s preferred custom alert format
      '-c:a',
      'adpcm_ima_qt',
      outPath,
    ]);
    return {
      buffer: fs.readFileSync(outPath),
      mimeType: 'audio/x-caf',
      maxSeconds,
    };
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
  findBedFile,
  getFfmpegPath,
  listBeds,
  BEDS_DIR,
};

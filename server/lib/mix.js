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
      '-i',
      voicePath,
      '-stream_loop',
      '-1',
      '-i',
      bedFile,
      '-filter_complex',
      [
        '[1:a]volume=0.08,highpass=f=120,lowpass=f=4200,afade=t=in:d=3[bed]',
        '[0:a]volume=1.0[voice]',
        '[bed][voice]amix=inputs=2:duration=first:dropout_transition=2[mix]',
        '[mix]areverse,afade=t=in:d=2.5,areverse[out]',
      ].join(';'),
      '-map',
      '[out]',
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

module.exports = {
  mixVoiceWithBed,
  findBedFile,
  getFfmpegPath,
  listBeds,
  BEDS_DIR,
};

const FormData = require('form-data');
const fetch = require('node-fetch');
const { buildHybridCloneSamples } = require('./mix');

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

/**
 * What makes TTS sound “AI” on Instant Voice Clones:
 * - style > 0 → character/performance, not you
 * - stability too low → random weird gaps / pitch jumps
 * - stability too high → flat announcer
 * - donor STS → someone else’s cadence glued onto your timbre (uncanny)
 * - stage directions / audio tags → acted, not lived
 *
 * Fix: speak DIRECTLY with the user’s IVC, mid stability, style 0,
 * plain conversational text, multilingual_v2 (best clone likeness).
 */
function realisticVoiceSettings() {
  const stability = Number(process.env.ELEVENLABS_STABILITY ?? 0.5);
  const similarity = Number(process.env.ELEVENLABS_SIMILARITY ?? 0.8);
  const style = Number(process.env.ELEVENLABS_STYLE ?? 0);
  const speed = Number(process.env.ELEVENLABS_SPEED ?? 1);
  return {
    stability: clamp01(stability),
    similarity_boost: clamp01(similarity),
    style: clamp01(style),
    use_speaker_boost: process.env.ELEVENLABS_SPEAKER_BOOST !== 'false',
    speed: Math.min(1.15, Math.max(0.8, speed)),
  };
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function getElevenKey() {
  return process.env.ELEVENLABS_API_KEY || '';
}

function defaultTtsModel() {
  // Strongest identity match for Instant Voice Clones.
  return process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';
}

function defaultOutputFormat() {
  return process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_192';
}

/** STS is opt-in only — default OFF (it often sounds expressive but not “you”). */
function stsEnabled() {
  return process.env.ELEVENLABS_STS === 'true';
}

function stsModel() {
  return process.env.ELEVENLABS_STS_MODEL || 'eleven_multilingual_sts_v2';
}

function prosodyDonorVoiceId() {
  return process.env.ELEVENLABS_PROSODY_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
}

async function cloneVoice({ buffer, originalname, mimetype, name, files }) {
  const apiKey = getElevenKey();
  if (!apiKey) {
    const error = new Error(
      'Missing ELEVENLABS_API_KEY. Add it to .env in the project root.'
    );
    error.status = 500;
    throw error;
  }

  let samples = Array.isArray(files) && files.length ? files : null;
  if (!samples?.length) {
    if (!buffer?.length) {
      const error = new Error('Audio sample is required');
      error.status = 400;
      throw error;
    }
    // Hybrid: one take → multi-clip Instant Clone (better likeness, still cheap/fast).
    samples = await buildHybridCloneSamples(buffer, originalname, mimetype);
  }

  const form = new FormData();
  form.append('name', String(name || 'Future Self').slice(0, 80));
  form.append(
    'description',
    [
      'This is my real voice talking to myself in the morning.',
      'Keep my exact accent, mouth shape, breath, and uneven pacing.',
      'Sound intimate and close — never like a podcast host, audiobook, or AI assistant.',
    ].join(' ')
  );
  form.append('remove_background_noise', 'false');
  for (const sample of samples) {
    form.append('files', sample.buffer, {
      filename: sample.originalname || 'sample.m4a',
      contentType: sample.mimetype || 'audio/m4a',
    });
  }

  const response = await fetch(`${ELEVEN_BASE}/voices/add`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      ...form.getHeaders(),
    },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      data?.detail || data?.message || 'Voice clone failed'
    );
    error.status = response.status;
    error.details = data;
    throw error;
  }

  const voiceId = data.voice_id;
  if (voiceId) {
    await applyVoiceSettings(voiceId).catch(() => undefined);
  }

  return {
    voiceId,
    requiresVerification: data.requires_verification,
    sampleCount: samples.length,
  };
}

async function applyVoiceSettings(voiceId) {
  const apiKey = getElevenKey();
  if (!apiKey || !voiceId) return;
  await fetch(`${ELEVEN_BASE}/voices/${voiceId}/settings/edit`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(realisticVoiceSettings()),
  });
}

async function ttsRequest({ voiceId, text, model, voiceSettings }) {
  const apiKey = getElevenKey();
  const body = {
    text: text.slice(0, 2500),
    model_id: model,
    voice_settings: voiceSettings || realisticVoiceSettings(),
    apply_text_normalization: 'auto',
  };
  if (/multilingual_v2|turbo_v2_5|flash_v2_5|eleven_v3|eleven_multilingual/.test(model)) {
    body.language_code = process.env.ELEVENLABS_LANGUAGE || 'en';
  }

  const formats = [defaultOutputFormat(), 'mp3_44100_128'];
  let lastError;

  for (const outputFormat of formats) {
    const response = await fetch(
      `${ELEVEN_BASE}/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify(body),
      }
    );

    if (response.ok) {
      const buffer = await response.buffer();
      return {
        mimeType: 'audio/mpeg',
        buffer,
        base64: buffer.toString('base64'),
      };
    }

    const errText = await response.text();
    let details;
    try {
      details = JSON.parse(errText);
    } catch {
      details = errText;
    }
    lastError = { status: response.status, details };
    const detailStr = JSON.stringify(details).toLowerCase();
    const formatIssue =
      response.status === 400 ||
      response.status === 402 ||
      /output_format|bitrate|tier|subscription|creator/.test(detailStr);
    if (!formatIssue) break;
  }

  const error = new Error('TTS failed');
  error.status = lastError?.status || 500;
  error.details = lastError?.details;
  throw error;
}

async function speechToSpeech({ voiceId, audioBuffer, filename = 'prosody.mp3' }) {
  const apiKey = getElevenKey();
  const formats = [defaultOutputFormat(), 'mp3_44100_128'];
  let lastError;

  for (const outputFormat of formats) {
    const form = new FormData();
    form.append('audio', audioBuffer, {
      filename,
      contentType: 'audio/mpeg',
    });
    form.append('model_id', stsModel());
    form.append('remove_background_noise', 'false');
    form.append('voice_settings', JSON.stringify(realisticVoiceSettings()));

    const response = await fetch(
      `${ELEVEN_BASE}/speech-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          ...form.getHeaders(),
          Accept: 'audio/mpeg',
        },
        body: form,
      }
    );

    if (response.ok) {
      const buffer = await response.buffer();
      return {
        mimeType: 'audio/mpeg',
        buffer,
        base64: buffer.toString('base64'),
      };
    }

    const errText = await response.text();
    let details;
    try {
      details = JSON.parse(errText);
    } catch {
      details = errText;
    }
    lastError = { status: response.status, details };
    const detailStr = JSON.stringify(details).toLowerCase();
    const formatIssue =
      response.status === 400 ||
      response.status === 402 ||
      /output_format|bitrate|tier|subscription|creator/.test(detailStr);
    if (!formatIssue) break;
  }

  const error = new Error('Speech-to-speech failed');
  error.status = lastError?.status || 500;
  error.details = lastError?.details;
  throw error;
}

/**
 * Default path: plain IVC TTS (sounds most like the person).
 * Optional STS only if ELEVENLABS_STS=true.
 */
async function synthesizeSpeech({ voiceId, text, modelId }) {
  const apiKey = getElevenKey();
  if (!apiKey) {
    const error = new Error(
      'Missing ELEVENLABS_API_KEY. Add it to .env in the project root.'
    );
    error.status = 500;
    throw error;
  }
  if (!voiceId || !text) {
    const error = new Error('voiceId and text are required');
    error.status = 400;
    throw error;
  }

  const spoken = prepareSpokenText(text);

  if (stsEnabled() && !modelId) {
    try {
      const donorAudio = await ttsRequest({
        voiceId: prosodyDonorVoiceId(),
        text: spoken,
        model: 'eleven_multilingual_v2',
        voiceSettings: realisticVoiceSettings(),
      });
      return await speechToSpeech({
        voiceId,
        audioBuffer: donorAudio.buffer,
      });
    } catch (stsErr) {
      console.warn('[tts] STS failed, direct IVC:', stsErr?.message || stsErr);
    }
  }

  return ttsRequest({
    voiceId,
    text: spoken,
    model: modelId || defaultTtsModel(),
    voiceSettings: realisticVoiceSettings(),
  });
}

/**
 * Keep speech human: normal punctuation, no theatrical “…”, no audio tags.
 */
function prepareSpokenText(text) {
  return String(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\[[^\]]+\]/g, '') // strip any leftover stage tags
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s*—\s*/g, ' — ')
    .replace(/\s*\.\.\.\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  cloneVoice,
  synthesizeSpeech,
  getElevenKey,
  realisticVoiceSettings,
  defaultTtsModel,
};

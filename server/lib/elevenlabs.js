const FormData = require('form-data');
const fetch = require('node-fetch');

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

/**
 * Instant Voice Clone settings — mid stability + moderate similarity
 * (too-high similarity = glassy/robotic; too-low = identity drift).
 */
function realisticVoiceSettings() {
  const stability = Number(process.env.ELEVENLABS_STABILITY ?? 0.38);
  const similarity = Number(process.env.ELEVENLABS_SIMILARITY ?? 0.72);
  const style = Number(process.env.ELEVENLABS_STYLE ?? 0.18);
  const speed = Number(process.env.ELEVENLABS_SPEED ?? 0.9);
  return {
    stability: clamp01(stability),
    similarity_boost: clamp01(similarity),
    style: clamp01(style),
    use_speaker_boost: true,
    speed: Math.min(1.15, Math.max(0.75, speed)),
  };
}

/** Expressive first-pass (prosody donor) — more emotion before STS into the clone. */
function expressiveDonorSettings() {
  return {
    stability: clamp01(Number(process.env.ELEVENLABS_DONOR_STABILITY ?? 0.28)),
    similarity_boost: clamp01(
      Number(process.env.ELEVENLABS_DONOR_SIMILARITY ?? 0.65)
    ),
    style: clamp01(Number(process.env.ELEVENLABS_DONOR_STYLE ?? 0.45)),
    use_speaker_boost: true,
    speed: Math.min(1.1, Math.max(0.8, Number(process.env.ELEVENLABS_DONOR_SPEED ?? 0.88))),
  };
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function getElevenKey() {
  return process.env.ELEVENLABS_API_KEY || '';
}

/** Direct TTS model on the clone (fallback). */
function defaultTtsModel() {
  return process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';
}

/** Expressive donor TTS before voice-changer. */
function donorTtsModel() {
  return process.env.ELEVENLABS_DONOR_MODEL || 'eleven_v3';
}

function stsModel() {
  return process.env.ELEVENLABS_STS_MODEL || 'eleven_multilingual_sts_v2';
}

/**
 * Temporary prosody carrier only — never the product voice.
 * Final audio is always the user's Instant Voice Clone via STS.
 */
function prosodyDonorVoiceId() {
  return (
    process.env.ELEVENLABS_PROSODY_VOICE_ID ||
    // Rachel — warm, clear English; used only as intermediate performance.
    '21m00Tcm4TlvDq8ikWAM'
  );
}

function defaultOutputFormat() {
  return process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_192';
}

function stsEnabled() {
  return process.env.ELEVENLABS_STS !== 'false';
}

async function cloneVoice({ buffer, originalname, mimetype, name }) {
  const apiKey = getElevenKey();
  if (!apiKey) {
    const error = new Error(
      'Missing ELEVENLABS_API_KEY. Add it to .env in the project root.'
    );
    error.status = 500;
    throw error;
  }

  const form = new FormData();
  form.append('name', String(name || 'Future Self').slice(0, 80));
  form.append(
    'description',
    'My real speaking voice in the morning — soft, close, slightly sleepy, natural pauses. Not a narrator, podcast host, or character. Match my accent and rhythm exactly.'
  );
  // Cleaner sample → less “synthetic” artifacts baked into the IVC.
  form.append(
    'remove_background_noise',
    process.env.ELEVENLABS_CLONE_DENOISE === 'false' ? 'false' : 'true'
  );
  form.append('files', buffer, {
    filename: originalname || 'sample.m4a',
    contentType: mimetype || 'audio/m4a',
  });

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
  };
}

async function applyVoiceSettings(voiceId) {
  const apiKey = getElevenKey();
  if (!apiKey || !voiceId) return;
  const settings = realisticVoiceSettings();
  await fetch(`${ELEVEN_BASE}/voices/${voiceId}/settings/edit`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
}

async function ttsRequest({ voiceId, text, model, voiceSettings }) {
  const apiKey = getElevenKey();
  const body = {
    text: text.slice(0, 2500),
    model_id: model,
    voice_settings: voiceSettings,
    apply_text_normalization: 'auto',
  };
  if (/flash_v2_5|turbo_v2_5|multilingual_v2|eleven_v3|eleven_multilingual|eleven_english/.test(model)) {
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
        outputFormat,
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
 * Max-natural pipeline for Instant Voice Clones:
 * 1) Expressive TTS on a temporary donor (prosody only)
 * 2) Voice Changer (STS) into the user's clone → product voice is always IVC
 * Falls back to direct TTS on the clone if STS/v3 unavailable.
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
      const donorId = prosodyDonorVoiceId();
      const tagged = prepareExpressiveText(spoken);
      let donorAudio;
      try {
        donorAudio = await ttsRequest({
          voiceId: donorId,
          text: tagged,
          model: donorTtsModel(),
          voiceSettings: expressiveDonorSettings(),
        });
      } catch (v3Err) {
        console.warn(
          '[tts] donor v3 failed, multilingual donor:',
          v3Err?.message || v3Err
        );
        donorAudio = await ttsRequest({
          voiceId: donorId,
          text: spoken,
          model: 'eleven_multilingual_v2',
          voiceSettings: expressiveDonorSettings(),
        });
      }

      const converted = await speechToSpeech({
        voiceId,
        audioBuffer: donorAudio.buffer,
      });
      console.log('[tts] STS pipeline ok → user Instant Voice Clone');
      return converted;
    } catch (stsErr) {
      console.warn(
        '[tts] STS pipeline failed, direct clone TTS:',
        stsErr?.message || stsErr
      );
    }
  }

  return ttsRequest({
    voiceId,
    text: spoken,
    model: modelId || defaultTtsModel(),
    voiceSettings: realisticVoiceSettings(),
  });
}

/** Strip emoji; keep paragraph pauses. */
function prepareSpokenText(text) {
  return String(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '... ')
    .replace(/\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Soft delivery hints for eleven_v3 (ignored harmlessly by v2 if ever passed). */
function prepareExpressiveText(text) {
  const clean = prepareSpokenText(text);
  if (/^\s*\[/.test(clean)) return clean;
  return `[softly] [warmly] ${clean}`;
}

module.exports = {
  cloneVoice,
  synthesizeSpeech,
  getElevenKey,
  realisticVoiceSettings,
  defaultTtsModel,
};

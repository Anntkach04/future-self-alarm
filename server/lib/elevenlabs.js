const FormData = require('form-data');
const fetch = require('node-fetch');

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

/** Shared defaults — Instant Voice Clone likeness (less “TTS announcer”). */
function realisticVoiceSettings() {
  // multilingual_v2 + mid stability reads closer to the real sample than turbo.
  const stability = Number(process.env.ELEVENLABS_STABILITY ?? 0.48);
  const similarity = Number(process.env.ELEVENLABS_SIMILARITY ?? 0.78);
  const style = Number(process.env.ELEVENLABS_STYLE ?? 0);
  const speed = Number(process.env.ELEVENLABS_SPEED ?? 0.92);
  return {
    stability: clamp01(stability),
    similarity_boost: clamp01(similarity),
    // Style exaggeration = performative / AI. Keep off for clones.
    style: clamp01(style),
    use_speaker_boost: true,
    speed: Math.min(1.15, Math.max(0.75, speed)),
  };
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function getElevenKey() {
  return process.env.ELEVENLABS_API_KEY || '';
}

/**
 * Best likeness for Instant Voice Cloning (less robotic than turbo).
 * Override with ELEVENLABS_TTS_MODEL if needed.
 */
function defaultTtsModel() {
  return process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';
}

function defaultOutputFormat() {
  // 192 kbps needs Creator+; we fall back to 128 if the API rejects it.
  return process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_192';
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
    'Natural everyday speaking voice. Match my real accent, pacing, and tone exactly. Soft morning talk, not a character or narrator.'
  );
  // Keep sample texture; heavy denoise can shift accent/timbre.
  form.append('remove_background_noise', 'false');
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
  // Persist likeness settings on the voice so every generation stays close.
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

  const model = modelId || defaultTtsModel();
  const spoken = prepareSpokenText(text);
  const body = {
    text: spoken.slice(0, 2500),
    model_id: model,
    voice_settings: realisticVoiceSettings(),
    // Prefer natural reading of numbers / soft pauses.
    apply_text_normalization: 'auto',
  };
  // Pin English so clones don’t invent a foreign accent on Latin script.
  if (/flash_v2_5|turbo_v2_5|multilingual_v2|eleven_v3|eleven_multilingual/.test(model)) {
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
    // Only fall back on format / plan limits; otherwise stop.
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

/** Strip emoji; keep paragraph pauses so it doesn’t sound like one run-on. */
function prepareSpokenText(text) {
  return String(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '... ')
    .replace(/\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

module.exports = {
  cloneVoice,
  synthesizeSpeech,
  getElevenKey,
  realisticVoiceSettings,
  defaultTtsModel,
};

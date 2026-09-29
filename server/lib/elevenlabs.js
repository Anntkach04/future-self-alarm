const FormData = require('form-data');
const fetch = require('node-fetch');
const { denoiseVoiceBuffer } = require('./mix');

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

/**
 * Instant Voice Clone settings — keep similarity moderate so sample hiss
 * is not baked into every generation.
 */
function realisticVoiceSettings() {
  const stability = Number(process.env.ELEVENLABS_STABILITY ?? 0.4);
  const similarity = Number(process.env.ELEVENLABS_SIMILARITY ?? 0.65);
  const style = Number(process.env.ELEVENLABS_STYLE ?? 0.15);
  const speed = Number(process.env.ELEVENLABS_SPEED ?? 0.9);
  return {
    stability: clamp01(stability),
    similarity_boost: clamp01(similarity),
    style: clamp01(style),
    use_speaker_boost: process.env.ELEVENLABS_SPEAKER_BOOST === 'true',
    speed: Math.min(1.15, Math.max(0.75, speed)),
  };
}

/** Expressive first-pass — wide emotion range before STS into the clone. */
function expressiveDonorSettings() {
  return {
    // Low stability = real ups/downs (chuckle → calm), not flat TTS.
    stability: clamp01(Number(process.env.ELEVENLABS_DONOR_STABILITY ?? 0.18)),
    similarity_boost: clamp01(
      Number(process.env.ELEVENLABS_DONOR_SIMILARITY ?? 0.55)
    ),
    style: clamp01(Number(process.env.ELEVENLABS_DONOR_STYLE ?? 0.72)),
    use_speaker_boost: true,
    speed: Math.min(1.1, Math.max(0.8, Number(process.env.ELEVENLABS_DONOR_SPEED ?? 0.9))),
  };
}

/** Final clone pass — allow a bit of the donor’s emotion through. */
function expressiveCloneSettings() {
  return {
    stability: clamp01(Number(process.env.ELEVENLABS_STABILITY ?? 0.32)),
    similarity_boost: clamp01(Number(process.env.ELEVENLABS_SIMILARITY ?? 0.62)),
    style: clamp01(Number(process.env.ELEVENLABS_STYLE ?? 0.28)),
    use_speaker_boost: process.env.ELEVENLABS_SPEAKER_BOOST === 'true',
    speed: Math.min(1.15, Math.max(0.75, Number(process.env.ELEVENLABS_SPEED ?? 0.9))),
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

  // 1) ElevenLabs Voice Isolator (speech only) → 2) ffmpeg denoise as safety net
  let clean = buffer;
  let cleanName = originalname || 'sample.m4a';
  let cleanMime = mimetype || 'audio/m4a';
  try {
    const isolated = await isolateSpeech(buffer, cleanName, cleanMime);
    clean = isolated.buffer;
    cleanName = isolated.filename;
    cleanMime = isolated.mimeType;
    console.log('[clone] audio-isolation ok');
  } catch (err) {
    console.warn('[clone] audio-isolation skipped:', err?.message || err);
  }
  try {
    const ext = cleanName.includes('.') ? cleanName.split('.').pop() : 'm4a';
    clean = await denoiseVoiceBuffer(clean, ext);
    cleanName = 'sample-clean.mp3';
    cleanMime = 'audio/mpeg';
    console.log('[clone] ffmpeg denoise ok');
  } catch (err) {
    console.warn('[clone] ffmpeg denoise skipped:', err?.message || err);
  }

  const form = new FormData();
  form.append('name', String(name || 'Future Self').slice(0, 80));
  form.append(
    'description',
    'My real speaking voice in the morning — soft, close, slightly sleepy, natural pauses. Not a narrator, podcast host, or character. Match my accent and rhythm exactly. Clean speech only — no room noise or hiss.'
  );
  // Isolator already ran; still ask IVC to strip residual noise.
  form.append('remove_background_noise', 'true');
  form.append('files', clean, {
    filename: cleanName,
    contentType: cleanMime,
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

/** ElevenLabs Voice Isolator — keeps speech, drops background. */
async function isolateSpeech(buffer, filename = 'sample.m4a', mimeType = 'audio/m4a') {
  const apiKey = getElevenKey();
  const form = new FormData();
  form.append('audio', buffer, {
    filename,
    contentType: mimeType,
  });
  const response = await fetch(`${ELEVEN_BASE}/audio-isolation`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      ...form.getHeaders(),
      Accept: 'audio/mpeg',
    },
    body: form,
  });
  if (!response.ok) {
    const errText = await response.text();
    const error = new Error(`audio-isolation failed (${response.status})`);
    error.status = response.status;
    error.details = errText.slice(0, 400);
    throw error;
  }
  const out = await response.buffer();
  if (!out.length) {
    throw new Error('audio-isolation returned empty audio');
  }
  return {
    buffer: out,
    filename: 'sample-isolated.mp3',
    mimeType: 'audio/mpeg',
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
    form.append('remove_background_noise', 'true');
    form.append('voice_settings', JSON.stringify(expressiveCloneSettings()));

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
      // Tag from original paragraphs so mood can shift beat-by-beat.
      const tagged = prepareExpressiveText(text);
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
          text: prepareExpressiveText(text, { stripUnknownTags: true }),
          model: 'eleven_multilingual_v2',
          voiceSettings: expressiveDonorSettings(),
        });
      }

      const converted = await speechToSpeech({
        voiceId,
        audioBuffer: donorAudio.buffer,
      });
      console.log('[tts] STS pipeline ok → user Instant Voice Clone');
      try {
        const cleaned = await denoiseVoiceBuffer(converted.buffer, 'mp3');
        return {
          mimeType: 'audio/mpeg',
          buffer: cleaned,
          base64: cleaned.toString('base64'),
        };
      } catch {
        return converted;
      }
    } catch (stsErr) {
      console.warn(
        '[tts] STS pipeline failed, direct clone TTS:',
        stsErr?.message || stsErr
      );
    }
  }

  const direct = await ttsRequest({
    voiceId,
    text: prepareExpressiveText(text, { stripUnknownTags: true }),
    model: modelId || defaultTtsModel(),
    voiceSettings: expressiveCloneSettings(),
  });
  try {
    const cleaned = await denoiseVoiceBuffer(direct.buffer, 'mp3');
    return {
      mimeType: 'audio/mpeg',
      buffer: cleaned,
      base64: cleaned.toString('base64'),
    };
  } catch {
    return direct;
  }
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

/**
 * Beat-by-beat delivery for eleven_v3 (and lighter cues for v2).
 * Calm → soft smile/chuckle → gentle push — like a real morning talk.
 */
function prepareExpressiveText(text, opts = {}) {
  const moods = [
    '[softly] [warmly]',
    '[gentle] [calm]',
    '[chuckles] [smiles] [encouraging]',
    '[happily] [warmly]',
  ];
  const plainMoods = [
    '',
    '',
    '(with a little smile) ',
    '(warmer, lighter) ',
  ];

  const parts = String(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);

  if (!parts.length) return prepareSpokenText(text);

  const lines = parts.map((part, i) => {
    if (opts.stripUnknownTags) {
      return `${plainMoods[i % plainMoods.length]}${part}`;
    }
    return `${moods[i % moods.length]} ${part}`;
  });

  return lines.join(' ... ');
}

module.exports = {
  cloneVoice,
  synthesizeSpeech,
  getElevenKey,
  realisticVoiceSettings,
  defaultTtsModel,
};

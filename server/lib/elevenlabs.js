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
  // ElevenLabs defaults that sound least “cheap AI” on Instant Clones:
  // stability ~0.5, similarity ~0.75, style 0. Too-low stability = weird;
  // too-high similarity = locked / synthetic. Speaker boost can add sheen.
  // Slightly lower stability = natural pace shifts / soft imperfections;
  // style 0 keeps it from sounding performed.
  const stability = Number(process.env.ELEVENLABS_STABILITY ?? 0.42);
  const similarity = Number(process.env.ELEVENLABS_SIMILARITY ?? 0.72);
  const style = Number(process.env.ELEVENLABS_STYLE ?? 0);
  const speed = Number(process.env.ELEVENLABS_SPEED ?? 1);
  return {
    stability: clamp01(stability),
    similarity_boost: clamp01(similarity),
    style: clamp01(style), // keep 0 — style>0 = performed / AI
    use_speaker_boost: process.env.ELEVENLABS_SPEAKER_BOOST === 'true',
    speed: Math.min(1.05, Math.max(0.85, speed)),
  };
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function getElevenKey() {
  return process.env.ELEVENLABS_API_KEY || '';
}

function elevenErrorMessage(data, fallback = 'Voice clone failed') {
  const walk = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value.message === 'string') return value.message;
    if (value.detail) return walk(value.detail);
    if (Array.isArray(value) && value[0]) return walk(value[0]);
    return '';
  };
  return walk(data) || fallback;
}

function defaultTtsModel() {
  // Newest quality model when the account has it; override via .env.
  return process.env.ELEVENLABS_TTS_MODEL || 'eleven_v4';
}

/** Ordered fallbacks if the primary model rejects / is unavailable. */
function ttsModelCandidates(preferred) {
  const primary = preferred || defaultTtsModel();
  const rest = [
    'eleven_v4',
    'eleven_multilingual_v2',
    'eleven_v3',
    'eleven_turbo_v2_5',
  ].filter((id) => id !== primary);
  return [primary, ...rest];
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

/** prod | dev — keeps Railway clones apart from local experiments in the EL UI. */
function appDeployEnv() {
  const forced = (process.env.ELEVENLABS_VOICE_ENV || '').trim().toLowerCase();
  if (forced === 'prod' || forced === 'production') return 'prod';
  if (forced === 'dev' || forced === 'development') return 'dev';
  return process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
}

/**
 * Visible name in ElevenLabs Voices list.
 * Example: `FS prod · Anna · a1b2c3d4`
 */
function buildCloneVoiceName(name, userId) {
  const display = String(name || 'User').trim().slice(0, 36) || 'User';
  const id = String(userId || '').trim();
  const short =
    (id.replace(/^(local_|guest_|apple_)/, '').slice(-8) || 'anon').replace(
      /[^a-zA-Z0-9_-]/g,
      ''
    ) || 'anon';
  return `FS ${appDeployEnv()} · ${display} · ${short}`.slice(0, 80);
}

function buildCloneVoiceDescription(userId) {
  return [
    `Future Self Alarm (${appDeployEnv()})`,
    userId ? `user=${userId}` : null,
    'Morning IVC — keep accent, breath, mouth noise, uneven pacing.',
    'Never polished, never podcast, never audiobook, never AI assistant.',
  ]
    .filter(Boolean)
    .join(' | ');
}

/** In-memory cache so we do not list/create the collection on every clone. */
let cachedVoiceCollectionId = null;

function voiceCollectionTitle() {
  const base = (
    process.env.ELEVENLABS_VOICE_COLLECTION_TITLE || 'Future Self Alarm'
  ).trim();
  return `${base} · ${appDeployEnv()}`;
}

/**
 * Resolve (or create) the Voice Collection that holds app clones.
 * ElevenLabs has no separate “environment” for IVC — collections are the folder UI.
 */
async function ensureAppVoiceCollectionId(apiKey) {
  const pinned = (process.env.ELEVENLABS_VOICE_COLLECTION_ID || '').trim();
  if (pinned) return pinned;
  if (cachedVoiceCollectionId) return cachedVoiceCollectionId;

  const title = voiceCollectionTitle();
  const listRes = await fetch(`${ELEVEN_BASE}/voices/collections`, {
    headers: { 'xi-api-key': apiKey },
  });
  if (listRes.ok) {
    const listData = await listRes.json().catch(() => ({}));
    const collections = Array.isArray(listData?.collections)
      ? listData.collections
      : [];
    const match = collections.find(
      (c) => String(c?.title || '').trim() === title
    );
    if (match?.collection_id) {
      cachedVoiceCollectionId = String(match.collection_id);
      return cachedVoiceCollectionId;
    }
  }

  const icons = ['folder', '🎤', 'alarm'];
  for (const icon of icons) {
    const createRes = await fetch(`${ELEVEN_BASE}/voices/collections`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, icon }),
    });
    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      console.warn(
        `[elevenlabs] create voice collection (${icon}) failed (${createRes.status}):`,
        text.slice(0, 200)
      );
      continue;
    }
    const created = await createRes.json().catch(() => ({}));
    if (created?.collection_id) {
      cachedVoiceCollectionId = String(created.collection_id);
      return cachedVoiceCollectionId;
    }
  }
  return null;
}

async function addVoiceToAppCollection(apiKey, voiceId) {
  const collectionId = await ensureAppVoiceCollectionId(apiKey);
  if (!collectionId || !voiceId) return null;
  const res = await fetch(
    `${ELEVEN_BASE}/voices/collections/${encodeURIComponent(collectionId)}/voice/${encodeURIComponent(voiceId)}`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
    }
  );
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => '');
    console.warn(
      `[elevenlabs] add voice to collection failed (${res.status}):`,
      text.slice(0, 200)
    );
    return null;
  }
  return collectionId;
}

async function cloneVoice({
  buffer,
  originalname,
  mimetype,
  name,
  files,
  userId,
}) {
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

  const voiceName = buildCloneVoiceName(name, userId);
  const form = new FormData();
  form.append('name', voiceName);
  form.append('description', buildCloneVoiceDescription(userId));
  // Documented label keys — use_case tags app clones in the Voices UI.
  form.append(
    'labels',
    JSON.stringify({
      use_case: 'future_self_alarm',
      language: process.env.ELEVENLABS_LANGUAGE || 'en',
    })
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
    const error = new Error(elevenErrorMessage(data, 'Voice clone failed'));
    error.status = response.status;
    error.details = data;
    throw error;
  }

  const voiceId = data.voice_id;
  let collectionId = null;
  if (voiceId) {
    await applyVoiceSettings(voiceId).catch(() => undefined);
    collectionId = await addVoiceToAppCollection(apiKey, voiceId).catch(
      (err) => {
        console.warn(
          '[elevenlabs] collection attach skipped',
          err?.message || err
        );
        return null;
      }
    );
  }

  return {
    voiceId,
    requiresVerification: data.requires_verification,
    sampleCount: samples.length,
    voiceName,
    collectionId,
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
  const models = model ? [model] : ttsModelCandidates();
  const formats = [defaultOutputFormat(), 'mp3_44100_128'];
  let lastError;

  for (const modelId of models) {
    const body = {
      text: text.slice(0, 2500),
      model_id: modelId,
      voice_settings: voiceSettings || realisticVoiceSettings(),
      apply_text_normalization: 'auto',
    };
    if (
      /multilingual_v2|turbo_v2_5|flash_v2_5|eleven_v3|eleven_v4|eleven_multilingual/.test(
        modelId
      )
    ) {
      body.language_code = process.env.ELEVENLABS_LANGUAGE || 'en';
    }

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
        if (modelId !== models[0]) {
          console.log(`[tts] fell back to model ${modelId}`);
        }
        return {
          mimeType: 'audio/mpeg',
          buffer,
          base64: buffer.toString('base64'),
          modelId,
        };
      }

      const errText = await response.text();
      let details;
      try {
        details = JSON.parse(errText);
      } catch {
        details = errText;
      }
      lastError = { status: response.status, details, modelId };
      const detailStr = JSON.stringify(details).toLowerCase();
      const formatIssue =
        response.status === 400 ||
        response.status === 402 ||
        /output_format|bitrate|tier|subscription|creator/.test(detailStr);
      // Bad model / not allowed → try next model.
      const modelIssue =
        response.status === 400 ||
        response.status === 404 ||
        response.status === 422 ||
        /model|not found|not available|access|permission/.test(detailStr);
      if (formatIssue && !/model/.test(detailStr)) {
        // try next bitrate with same model
        continue;
      }
      if (modelIssue) break; // next model
      if (!formatIssue) break;
    }
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
/**
 * Turn EL character alignment into word timings for karaoke highlight.
 */
function wordsFromAlignment(alignment) {
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends)) {
    return [];
  }
  const words = [];
  let buf = '';
  let start = null;
  let end = 0;
  const flush = () => {
    const text = buf.trim();
    if (text && start != null) {
      words.push({ text, start, end });
    }
    buf = '';
    start = null;
  };
  for (let i = 0; i < chars.length; i += 1) {
    const ch = String(chars[i] ?? '');
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (start == null) start = Number(starts[i]) || 0;
    buf += ch;
    end = Number(ends[i]) || end;
  }
  flush();
  return words;
}

async function ttsWithTimestamps({ voiceId, text, modelId }) {
  const apiKey = getElevenKey();
  const spoken = prepareSpokenText(text);
  const models = modelId ? [modelId] : ttsModelCandidates();
  let lastError;

  for (const model of models) {
    const body = {
      text: spoken.slice(0, 2500),
      model_id: model,
      voice_settings: realisticVoiceSettings(),
      apply_text_normalization: 'auto',
    };
    if (
      /multilingual_v2|turbo_v2_5|flash_v2_5|eleven_v3|eleven_v4|eleven_multilingual/.test(
        model
      )
    ) {
      body.language_code = process.env.ELEVENLABS_LANGUAGE || 'en';
    }

    const response = await fetch(
      `${ELEVEN_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const audioBase64 = data.audio_base64 || data.audioBase64;
      if (!audioBase64) {
        lastError = { status: 502, details: 'missing audio_base64' };
        continue;
      }
      const alignment = data.normalized_alignment || data.alignment || null;
      return {
        mimeType: 'audio/mpeg',
        base64: audioBase64,
        buffer: Buffer.from(audioBase64, 'base64'),
        modelId: model,
        words: wordsFromAlignment(alignment),
      };
    }

    const errText = await response.text();
    let details;
    try {
      details = JSON.parse(errText);
    } catch {
      details = errText;
    }
    lastError = { status: response.status, details, modelId: model };
  }

  const error = new Error(elevenErrorMessage(lastError?.details, 'TTS with timestamps failed'));
  error.status = lastError?.status || 502;
  error.details = lastError?.details;
  throw error;
}

async function synthesizeSpeech({ voiceId, text, modelId, withTimestamps }) {
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

  if (withTimestamps) {
    return ttsWithTimestamps({ voiceId, text: spoken, modelId });
  }

  if (stsEnabled() && !modelId) {
    try {
      const donorAudio = await ttsRequest({
        voiceId: prosodyDonorVoiceId(),
        text: spoken,
        model: null, // use quality cascade
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
    .replace(/\s*[—–]\s*/g, '. ')
    .replace(/\s*\.\.\.\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Best-effort delete of a cloned voice (account deletion). */
async function deleteVoice(voiceId) {
  const key = getElevenKey();
  const id = String(voiceId || '').trim();
  if (!key || !id) return false;
  const response = await fetch(`${ELEVEN_BASE}/voices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': key },
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw Object.assign(
      new Error(`ElevenLabs delete voice failed (${response.status}): ${text.slice(0, 200)}`),
      { status: 502 }
    );
  }
  return true;
}

module.exports = {
  cloneVoice,
  synthesizeSpeech,
  deleteVoice,
  getElevenKey,
  realisticVoiceSettings,
  defaultTtsModel,
};

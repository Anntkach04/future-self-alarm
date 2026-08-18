const FormData = require('form-data');
const fetch = require('node-fetch');

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

function getElevenKey() {
  return process.env.ELEVENLABS_API_KEY || '';
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
  form.append('description', 'Future Self Alarm voice clone');
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

  return {
    voiceId: data.voice_id,
    requiresVerification: data.requires_verification,
  };
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

  const response = await fetch(
    `${ELEVEN_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: String(text).slice(0, 2500),
        model_id: modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.52,
          similarity_boost: 0.82,
          style: 0.12,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    let details;
    try {
      details = JSON.parse(errText);
    } catch {
      details = errText;
    }
    const error = new Error('TTS failed');
    error.status = response.status;
    error.details = details;
    throw error;
  }

  const buffer = await response.buffer();
  return {
    mimeType: 'audio/mpeg',
    buffer,
    base64: buffer.toString('base64'),
  };
}

module.exports = { cloneVoice, synthesizeSpeech, getElevenKey };

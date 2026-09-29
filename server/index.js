require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const os = require('os');
const multer = require('multer');
const cors = require('cors');
const { cloneVoice, synthesizeSpeech, getElevenKey } = require('./lib/elevenlabs');
const { generateMorningScript, generateMoodAdvice, getOpenAiKey } = require('./lib/openai');
const { buildAlarmScript } = require('./lib/alarmScript');
const {
  mixVoiceWithBed,
  mp3BufferToAlarmCaf,
  getFfmpegPath,
  listBeds,
} = require('./lib/mix');
const { resolveBed, pickBedId } = require('./lib/beds');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const PORT = process.env.VOICE_API_PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '30mb' }));

app.use((req, _res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

function sendError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({
    error: error.message || 'Unexpected error',
    details: error.details,
  });
}

async function runClone({ buffer, originalname, mimetype, name }) {
  return cloneVoice({
    buffer,
    originalname,
    mimetype,
    name,
  });
}

app.get('/api/health', (_req, res) => {
  const elevenLabs = Boolean(getElevenKey());
  const openai = Boolean(getOpenAiKey());
  const beds = listBeds();
  const musicBed = beds.some((bed) => bed.available);
  const ffmpeg = Boolean(getFfmpegPath());
  res.json({
    ok: elevenLabs,
    hasKey: elevenLabs,
    elevenLabs,
    openai,
    musicBed,
    beds,
    ffmpeg,
    readyToGenerate: elevenLabs && openai,
  });
});

app.post('/api/voices/clone', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    const result = await runClone({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      name: req.body.name,
    });
    return res.json(result);
  } catch (error) {
    console.error('clone error', error);
    return sendError(res, error);
  }
});

/** RN-safe clone: avoids FormDataPart bugs on newer React Native. */
app.post('/api/voices/clone-json', async (req, res) => {
  try {
    const { name, base64, mimeType, fileName } = req.body || {};
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'base64 audio is required' });
    }
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ error: 'Empty audio payload' });
    }
    const result = await runClone({
      buffer,
      originalname: fileName || 'sample.m4a',
      mimetype: mimeType || 'audio/m4a',
      name: name || 'User Future Self',
    });
    return res.json(result);
  } catch (error) {
    console.error('clone-json error', error);
    return sendError(res, error);
  }
});

app.post('/api/script', async (req, res) => {
  try {
    const answers = req.body?.answers || req.body || {};
    const script = await generateMorningScript(answers);
    return res.json(script);
  } catch (error) {
    console.error('script error', error);
    return sendError(res, error);
  }
});

app.post('/api/mood-advice', async (req, res) => {
  try {
    const { mood, note, name } = req.body || {};
    if (!mood) {
      return res.status(400).json({ error: 'mood is required' });
    }
    const result = await generateMoodAdvice({
      mood: String(mood),
      note: String(note || ''),
      name: String(name || ''),
    });
    return res.json(result);
  } catch (error) {
    console.error('mood-advice error', error);
    return sendError(res, error);
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { voiceId, text, modelId } = req.body || {};
    const result = await synthesizeSpeech({ voiceId, text, modelId });
    return res.json({
      mimeType: result.mimeType,
      base64: result.base64,
    });
  } catch (error) {
    console.error('tts error', error);
    return sendError(res, error);
  }
});

/** MP3 → short CAF for iOS system alarm / notification sound (≤30s). */
app.post('/api/audio/to-alarm-sound', async (req, res) => {
  try {
    const { base64, maxSeconds } = req.body || {};
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'base64 audio is required' });
    }
    const input = Buffer.from(base64, 'base64');
    if (!input.length) {
      return res.status(400).json({ error: 'Empty audio payload' });
    }
    const caf = await mp3BufferToAlarmCaf(
      input,
      Math.min(30, Math.max(5, Number(maxSeconds) || 28))
    );
    return res.json({
      mimeType: caf.mimeType,
      base64: caf.buffer.toString('base64'),
      maxSeconds: caf.maxSeconds,
      extension: 'caf',
    });
  } catch (error) {
    console.error('to-alarm-sound error', error);
    return sendError(res, error);
  }
});

app.get('/api/beds/:id/preview', (req, res) => {
  const bed = resolveBed(req.params.id);
  if (!bed?.path) {
    return res.status(404).json({ error: 'Music bed not found' });
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.sendFile(bed.path);
});

app.post('/api/alarm/generate', async (req, res) => {
  try {
    const { voiceId, answers, text: providedText, skipMix } = req.body || {};
    if (!voiceId) {
      return res.status(400).json({ error: 'voiceId is required' });
    }

    // Default: fixed wake script only. Set USE_AI_ALARM_SCRIPTS=true to bring OpenAI back.
    const useAiScripts = process.env.USE_AI_ALARM_SCRIPTS === 'true';
    let script;
    if (providedText) {
      const text = String(providedText).trim();
      script = {
        text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        model: 'provided',
      };
    } else if (useAiScripts) {
      script = await generateMorningScript(answers || {});
    } else {
      const text = buildAlarmScript(answers?.name);
      script = {
        text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        model: 'fixed',
      };
    }

    const spoken = await synthesizeSpeech({
      voiceId,
      text: script.text,
    });

    const mixed = skipMix
      ? { buffer: spoken.buffer, mixed: false, reason: 'skipped' }
      : await mixVoiceWithBed(
          spoken.buffer,
          pickBedId(answers || {})
        );

    return res.json({
      text: script.text,
      wordCount: script.wordCount,
      model: script.model,
      mimeType: 'audio/mpeg',
      base64: mixed.buffer.toString('base64'),
      mixed: Boolean(mixed.mixed),
      bedFile: mixed.bedFile || null,
      bedId: mixed.bedId || null,
    });
  } catch (error) {
    console.error('generate error', error);
    return sendError(res, error);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i?.family === 'IPv4' && !i.internal)?.address;
  console.log(`Future Self API on http://localhost:${PORT}`);
  if (lan) {
    console.log(`Phone (same Wi‑Fi): set EXPO_PUBLIC_API_URL=http://${lan}:${PORT}`);
  }
  console.log(
    getElevenKey() ? 'ElevenLabs: loaded' : 'ElevenLabs: MISSING — set ELEVENLABS_API_KEY'
  );
  console.log(
    getOpenAiKey() ? 'OpenAI: loaded' : 'OpenAI: MISSING — set OPENAI_API_KEY'
  );
  console.log(
    listBeds()
      .filter((bed) => bed.available)
      .map((bed) => bed.file)
      .join(', ') || 'Music beds: MISSING — drop mp3s in server/assets/beds/'
  );
});

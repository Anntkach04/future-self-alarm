require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { cloneVoice, synthesizeSpeech, getElevenKey } = require('./lib/elevenlabs');
const { generateMorningScript, generateMoodAdvice, getOpenAiKey } = require('./lib/openai');
const { mixVoiceWithBed, getFfmpegPath, listBeds } = require('./lib/mix');
const { resolveBed, pickBedId } = require('./lib/beds');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const PORT = process.env.VOICE_API_PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function sendError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({
    error: error.message || 'Unexpected error',
    details: error.details,
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
    const result = await cloneVoice({
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

    const script = providedText
      ? {
          text: String(providedText).trim(),
          wordCount: String(providedText).trim().split(/\s+/).length,
          model: 'provided',
        }
      : await generateMorningScript(answers || {});

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

app.listen(PORT, () => {
  console.log(`Future Self API on http://localhost:${PORT}`);
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

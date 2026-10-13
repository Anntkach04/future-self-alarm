const path = require('path');
const fs = require('fs');
// Local: repo-root .env. Docker/Railway: platform env vars (no file needed).
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const os = require('os');
const multer = require('multer');
const cors = require('cors');
const {
  cloneVoice,
  synthesizeSpeech,
  deleteVoice,
  getElevenKey,
} = require('./lib/elevenlabs');
const { generateMorningScript, generateMoodAdvice, getOpenAiKey } = require('./lib/openai');
const { buildAlarmScript } = require('./lib/alarmScript');
const {
  mixVoiceWithBed,
  mp3BufferToAlarmCaf,
  getFfmpegPath,
  listBeds,
} = require('./lib/mix');
const { resolveBed, pickBedId } = require('./lib/beds');
const { initDb, getUser, updateUser, deleteUser, dbMode } = require('./lib/db');
const {
  authEnforced,
  loginWithApple,
  loginAsGuest,
  requireAuth,
  publicUser,
  APPLE_CLIENT_ID,
} = require('./lib/auth');
const { revokeRefreshToken } = require('./lib/appleRevoke');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** Railway/Fly set PORT; local uses VOICE_API_PORT. */
const PORT = Number(process.env.PORT || process.env.VOICE_API_PORT || 8787);
const IS_PROD = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '30mb' }));

const PUBLIC_DIR = path.join(__dirname, 'public');

function supportInbox() {
  return (
    process.env.SUPPORT_EMAIL ||
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL ||
    'dyniza@uxdyniza.com'
  ).trim();
}

function supportMailto(topic) {
  const email = supportInbox();
  const subject = encodeURIComponent(`[Future Self Alarm] ${topic}`);
  return `mailto:${email}?subject=${subject}`;
}

function sendPublicHtml(res, fileName) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).type('text').send('Not found');
  }
  const html = fs
    .readFileSync(filePath, 'utf8')
    .replaceAll('{{SUPPORT_EMAIL}}', supportInbox())
    .replaceAll('{{SUPPORT_MAILTO_PRIVACY}}', supportMailto('Privacy'))
    .replaceAll('{{SUPPORT_MAILTO_TERMS}}', supportMailto('Terms'))
    .replaceAll('{{SUPPORT_MAILTO_HELP}}', supportMailto('Help'));
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.type('html');
  return res.send(html);
}

app.get('/privacy', (_req, res) => sendPublicHtml(res, 'privacy.html'));
app.get('/privacy/', (_req, res) => sendPublicHtml(res, 'privacy.html'));
app.get('/terms', (_req, res) => sendPublicHtml(res, 'terms.html'));
app.get('/terms/', (_req, res) => sendPublicHtml(res, 'terms.html'));

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
    beds: IS_PROD
      ? beds.map(({ id, label, available }) => ({ id, label, available }))
      : beds,
    ffmpeg,
    readyToGenerate: elevenLabs && openai,
    authRequired: authEnforced(),
    db: dbMode(),
    appleAudience: APPLE_CLIENT_ID,
    env: IS_PROD ? 'production' : 'development',
    /** Soft update banner when client version is below this (semver). */
    minAppVersion: (process.env.MIN_APP_VERSION || '').trim() || null,
    /** Optional harder floor (still soft UI unless client chooses to block). */
    forceAppVersion: (process.env.FORCE_APP_VERSION || '').trim() || null,
    storeUrl: (process.env.APP_STORE_URL || '').trim() || null,
  });
});

app.post('/api/auth/apple', async (req, res) => {
  try {
    const result = await loginWithApple(req.body || {});
    return res.json(result);
  } catch (error) {
    console.error('auth/apple error', error);
    return sendError(res, error);
  }
});

/** Pre-Sign-In session for clone/TTS during onboarding. */
app.post('/api/auth/guest', async (req, res) => {
  try {
    const result = await loginAsGuest();
    return res.json(result);
  } catch (error) {
    console.error('auth/guest error', error);
    return sendError(res, error);
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Sign in required' });
    }
    const user = req.user || (await getUser(req.userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('me get error', error);
    return sendError(res, error);
  }
});

app.patch('/api/me', requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Sign in required' });
    }
    const { voiceId, profile, email } = req.body || {};
    const user = await updateUser(req.userId, {
      voiceId,
      profile,
      email,
    });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('me patch error', error);
    return sendError(res, error);
  }
});

/** App Store Guideline 5.1.1(v) — in-app account deletion. */
app.delete('/api/me', requireAuth, async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Sign in required' });
    }
    const existing = req.user || (await getUser(req.userId));
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Best-effort: drop ElevenLabs clone so voice data does not linger.
    if (existing.voiceId) {
      try {
        await deleteVoice(existing.voiceId);
      } catch (error) {
        console.warn('voice delete on account removal failed', error.message || error);
      }
    }
    // App Review 5.1.1 — revoke Sign in with Apple tokens when we have a refresh token.
    const refresh = existing.profile?.appleRefreshToken;
    if (refresh) {
      try {
        await revokeRefreshToken(refresh);
      } catch (error) {
        console.warn('Apple revoke on delete failed', error.message || error);
      }
    }
    await deleteUser(req.userId);
    return res.json({ ok: true });
  } catch (error) {
    console.error('me delete error', error);
    return sendError(res, error);
  }
});

async function persistVoiceId(req, voiceId) {
  if (!req.userId || !voiceId) return;
  try {
    await updateUser(req.userId, { voiceId: String(voiceId) });
  } catch (error) {
    console.warn('persist voiceId failed', error.message || error);
  }
}

app.post('/api/voices/clone', requireAuth, upload.single('file'), async (req, res) => {
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
    await persistVoiceId(req, result.voiceId);
    return res.json(result);
  } catch (error) {
    console.error('clone error', error);
    return sendError(res, error);
  }
});

/** RN-safe clone: avoids FormDataPart bugs on newer React Native. */
app.post('/api/voices/clone-json', requireAuth, async (req, res) => {
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
    await persistVoiceId(req, result.voiceId);
    return res.json(result);
  } catch (error) {
    console.error('clone-json error', error);
    return sendError(res, error);
  }
});

app.post('/api/script', requireAuth, async (req, res) => {
  try {
    const answers = req.body?.answers || req.body || {};
    const script = await generateMorningScript(answers);
    return res.json(script);
  } catch (error) {
    console.error('script error', error);
    return sendError(res, error);
  }
});

app.post('/api/mood-advice', requireAuth, async (req, res) => {
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

app.post('/api/tts', requireAuth, async (req, res) => {
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
app.post('/api/audio/to-alarm-sound', requireAuth, async (req, res) => {
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

app.post('/api/alarm/generate', requireAuth, async (req, res) => {
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
      const text = buildAlarmScript(answers?.name, {
        label: answers?.moodForTomorrow,
      });
      script = {
        text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        model: answers?.moodForTomorrow ? 'fixed+mood' : 'fixed',
      };
    }

    const spoken = await synthesizeSpeech({
      voiceId,
      text: script.text,
    });

    const mixed = skipMix
      ? { buffer: spoken.buffer, mixed: false, reason: 'skipped' }
      : await mixVoiceWithBed(spoken.buffer, pickBedId(answers || {}), {
          voiceLevel: answers?.voiceLevel,
          bedLevel: answers?.bedLevel,
        });

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

function start() {
  app.listen(PORT, '0.0.0.0', () => {
    const lan = Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i?.family === 'IPv4' && !i.internal)?.address;
    console.log(
      `Future Self API listening on 0.0.0.0:${PORT} (${IS_PROD ? 'prod' : 'dev'})`
    );
    if (!IS_PROD && lan) {
      console.log(
        `Phone (same Wi-Fi): set EXPO_PUBLIC_API_URL=http://${lan}:${PORT}`
      );
    }
    console.log(
      getElevenKey()
        ? 'ElevenLabs: loaded'
        : 'ElevenLabs: MISSING - set ELEVENLABS_API_KEY'
    );
    console.log(
      getOpenAiKey() ? 'OpenAI: loaded' : 'OpenAI: MISSING - set OPENAI_API_KEY'
    );
    console.log(
      authEnforced()
        ? `Auth: required (Apple audience ${APPLE_CLIENT_ID})`
        : 'Auth: optional (set JWT_SECRET to enforce Sign in with Apple)'
    );
    console.log(`DB: ${dbMode()} (initializing…)`);
    console.log(
      listBeds()
        .filter((bed) => bed.available)
        .map((bed) => bed.resolvedFile || bed.file)
        .join(', ') || 'Music beds: MISSING - drop m4a/mp3 in server/assets/beds/'
    );

    void initDb().catch((error) => {
      console.error('DB init failed after listen', error);
    });
  });
}

start();

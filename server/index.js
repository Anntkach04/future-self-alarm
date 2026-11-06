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
const { findBedFile } = require('./lib/beds');
const {
  initDb,
  getUser,
  updateUser,
  deleteUser,
  listStaleGuests,
  dbMode,
} = require('./lib/db');
const {
  authEnforced,
  loginWithApple,
  loginAsGuest,
  requireAuth,
  publicUser,
  publicProfile,
  verifyAppToken,
  APPLE_CLIENT_ID,
} = require('./lib/auth');
const {
  assertVoiceAccess,
  isPremadeVoice,
  ownedVoiceIds,
  userCanUseVoice,
  withOwnedVoice,
} = require('./lib/voiceAccess');
const { rateLimit, HOUR, DAY } = require('./lib/rateLimit');
const { revokeRefreshToken } = require('./lib/appleRevoke');
const { saveContactMessage } = require('./lib/contactMessages');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  // Raw iOS takes can be large before server-side ffmpeg compress.
  limits: { fileSize: 64 * 1024 * 1024 },
});

/** Railway/Fly set PORT; local uses VOICE_API_PORT. */
const PORT = Number(process.env.PORT || process.env.VOICE_API_PORT || 8787);
const IS_PROD = process.env.NODE_ENV === 'production';
/** Longest wake script is ~250 words; cap TTS spend per request. */
const MAX_TTS_CHARS = 2000;

const limitGuest = rateLimit('guest', [
  { limit: 20, windowMs: HOUR },
  { limit: 60, windowMs: DAY },
], 'ip');
const limitAppleAuth = rateLimit('apple', [{ limit: 30, windowMs: HOUR }], 'ip');
const limitContact = rateLimit('contact', [
  { limit: 5, windowMs: HOUR },
  { limit: 20, windowMs: DAY },
], 'ip');
const limitClone = rateLimit('clone', [
  { limit: 6, windowMs: HOUR },
  { limit: 20, windowMs: DAY },
]);
const limitSpeech = rateLimit('speech', [
  { limit: 60, windowMs: HOUR },
  { limit: 300, windowMs: DAY },
]);
const limitText = rateLimit('text', [
  { limit: 30, windowMs: HOUR },
  { limit: 150, windowMs: DAY },
]);
const limitConvert = rateLimit('convert', [{ limit: 60, windowMs: HOUR }]);

function cappedText(raw) {
  const text = String(raw || '').trim();
  if (text.length > MAX_TTS_CHARS) {
    throw Object.assign(new Error('Text is too long.'), { status: 413 });
  }
  return text;
}

app.set('trust proxy', 1);
// Native app requests carry no Origin and are unaffected. Browsers only get
// CORS for explicitly listed origins (CORS_ORIGINS, comma-separated); public
// pages (/contact) are same-origin. Dev stays open for Expo web.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
app.use(
  cors({
    origin(origin, done) {
      if (!origin || !IS_PROD || CORS_ORIGINS.includes(origin)) {
        return done(null, true);
      }
      return done(null, false);
    },
  })
);
// Only audio uploads may be large (base64 takes / mixed MP3s); everything else
// is small JSON, so a tight default limit blunts memory abuse.
const LARGE_JSON_PATHS = new Set([
  '/api/voices/clone-json',
  '/api/audio/to-alarm-sound',
]);
const jsonLarge = express.json({ limit: '64mb' });
const jsonSmall = express.json({ limit: '256kb' });
app.use((req, res, next) =>
  (LARGE_JSON_PATHS.has(req.path) ? jsonLarge : jsonSmall)(req, res, next)
);
app.use((err, _req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      error:
        'Recording is too long for clone. Tap re-record and keep it around one to two minutes.',
    });
  }
  return next(err);
});


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

function publicOrigin(req) {
  const env = (process.env.PUBLIC_WEB_ORIGIN || '').trim().replace(/\/$/, '');
  if (env) return env;
  const host = req.get('x-forwarded-host') || req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  return host ? `${proto}://${host}` : '';
}

function sendPublicHtml(res, req, fileName) {
  const filePath = path.join(PUBLIC_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).type('text').send('Not found');
  }
  const origin = publicOrigin(req);
  const contactUrl = origin ? `${origin}/contact` : '/contact';
  const html = fs
    .readFileSync(filePath, 'utf8')
    .replaceAll('{{SUPPORT_EMAIL}}', supportInbox())
    .replaceAll('{{SUPPORT_MAILTO_PRIVACY}}', supportMailto('Privacy'))
    .replaceAll('{{SUPPORT_MAILTO_TERMS}}', supportMailto('Terms'))
    .replaceAll('{{SUPPORT_MAILTO_HELP}}', supportMailto('Help'))
    .replaceAll('{{CONTACT_URL}}', contactUrl);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.type('html');
  return res.send(html);
}

app.get('/privacy', (req, res) => sendPublicHtml(res, req, 'privacy.html'));
app.get('/privacy/', (req, res) => sendPublicHtml(res, req, 'privacy.html'));
app.get('/terms', (req, res) => sendPublicHtml(res, req, 'terms.html'));
app.get('/terms/', (req, res) => sendPublicHtml(res, req, 'terms.html'));
app.get('/contact', (req, res) => sendPublicHtml(res, req, 'contact.html'));
app.get('/contact/', (req, res) => sendPublicHtml(res, req, 'contact.html'));

const limitClientError = rateLimit('client-error', [{ limit: 30, windowMs: HOUR }], 'ip');
/** JS errors from the app (src/services/errorReporting.ts) → Railway logs. */
app.post('/api/client-error', limitClientError, (req, res) => {
  const b = req.body || {};
  const clip = (v, n) => String(v ?? '').slice(0, n);
  console.error(
    `[client-error] ${b.fatal ? 'FATAL ' : ''}${clip(b.context, 80)} v${clip(b.appVersion, 20)} b${clip(b.build, 10)} ${clip(b.platform, 10)} ${clip(b.osVersion, 20)}: ${clip(b.message, 500)}\n${clip(b.stack, 4000)}`
  );
  return res.status(204).end();
});

app.post('/api/contact', limitContact, async (req, res) => {
  try {
    const row = await saveContactMessage(req.body || {});
    return res.json({ ok: true, id: row.id });
  } catch (error) {
    return sendError(res, error);
  }
});

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

async function runClone({ buffer, originalname, mimetype, name, userId }) {
  return cloneVoice({
    buffer,
    originalname,
    mimetype,
    name,
    userId,
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

/**
 * Move voices cloned during the guest part of onboarding onto the Apple
 * account, so ownership checks pass and account deletion removes them.
 */
async function adoptGuestVoices(guestToken, appleUserId) {
  const guestId = guestToken ? verifyAppToken(String(guestToken)) : null;
  if (!guestId || !guestId.startsWith('guest_') || guestId === appleUserId) {
    return;
  }
  try {
    const guest = await getUser(guestId);
    const apple = await getUser(appleUserId);
    if (!guest || !apple) return;
    const guestVoices = ownedVoiceIds(guest);
    if (!guestVoices.length) {
      await deleteUser(guestId).catch(() => undefined);
      return;
    }
    let profile = apple.profile || {};
    for (const id of guestVoices) {
      profile = withOwnedVoice({ ...apple, profile }, id);
    }
    await updateUser(appleUserId, {
      // Newest clone (from this onboarding) becomes the active voice.
      voiceId: guest.voiceId || apple.voiceId || null,
      profile,
    });
    await deleteUser(guestId).catch(() => undefined);
  } catch (error) {
    console.warn('adopt guest voices failed', error?.message || error);
  }
}

app.post('/api/auth/apple', limitAppleAuth, async (req, res) => {
  try {
    const result = await loginWithApple(req.body || {});
    if (result?.user?.id) {
      await adoptGuestVoices(req.body?.guestToken, result.user.id);
      const fresh = await getUser(result.user.id).catch(() => null);
      if (fresh) result.user = publicUser(fresh);
    }
    return res.json(result);
  } catch (error) {
    console.error('auth/apple error', error);
    return sendError(res, error);
  }
});

/** Pre-Sign-In session for clone/TTS during onboarding. */
app.post('/api/auth/guest', limitGuest, async (req, res) => {
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
    const current = req.user || (await getUser(req.userId));
    // Never let a client point its account at someone else's clone.
    const safeVoiceId =
      voiceId === undefined || voiceId === null
        ? voiceId
        : userCanUseVoice(current, voiceId)
          ? String(voiceId)
          : undefined;
    if (voiceId && safeVoiceId === undefined) {
      console.warn(`me patch: ignored foreign voiceId for ${req.userId}`);
    }
    let safeProfile =
      profile === undefined ? undefined : publicProfile(profile);
    if (
      safeProfile &&
      safeProfile.voiceId &&
      !userCanUseVoice(current, safeProfile.voiceId)
    ) {
      const { voiceId: _drop, ...rest } = safeProfile;
      safeProfile = rest;
    }
    const user = await updateUser(req.userId, {
      voiceId: safeVoiceId,
      profile: safeProfile,
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
    // Best-effort: drop every ElevenLabs clone so voice data does not linger.
    for (const id of ownedVoiceIds(existing)) {
      if (isPremadeVoice(id)) continue;
      try {
        await deleteVoice(id);
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
    const current = req.user || (await getUser(req.userId));
    await updateUser(req.userId, {
      voiceId: String(voiceId),
      profile: withOwnedVoice(current, voiceId),
    });
  } catch (error) {
    console.warn('persist voiceId failed', error.message || error);
  }
}

app.post('/api/voices/clone', requireAuth, limitClone, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    const result = await runClone({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      name: req.body.name,
      userId: req.userId,
    });
    await persistVoiceId(req, result.voiceId);
    return res.json(result);
  } catch (error) {
    console.error('clone error', error);
    return sendError(res, error);
  }
});

/** RN-safe clone: avoids FormDataPart bugs on newer React Native. */
app.post('/api/voices/clone-json', requireAuth, limitClone, async (req, res) => {
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
      userId: req.userId,
    });
    await persistVoiceId(req, result.voiceId);
    return res.json(result);
  } catch (error) {
    console.error('clone-json error', error);
    return sendError(res, error);
  }
});

app.post('/api/script', requireAuth, limitText, async (req, res) => {
  try {
    const answers = req.body?.answers || req.body || {};
    const script = await generateMorningScript(answers);
    return res.json(script);
  } catch (error) {
    console.error('script error', error);
    return sendError(res, error);
  }
});

app.post('/api/mood-advice', requireAuth, limitText, async (req, res) => {
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

app.post('/api/tts', requireAuth, limitSpeech, async (req, res) => {
  try {
    const { voiceId, skipMix, withTimestamps } = req.body || {};
    assertVoiceAccess(req, voiceId, authEnforced());
    const text = cappedText(req.body?.text);
    // Model is server-chosen; clients cannot pick pricier models.
    const modelId = undefined;
    // Timestamps must match the audio we return — skip bed mix for karaoke preview.
    const wantTimes = Boolean(withTimestamps);
    const result = await synthesizeSpeech({
      voiceId,
      text,
      modelId,
      withTimestamps: wantTimes,
    });
    if (skipMix || wantTimes) {
      return res.json({
        mimeType: result.mimeType,
        base64: result.base64,
        words: result.words || null,
      });
    }
    const raw = Buffer.from(result.base64, 'base64');
    const colored = await mixVoiceWithBed(raw, 'soft-calm', {
      voiceLevel: 0.85,
      bedLevel: 0.4,
    });
    return res.json({
      mimeType: 'audio/mpeg',
      base64: colored.buffer.toString('base64'),
      mixed: Boolean(colored.mixed),
      mixReason: colored.reason || null,
    });
  } catch (error) {
    console.error('tts error', error);
    return sendError(res, error);
  }
});

/** MP3 → short CAF for iOS system alarm / notification sound (≤30s). */
app.post('/api/audio/to-alarm-sound', requireAuth, limitConvert, async (req, res) => {
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
  // Legacy bali-morning → soft-massage (calm); findBedFile remaps.
  const file = findBedFile(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'Music bed not found' });
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.sendFile(file);
});

app.post('/api/alarm/generate', requireAuth, limitSpeech, async (req, res) => {
  try {
    const { voiceId, answers, skipMix } = req.body || {};
    if (!voiceId) {
      return res.status(400).json({ error: 'voiceId is required' });
    }
    assertVoiceAccess(req, voiceId, authEnforced());
    const providedText = cappedText(req.body?.text);

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
      const text = buildAlarmScript(
        answers?.name,
        { label: answers?.moodForTomorrow },
        answers?.morningHabits || answers?.alreadyProud
      );
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

    // Voice + vintage landline EQ/hiss + quiet modern calm pad (not bali/yoga).
    const mixed = skipMix
      ? { buffer: spoken.buffer, mixed: false, reason: 'skipped' }
      : await mixVoiceWithBed(spoken.buffer, 'soft-calm', {
          voiceLevel: answers?.voiceLevel,
          bedLevel:
            typeof answers?.bedLevel === 'number' ? answers.bedLevel : 0.35,
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

/**
 * Guest sessions never upgraded to Sign in with Apple keep an ElevenLabs clone
 * forever. After a week, delete the clone and the row (privacy policy: voice
 * data is not kept longer than needed).
 */
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
async function purgeStaleGuests() {
  if (process.env.GUEST_CLEANUP_DISABLED === 'true') return;
  try {
    const stale = await listStaleGuests(GUEST_TTL_MS);
    for (const guest of stale) {
      for (const id of ownedVoiceIds(guest)) {
        await deleteVoice(id).catch((error) =>
          console.warn('guest voice delete failed', error?.message || error)
        );
      }
      await deleteUser(guest.id).catch(() => undefined);
    }
    if (stale.length) console.log(`[guests] purged ${stale.length} stale guest(s)`);
  } catch (error) {
    console.warn('[guests] purge failed', error?.message || error);
  }
}

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

    void initDb()
      .then(() => {
        void purgeStaleGuests();
        setInterval(() => void purgeStaleGuests(), 12 * 60 * 60 * 1000).unref();
      })
      .catch((error) => {
        console.error('DB init failed after listen', error);
      });
  });
}

start();

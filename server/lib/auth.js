const appleSignin = require('apple-signin-auth');
const jwt = require('jsonwebtoken');
const { upsertUser, getUser, updateUser } = require('./db');
const { exchangeAuthorizationCode } = require('./appleRevoke');

const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
const APPLE_CLIENT_ID = (
  process.env.APPLE_CLIENT_ID ||
  process.env.APPLE_BUNDLE_ID ||
  'com.futureself.alarm'
).trim();
const IS_PROD = process.env.NODE_ENV === 'production';
const TOKEN_TTL = process.env.APP_JWT_TTL || '90d';

if (IS_PROD && !JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production');
}

/** Local development may run without auth; production must have a signing key. */
function authEnforced() {
  return Boolean(JWT_SECRET);
}

function signAppToken(userId) {
  if (!JWT_SECRET) {
    throw Object.assign(new Error('JWT_SECRET is not configured'), {
      status: 500,
    });
  }
  return jwt.sign({ sub: userId }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
    issuer: 'future-self-alarm',
  });
}

function verifyAppToken(token) {
  if (!JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'future-self-alarm',
      algorithms: ['HS256'],
    });
    const sub = typeof payload?.sub === 'string' ? payload.sub : '';
    return sub || null;
  } catch {
    return null;
  }
}

/**
 * Verify Apple identity token and upsert local user.
 * @param {{ identityToken: string, email?: string|null, fullName?: string|null }} input
 */
/**
 * Temporary session so clone/TTS works before Sign in with Apple.
 * Apple Sign In later replaces this identity.
 */
async function loginAsGuest() {
  const id = `guest_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const user = await upsertUser(id, { email: null });
  const token = JWT_SECRET ? signAppToken(user.id) : null;
  return {
    token,
    user: publicUser(user),
    authRequired: authEnforced(),
  };
}

async function loginWithApple(input) {
  const identityToken = String(input?.identityToken || '').trim();
  if (!identityToken) {
    throw Object.assign(new Error('identityToken is required'), { status: 400 });
  }

  let appleSub;
  let appleEmail = input?.email || null;

  // Dev / simulator: allow fake tokens when not in production
  if (!IS_PROD && identityToken.startsWith('dev.')) {
    appleSub = identityToken.slice(4) || `dev_${Date.now()}`;
  } else {
    const payload = await appleSignin.verifyIdToken(identityToken, {
      audience: APPLE_CLIENT_ID,
      ignoreExpiration: false,
    });
    appleSub = payload.sub;
    appleEmail = payload.email || appleEmail || null;
  }

  let user = await upsertUser(appleSub, { email: appleEmail });

  // Store Apple refresh token when the client sends authorizationCode (for revoke on delete).
  const authorizationCode = String(input?.authorizationCode || '').trim();
  if (authorizationCode) {
    const refresh = await exchangeAuthorizationCode(authorizationCode);
    if (refresh) {
      try {
        user = await updateUser(user.id, {
          profile: {
            ...(user.profile || {}),
            appleRefreshToken: refresh,
          },
        });
      } catch (error) {
        console.warn(
          'Could not persist Apple refresh token',
          error?.message || error
        );
      }
    }
  }

  const token = JWT_SECRET ? signAppToken(user.id) : null;

  return {
    token,
    user: publicUser(user),
    authRequired: authEnforced(),
  };
}

// Only app-owned profile fields may cross the API boundary in either direction.
function publicProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {};
  const fields = ['version', 'answers', 'onboardingComplete', 'voiceId', 'isDemoVoice', 'mood', 'mix'];
  return Object.fromEntries(fields
    .filter((key) => Object.prototype.hasOwnProperty.call(profile, key))
    .map((key) => [key, profile[key]]));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    voiceId: user.voiceId,
    profile: publicProfile(user.profile),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function bearerFromReq(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/**
 * Attach req.userId when valid. If auth is enforced, reject missing/invalid tokens.
 */
async function requireAuth(req, res, next) {
  if (!authEnforced()) {
    const token = bearerFromReq(req);
    if (token) {
      const sub = verifyAppToken(token);
      if (sub) {
        req.userId = sub;
        req.user = await getUser(sub);
      }
    }
    return next();
  }

  const token = bearerFromReq(req);
  if (!token) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  const sub = verifyAppToken(token);
  if (!sub) {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
  let user;
  try {
    user = await getUser(sub);
  } catch {
    return res.status(503).json({ error: 'Account service unavailable. Try again.' });
  }
  if (!user) {
    // A stale token must never recreate an account that was deleted.
    return res.status(401).json({ error: 'Account not found. Sign in again.' });
  }
  req.userId = sub;
  req.user = user;
  return next();
}

module.exports = {
  authEnforced,
  loginWithApple,
  loginAsGuest,
  requireAuth,
  publicUser,
  publicProfile,
  verifyAppToken,
  APPLE_CLIENT_ID,
};

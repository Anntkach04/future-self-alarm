/**
 * Sign in with Apple token revoke (App Review 5.1.1 guidance).
 * Requires Apple .p8 key env vars. Best-effort — never blocks account delete.
 */
const appleSignin = require('apple-signin-auth');

const APPLE_CLIENT_ID = (
  process.env.APPLE_CLIENT_ID ||
  process.env.APPLE_BUNDLE_ID ||
  'com.futureself.alarm'
).trim();
const APPLE_TEAM_ID = (process.env.APPLE_TEAM_ID || '').trim();
const APPLE_KEY_ID = (process.env.APPLE_KEY_ID || '').trim();
const APPLE_PRIVATE_KEY = (process.env.APPLE_PRIVATE_KEY || '')
  .trim()
  .replace(/\\n/g, '\n');

function canTalkToApple() {
  return Boolean(APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY);
}

function clientSecret() {
  return appleSignin.getClientSecret({
    clientID: APPLE_CLIENT_ID,
    teamID: APPLE_TEAM_ID,
    keyIdentifier: APPLE_KEY_ID,
    privateKey: APPLE_PRIVATE_KEY,
  });
}

/**
 * Exchange authorization code → store refresh_token on user.profile.
 * @param {string} authorizationCode
 * @returns {Promise<string|null>} refresh token
 */
async function exchangeAuthorizationCode(authorizationCode) {
  const code = String(authorizationCode || '').trim();
  if (!code || !canTalkToApple()) return null;
  try {
    const result = await appleSignin.getAuthorizationToken(code, {
      clientID: APPLE_CLIENT_ID,
      clientSecret: clientSecret(),
      // Native apps omit redirectUri for code exchange.
      redirectUri: '',
    });
    return result?.refresh_token || result?.refreshToken || null;
  } catch (error) {
    console.warn(
      'Apple auth code exchange failed',
      error?.message || error
    );
    return null;
  }
}

/**
 * @param {string|null|undefined} refreshToken
 */
async function revokeRefreshToken(refreshToken) {
  const token = String(refreshToken || '').trim();
  if (!token || !canTalkToApple()) return false;
  try {
    await appleSignin.revokeAuthorizationToken(token, {
      clientID: APPLE_CLIENT_ID,
      clientSecret: clientSecret(),
    });
    return true;
  } catch (error) {
    console.warn('Apple token revoke failed', error?.message || error);
    return false;
  }
}

module.exports = {
  canTalkToApple,
  exchangeAuthorizationCode,
  revokeRefreshToken,
};

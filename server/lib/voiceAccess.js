/**
 * Voice ownership: a session may only speak with voices it cloned itself
 * (or the shared premade ElevenLabs voices used for demo previews).
 *
 * Owned ids live in user.voiceId + user.profile.ownedVoiceIds. The latter is
 * server-private: publicProfile() never exposes it and PATCH /api/me cannot set it.
 */

/** Must match TEMP_PREMADE_VOICE_IDS in src/services/cloneOnboardingVoice.ts. */
const PREMADE_VOICE_IDS = new Set([
  '21m00Tcm4TlvDq8ikWAM',
  'EXAVITQu4vr4xnSDxMaL',
  'ErXwobaYiN019PkySvjV',
  'MF3mGyEYCl7XYWbV9V6O',
  'TxGEqnHWrfWFTfGW9XjX',
  'pNInz6obpgDQGcFmaJgB',
]);

function isPremadeVoice(voiceId) {
  return PREMADE_VOICE_IDS.has(String(voiceId || ''));
}

/** @returns {string[]} cloned voice ids owned by this user (no premade). */
function ownedVoiceIds(user) {
  if (!user) return [];
  const list = Array.isArray(user.profile?.ownedVoiceIds)
    ? user.profile.ownedVoiceIds
    : [];
  const all = [user.voiceId, ...list]
    .map((id) => String(id || '').trim())
    .filter((id) => id && !isPremadeVoice(id));
  return [...new Set(all)];
}

function userCanUseVoice(user, voiceId) {
  const id = String(voiceId || '').trim();
  if (!id) return false;
  if (isPremadeVoice(id)) return true;
  return ownedVoiceIds(user).includes(id);
}

/**
 * Throws 403 unless the request's user may use this voice.
 * Local dev without JWT_SECRET has no user → allowed (auth is off there).
 */
function assertVoiceAccess(req, voiceId, authOn) {
  if (!authOn && !req.user) return;
  if (userCanUseVoice(req.user, voiceId)) return;
  throw Object.assign(new Error('This voice is not available for your account.'), {
    status: 403,
  });
}

/** Profile patch that records a newly cloned voice as owned. */
function withOwnedVoice(user, voiceId) {
  const owned = ownedVoiceIds(user);
  const id = String(voiceId || '').trim();
  if (id && !isPremadeVoice(id) && !owned.includes(id)) owned.push(id);
  return { ...(user?.profile || {}), ownedVoiceIds: owned.slice(-20) };
}

module.exports = {
  PREMADE_VOICE_IDS,
  isPremadeVoice,
  ownedVoiceIds,
  userCanUseVoice,
  assertVoiceAccess,
  withOwnedVoice,
};

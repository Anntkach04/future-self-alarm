/** Map raw API / network errors into short copy for the person using the app. */
export function userFacingError(
  error: unknown,
  fallback = 'Something went wrong. Try again.'
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback;
  const text = raw.trim();

  if (/voice_not_found|voice with voice_id|A voice with voice_id/i.test(text)) {
    return 'Your cloned voice is missing. Re-record your voice, then try again.';
  }
  if (/Network request failed|Failed to fetch|ECONNREFUSED|timed out|ETIMEDOUT|offline/i.test(text)) {
    return 'Cannot reach the voice server. Check Wi-Fi, then try again.';
  }
  if (/Voice server is offline|npm run server/i.test(text)) {
    return 'Voice server is offline. Check your connection and try again.';
  }
  if (/Notifications are off/i.test(text)) {
    return 'Notifications are off. Allow alerts so Future Self can wake you.';
  }
  if (/Wake sound|to-alarm-sound|System wake sound/i.test(text)) {
    return 'Could not build the wake sound. Check Wi-Fi and try saving again.';
  }
  if (/No subscription package|RevenueCat/i.test(text)) {
    return 'Subscription is not ready yet. Try Restore, or try again later.';
  }

  // Keep short; strip HTML / huge dumps.
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length > 160) return `${clean.slice(0, 157).trim()}...`;
  return clean || fallback;
}

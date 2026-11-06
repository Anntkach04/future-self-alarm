/** Public legal URLs. Prefer dedicated EXPO_PUBLIC_* overrides; else API host. */

/** Prefixed on every support mailto so sister can filter the inbox. */
export const SUPPORT_SUBJECT_TAG = '[Future Self Alarm]';

function apiOrigin() {
  const raw = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  return raw || '';
}

export function privacyPolicyUrl() {
  return (
    process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() ||
    (apiOrigin() ? `${apiOrigin()}/privacy` : '')
  );
}

export function termsOfUseUrl() {
  return (
    process.env.EXPO_PUBLIC_TERMS_URL?.trim() ||
    (apiOrigin() ? `${apiOrigin()}/terms` : '')
  );
}

/** In-app / web Contact Us form (preferred over raw mailto). */
export function contactUsUrl() {
  return (
    process.env.EXPO_PUBLIC_CONTACT_URL?.trim() ||
    (apiOrigin() ? `${apiOrigin()}/contact` : '')
  );
}

/**
 * Support inbox. Prefer a +tag address so mail sorts cleanly, e.g.
 * `sister@gmail.com` → set `sister+futureself@gmail.com` (Gmail still delivers to sister@).
 */
export function supportEmail() {
  return (
    process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'dyniza@uxdyniza.com'
  );
}

/** Opens Mail with a labeled subject so replies never look like random blog mail. */
export function supportMailtoUrl(topic = 'Support') {
  const email = supportEmail();
  const subject = `${SUPPORT_SUBJECT_TAG} ${topic}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

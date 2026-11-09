/**
 * Server-side subscription check via RevenueCat REST API.
 *
 * Enabled only when REVENUECAT_SECRET_KEY (sk_…) is set — local dev and
 * older deploys keep working without it. The app configures RevenueCat with
 * the Apple user id, which is also our user id, so they line up.
 *
 * Fail-open on RevenueCat outages: an alarm app must not go silent because a
 * third-party API blipped. Fail-closed only on a clear "no active
 * entitlement" answer.
 */

const RC_BASE = 'https://api.revenuecat.com/v1';
const POSITIVE_TTL_MS = 10 * 60 * 1000;
const NEGATIVE_TTL_MS = 2 * 60 * 1000;

const cache = new Map();

function secretKey() {
  return (process.env.REVENUECAT_SECRET_KEY || '').trim();
}

function entitlementId() {
  return (process.env.REVENUECAT_ENTITLEMENT_ID || 'future_self_alarm_pro').trim();
}

function entitlementEnforced() {
  return Boolean(secretKey());
}

/** @returns {boolean} active entitlement in a RevenueCat subscriber payload */
function isActiveIn(payload, id = entitlementId(), now = Date.now()) {
  const ent = payload?.subscriber?.entitlements?.[id];
  if (!ent) return false;
  if (!ent.expires_date) return true; // lifetime / non-expiring
  const expires = Date.parse(ent.expires_date);
  return Number.isFinite(expires) && expires > now;
}

/**
 * @param {string} userId
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<boolean>}
 */
async function hasActiveEntitlement(userId, opts = {}) {
  if (!entitlementEnforced()) return true;
  const id = String(userId || '').trim();
  // Guest sessions never hold a subscription.
  if (!id || id.startsWith('guest_')) return false;

  const hit = cache.get(id);
  if (hit && hit.until > Date.now()) return hit.active;

  const doFetch = opts.fetchImpl || fetch;
  try {
    const res = await doFetch(`${RC_BASE}/subscribers/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      console.warn(`[entitlement] RevenueCat ${res.status} for ${id}; allowing`);
      return true;
    }
    const active = isActiveIn(await res.json());
    cache.set(id, {
      active,
      until: Date.now() + (active ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
    });
    return active;
  } catch (error) {
    console.warn('[entitlement] RevenueCat unreachable; allowing', error?.message || error);
    return true;
  }
}

/** Express middleware: 402 when RevenueCat clearly says "not subscribed". */
function requireEntitlement(req, res, next) {
  if (!entitlementEnforced()) return next();
  hasActiveEntitlement(req.userId)
    .then((active) => {
      if (active) return next();
      return res.status(402).json({
        error: 'Your Future Self membership is not active. Renew it to build new wake messages.',
        code: 'subscription_required',
      });
    })
    .catch(() => next());
}

function clearEntitlementCache() {
  cache.clear();
}

module.exports = {
  entitlementEnforced,
  hasActiveEntitlement,
  isActiveIn,
  requireEntitlement,
  clearEntitlementCache,
};

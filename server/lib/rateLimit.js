/**
 * Small in-memory fixed-window limiter (single Railway instance).
 * Protects ElevenLabs / OpenAI spend from scripted abuse of guest sessions.
 */

const buckets = new Map();
let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < 60 * 1000) return;
  lastSweep = now;
  for (const [key, row] of buckets) {
    if (row.resetAt <= now) buckets.delete(key);
  }
}

/** @returns {{ ok: boolean, retryAfterSec: number }} */
function hit(key, limit, windowMs, now = Date.now()) {
  sweep(now);
  const row = buckets.get(key);
  if (!row || row.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  row.count += 1;
  if (row.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((row.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * @param {string} name bucket name
 * @param {Array<{ limit: number, windowMs: number }>} rules all must pass
 * @param {'user'|'ip'} by key on authenticated user (falls back to IP) or IP
 */
function rateLimit(name, rules, by = 'user') {
  return (req, res, next) => {
    if (process.env.RATE_LIMIT_DISABLED === 'true') return next();
    const who =
      by === 'user' && req.userId ? `u:${req.userId}` : `ip:${req.ip || 'unknown'}`;
    for (const rule of rules) {
      const result = hit(`${name}:${rule.windowMs}:${who}`, rule.limit, rule.windowMs);
      if (!result.ok) {
        res.setHeader('Retry-After', String(result.retryAfterSec));
        console.warn(`[rate-limit] ${name} ${who}`);
        return res.status(429).json({
          error: 'Too many requests. Please wait a bit and try again.',
        });
      }
    }
    return next();
  };
}

function resetRateLimits() {
  buckets.clear();
}

module.exports = { rateLimit, hit, resetRateLimits, HOUR, DAY };

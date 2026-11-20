const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modPath = path.resolve(__dirname, '../lib/entitlement.js');

function load(env = {}) {
  delete require.cache[modPath];
  const prev = { ...process.env };
  Object.assign(process.env, env);
  const mod = require(modPath);
  process.env = prev;
  // Re-apply so calls inside the module see the key.
  Object.assign(process.env, env);
  return mod;
}

const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });

test('without a secret key everything is allowed', async () => {
  delete process.env.REVENUECAT_SECRET_KEY;
  const ent = load();
  assert.equal(ent.entitlementEnforced(), false);
  assert.equal(await ent.hasActiveEntitlement('alice'), true);
});

test('active, expired and missing entitlements', async () => {
  const ent = load({ REVENUECAT_SECRET_KEY: 'sk_test' });
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  const sub = (expires) => ({
    subscriber: { entitlements: { future_self_alarm_pro: { expires_date: expires } } },
  });
  assert.equal(await ent.hasActiveEntitlement('a1', { fetchImpl: ok(sub(future)) }), true);
  assert.equal(await ent.hasActiveEntitlement('a2', { fetchImpl: ok(sub(past)) }), false);
  assert.equal(await ent.hasActiveEntitlement('a3', { fetchImpl: ok({ subscriber: { entitlements: {} } }) }), false);
  assert.equal(await ent.hasActiveEntitlement('a4', { fetchImpl: ok(sub(null)) }), true);
});

test('guests never pass; RevenueCat outages fail open', async () => {
  const ent = load({ REVENUECAT_SECRET_KEY: 'sk_test' });
  assert.equal(await ent.hasActiveEntitlement('guest_abc', { fetchImpl: ok({}) }), false);
  const down = async () => { throw new Error('ECONNRESET'); };
  assert.equal(await ent.hasActiveEntitlement('b1', { fetchImpl: down }), true);
  const err500 = async () => ({ ok: false, status: 500, json: async () => ({}) });
  assert.equal(await ent.hasActiveEntitlement('b2', { fetchImpl: err500 }), true);
  delete process.env.REVENUECAT_SECRET_KEY;
});

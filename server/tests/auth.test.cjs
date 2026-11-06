const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const serverRequire = createRequire(path.join(root, 'server/package.json'));
const jwt = serverRequire('jsonwebtoken');
const secret = 'test-only-signing-secret';

function loadAuth({ env = {}, user = { id: 'alice', profile: {} }, dbError = false } = {}) {
  let upserts = 0;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'server/lib/auth.js'), 'utf8'), {
    module, console,
    process: { env: { NODE_ENV: 'production', JWT_SECRET: secret, ...env } },
    require(name) {
      if (name === './db') return {
        getUser: async () => { if (dbError) throw Error('offline'); return user; },
        upsertUser: async () => { upserts++; return user; },
        updateUser: async () => user,
      };
      if (name === './appleRevoke') return { exchangeAuthorizationCode: async () => null };
      return serverRequire(name);
    },
  });
  return { ...module.exports, upserts: () => upserts };
}
async function authorize(auth, token) {
  const result = { next: false, status: 200 };
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  await auth.requireAuth(req, res, () => { result.next = true; });
  return { ...result, req };
}
const token = () => jwt.sign({ sub: 'alice' }, secret, { issuer: 'future-self-alarm' });

test('production refuses to start without a JWT signing key', () => {
  assert.throws(() => loadAuth({ env: { JWT_SECRET: ' ' } }), /JWT_SECRET/);
});
test('public profile excludes private tokens and cannot overwrite them', () => {
  const auth = loadAuth();
  const profile = { version: 1, answers: { name: 'A' }, appleRefreshToken: 'private', futureSecret: 'private' };
  const publicUser = auth.publicUser({ id: 'alice', profile });
  assert.equal(publicUser.profile.appleRefreshToken, undefined);
  assert.equal(publicUser.profile.futureSecret, undefined);
  assert.equal(publicUser.profile.answers.name, 'A');
  const patch = auth.publicProfile({ appleRefreshToken: 'attacker', version: 1 });
  assert.equal({ ...profile, ...patch }.appleRefreshToken, 'private');
  assert.equal(profile.appleRefreshToken, 'private');
});
test('missing and invalid tokens are denied', async () => {
  for (const value of [undefined, 'invalid']) {
    const result = await authorize(loadAuth(), value);
    assert.equal(result.status, 401);
    assert.equal(result.next, false);
  }
});
test('valid token identifies the existing user', async () => {
  const result = await authorize(loadAuth(), token());
  assert.equal(result.next, true);
  assert.equal(result.req.userId, 'alice');
});
test('stale token never recreates a deleted account', async () => {
  const auth = loadAuth({ user: null });
  const result = await authorize(auth, token());
  assert.equal(result.status, 401);
  assert.equal(auth.upserts(), 0);
});
test('database outage returns a retryable response', async () => {
  const result = await authorize(loadAuth({ dbError: true }), token());
  assert.equal(result.status, 503);
  assert.equal(result.next, false);
});
test('expired and unexpected-algorithm tokens are rejected', async () => {
  for (const options of [{ expiresIn: -1 }, { algorithm: 'HS384' }]) {
    const value = jwt.sign({ sub: 'alice' }, secret, { issuer: 'future-self-alarm', ...options });
    assert.equal((await authorize(loadAuth(), value)).status, 401);
  }
});

function loadClient(fetchImpl) {
  const ts = require(path.join(root, 'node_modules/typescript'));
  const source = fs.readFileSync(path.join(root, 'src/services/apiAuth.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  const storage = new Map();
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console, fetch: fetchImpl, AbortController, setTimeout, clearTimeout,
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'web' } };
      if (name === '@react-native-async-storage/async-storage') return {
        getItem: async key => storage.get(key) ?? null,
        setItem: async (key, value) => storage.set(key, value),
        removeItem: async key => storage.delete(key),
      };
      if (name === './elevenlabs') return { getApiUrl: () => 'https://test.invalid' };
      throw Error(`Unexpected dependency: ${name}`);
    },
  });
  return module.exports;
}
const response = (status, data = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
test('failed deletion retains the session for retry', async () => {
  for (const fetcher of [async () => { throw Error('offline'); }, async () => response(401), async () => response(500)]) {
    const client = loadClient(fetcher);
    await client.setSessionToken('existing');
    await assert.rejects(client.deleteAccountOnServer());
    assert.equal(await client.getSessionToken(), 'existing');
  }
});
test('confirmed deletion and missing account clear the session', async () => {
  for (const status of [200, 404]) {
    const client = loadClient(async () => response(status));
    await client.setSessionToken('existing');
    await client.deleteAccountOnServer();
    assert.equal(await client.getSessionToken(), null);
  }
});
test('missing session cannot claim account deletion succeeded', async () => {
  const client = loadClient(async () => { throw Error('must not fetch'); });
  await assert.rejects(client.deleteAccountOnServer(), /Sign in again/);
});
test('malformed Apple login cannot replace an existing session', async () => {
  for (const data of [{ user: { id: 'alice' } }, { token: 'new' }]) {
    const client = loadClient(async () => response(200, data));
    await client.setSessionToken('existing');
    await assert.rejects(client.signInWithAppleOnServer({ identityToken: 'apple' }));
    assert.equal(await client.getSessionToken(), 'existing');
  }
});
test('valid Apple login saves the new session', async () => {
  const client = loadClient(async () => response(200, { user: { id: 'alice' }, token: 'new', authRequired: true }));
  await client.signInWithAppleOnServer({ identityToken: 'apple' });
  assert.equal(await client.getSessionToken(), 'new');
});

process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(48);
const test = require('node:test');
const assert = require('node:assert');
const { verifyGoogleIdToken } = require('../src/utils/google');

const CID = 'client-123.apps.googleusercontent.com';
const NOW = Date.UTC(2026, 9, 17);
const claims = (over = {}) => ({ aud: CID, iss: 'https://accounts.google.com', exp: String(NOW / 1000 + 600), sub: '1234', email: 'A@Example.test', email_verified: 'true', name: 'Abebe K', ...over });
const fake = (body, ok = true) => async () => ({ ok, json: async () => body });
const run = (body, ok) => verifyGoogleIdToken('x'.repeat(40), { fetchImpl: fake(body, ok), clientId: CID, now: NOW });

test('accepts a valid token and lower-cases the email', async () => {
  const r = await run(claims());
  assert.deepEqual(r, { sub: '1234', email: 'a@example.test', name: 'Abebe K' });
});
test('rejects wrong audience, expired, unverified email, bad issuer, non-200', async () => {
  for (const [body, ok] of [[claims({ aud: 'other' })], [claims({ exp: String(NOW / 1000 - 5) })], [claims({ email_verified: 'false' })],
    [claims({ iss: 'https://evil.test' })], [claims(), false]]) {
    await assert.rejects(() => run(body, ok), /could not be verified/);
  }
});

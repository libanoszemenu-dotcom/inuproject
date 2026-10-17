const env = require('../config/env');
const { AppError } = require('./http');

const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Verify a Google ID token (the "credential" produced by Google Identity Services in the browser).
 * Google validates the signature at its tokeninfo endpoint; we then check that the token was
 * issued for OUR client id, has not expired and carries a verified email address.
 * `fetchImpl` can be replaced in tests.
 */
async function verifyGoogleIdToken(idToken, { fetchImpl = fetch, clientId = env.googleClientId, now = Date.now() } = {}) {
  if (!clientId) throw new AppError(503, 'Google sign-in is not configured on this server');
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 4096) {
    throw new AppError(400, 'Invalid Google credential');
  }
  let res;
  try {
    res = await fetchImpl(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
      signal: AbortSignal.timeout(6000),
    });
  } catch (_) {
    throw new AppError(502, 'Could not reach Google to verify the sign-in. Please try again.');
  }
  if (!res.ok) throw new AppError(401, 'Google sign-in could not be verified');
  const claims = await res.json();

  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  const notExpired = Number(claims.exp) * 1000 > now;
  if (claims.aud !== clientId || !ISSUERS.includes(claims.iss) || !notExpired || !claims.sub || !claims.email || !emailVerified) {
    throw new AppError(401, 'Google sign-in could not be verified');
  }
  return {
    sub: String(claims.sub),
    email: String(claims.email).toLowerCase(),
    name: String(claims.name || claims.email.split('@')[0]).slice(0, 120),
  };
}

module.exports = { verifyGoogleIdToken };

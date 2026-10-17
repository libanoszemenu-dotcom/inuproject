const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query, withTransaction } = require('../config/db');
const { AppError, asyncHandler, ok } = require('../utils/http');
const { audit } = require('../utils/audit');
const { recordLogin } = require('../utils/loginEvents');
const { sendMail } = require('../utils/mailer');
const { verifyGoogleIdToken } = require('../utils/google');

// Used so a login for an unknown email takes about as long as a real one.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function issueToken(res, userId) {
  const token = jwt.sign({}, env.jwtSecret, {
    subject: String(userId),
    expiresIn: `${env.tokenHours}h`,
    algorithm: 'HS256',
  });
  res.cookie('token', token, {
    httpOnly: true, // JavaScript in the browser cannot read it (protects against XSS theft)
    sameSite: 'lax', // not sent on cross-site POSTs (protects against CSRF)
    secure: env.isProduction, // HTTPS only in production
    maxAge: env.tokenHours * 3600 * 1000,
  });
}

const publicUser = (u) => ({
  id: u.id, full_name: u.full_name, email: u.email, role: u.role,
  email_verified: Boolean(u.email_verified_at), department_id: u.department_id || null,
});

/** Create a one-time verification link and email it. Never throws. */
async function sendVerificationEmail(user) {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    await query('UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]);
    await query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?,?, DATE_ADD(NOW(), INTERVAL ? HOUR))',
      [user.id, sha256(token), env.emailTokenHours]
    );
    const link = `${env.clientOrigin}/verify-email?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Verify your email - Injibara University Recruitment Portal',
      text: `Hello ${user.full_name},\n\nPlease confirm your email address to use the Injibara University Recruitment Portal:\n${link}\n\nThe link is valid for ${env.emailTokenHours} hours. If you did not create this account, ignore this message.`,
      html: `<p>Hello ${String(user.full_name).replace(/[<>&]/g, '')},</p><p>Please confirm your email address to use the Injibara University Recruitment Portal:</p><p><a href="${link}">Verify my email</a></p><p>The link is valid for ${env.emailTokenHours} hours. If you did not create this account, ignore this message.</p>`,
    });
  } catch (err) {
    console.error('Verification email failed:', err.message);
  }
}

const USER_SQL = `SELECT u.id, u.full_name, u.email, u.password_hash, u.is_active, u.department_id,
                         u.google_sub, u.email_verified_at, r.code AS role
                    FROM users u JOIN roles r ON r.id = u.role_id`;

exports.register = asyncHandler(async (req, res) => {
  const { full_name, email, password, phone } = req.valid.body;
  const roles = await query("SELECT id FROM roles WHERE code = 'applicant'");
  const hash = await bcrypt.hash(password, 10);

  const userId = await withTransaction(async (conn) => {
    const [r] = await conn.query(
      'INSERT INTO users (role_id, full_name, email, password_hash, phone) VALUES (?,?,?,?,?)',
      [roles[0].id, full_name, email, hash, phone]
    );
    await conn.query('INSERT INTO applicant_profiles (user_id) VALUES (?)', [r.insertId]);
    return r.insertId;
  });

  await audit({ req, userId, action: 'auth.register', entityType: 'user', entityId: userId });
  await sendVerificationEmail({ id: userId, full_name, email });
  issueToken(res, userId);
  return ok(res, { id: userId, full_name, email, role: 'applicant', email_verified: false }, undefined, 201);
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.valid.body;
  const rows = await query(`${USER_SQL} WHERE u.email = ?`, [email]);
  const user = rows[0];
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !passwordOk || !user.is_active) {
    await recordLogin({ req, userId: user ? user.id : null, email, method: 'password', success: false,
      reason: !user ? 'unknown_email' : !user.is_active ? 'inactive' : 'bad_password' });
    throw new AppError(401, 'Invalid email or password'); // same message for every cause
  }

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  await recordLogin({ req, userId: user.id, email, method: 'password', success: true });
  issueToken(res, user.id);
  return ok(res, publicUser(user));
});

/**
 * Sign in (or register) with Google. The browser sends the ID token ("credential") that Google
 * Identity Services produced; the server verifies it and then issues the same HTTP-only JWT cookie.
 */
exports.google = asyncHandler(async (req, res) => {
  let g;
  try {
    g = await verifyGoogleIdToken(req.valid.body.credential);
  } catch (err) {
    await recordLogin({ req, method: 'google', success: false, reason: 'token_rejected' });
    throw err;
  }

  let user = (await query(`${USER_SQL} WHERE u.google_sub = ?`, [g.sub]))[0];
  if (!user) {
    const byEmail = (await query(`${USER_SQL} WHERE u.email = ?`, [g.email]))[0];
    if (byEmail) {
      // Google has verified this email address, so the existing account belongs to this person: link it.
      if (byEmail.google_sub && byEmail.google_sub !== g.sub) {
        await recordLogin({ req, userId: byEmail.id, email: g.email, method: 'google', success: false, reason: 'sub_mismatch' });
        throw new AppError(409, 'This email is already linked to a different Google account');
      }
      await query('UPDATE users SET google_sub = ?, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?', [g.sub, byEmail.id]);
      user = { ...byEmail, google_sub: g.sub, email_verified_at: byEmail.email_verified_at || new Date() };
      await audit({ req, userId: user.id, action: 'auth.google_linked', entityType: 'user', entityId: user.id });
    } else {
      const roles = await query("SELECT id FROM roles WHERE code = 'applicant'");
      const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10); // no usable password
      const newId = await withTransaction(async (conn) => {
        const [r] = await conn.query(
          `INSERT INTO users (role_id, full_name, email, password_hash, auth_provider, google_sub, email_verified_at)
           VALUES (?,?,?,?, 'google', ?, NOW())`,
          [roles[0].id, g.name.length >= 2 ? g.name : 'Applicant', g.email, randomHash, g.sub]
        );
        await conn.query('INSERT INTO applicant_profiles (user_id) VALUES (?)', [r.insertId]);
        return r.insertId;
      });
      await audit({ req, userId: newId, action: 'auth.register', entityType: 'user', entityId: newId, details: { method: 'google' } });
      user = (await query(`${USER_SQL} WHERE u.id = ?`, [newId]))[0];
    }
  }

  if (!user.is_active) {
    await recordLogin({ req, userId: user.id, email: g.email, method: 'google', success: false, reason: 'inactive' });
    throw new AppError(401, 'This account is deactivated');
  }
  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
  await recordLogin({ req, userId: user.id, email: g.email, method: 'google', success: true });
  issueToken(res, user.id);
  return ok(res, publicUser(user));
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const hash = sha256(req.valid.body.token);
  const result = await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id, user_id, expires_at > NOW() AS valid, used_at FROM email_verification_tokens WHERE token_hash = ? FOR UPDATE', [hash]);
    const t = rows[0];
    if (!t || t.used_at || !Number(t.valid)) return null;
    await conn.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?', [t.id]);
    await conn.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?', [t.user_id]);
    return t.user_id;
  });
  if (!result) throw new AppError(400, 'This verification link is invalid or has expired. Request a new one.');
  await audit({ req, userId: result, action: 'auth.email_verified', entityType: 'user', entityId: result });
  return ok(res, { verified: true });
});

exports.resendVerification = asyncHandler(async (req, res) => {
  const [u] = await query('SELECT id, full_name, email, email_verified_at FROM users WHERE id = ?', [req.user.id]);
  if (u.email_verified_at) return ok(res, { already_verified: true });
  await sendVerificationEmail(u);
  await audit({ req, action: 'auth.verification_resent', entityType: 'user', entityId: u.id });
  return ok(res, { sent: true });
});

exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: env.isProduction });
  return ok(res, { message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => ok(res, req.user));

/** Public settings the login page needs (is Google sign-in available?). */
exports.config = asyncHandler(async (req, res) => ok(res, {
  google_client_id: env.googleEnabled ? env.googleClientId : null,
  require_email_verification: env.requireEmailVerification,
}));

exports.changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.valid.body;
  const rows = await query('SELECT password_hash, auth_provider FROM users WHERE id = ?', [req.user.id]);
  const valid = await bcrypt.compare(current_password, rows[0].password_hash);
  if (!valid) throw new AppError(400, rows[0].auth_provider === 'google'
    ? 'This account signs in with Google and has no password to change'
    : 'Current password is incorrect');
  const hash = await bcrypt.hash(new_password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  await audit({ req, action: 'auth.password_changed', entityType: 'user', entityId: req.user.id });
  return ok(res, { message: 'Password changed' });
});

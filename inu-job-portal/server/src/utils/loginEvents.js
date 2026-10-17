const { pool } = require('../config/db');
const { audit } = require('./audit');

/** Record a login attempt in login_events and in the audit log. Never throws. */
async function recordLogin({ req, userId = null, email = null, method, success, reason = null }) {
  try {
    await pool.query(
      `INSERT INTO login_events (user_id, email, method, success, failure_reason, ip_address, user_agent)
       VALUES (?,?,?,?,?,?,?)`,
      [userId, email ? String(email).slice(0, 150) : null, method, success ? 1 : 0, reason, req.ip || null,
        String(req.get('user-agent') || '').slice(0, 255) || null]
    );
  } catch (err) {
    console.error('login_events insert failed:', err.message);
  }
  await audit({
    req, userId, action: success ? 'auth.login' : 'auth.login_failed', entityType: 'user', entityId: userId,
    details: { method, ...(reason ? { reason } : {}) },
  });
}

module.exports = { recordLogin };

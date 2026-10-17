const { pool } = require('../config/db');

/**
 * Write one audit-log row. Never throws: a logging problem must not break the request.
 * Do not put passwords, tokens or document contents in `details`.
 */
async function audit({ req, userId, action, entityType, entityId = null, details = null }) {
  try {
    const uid = userId !== undefined ? userId : req && req.user ? req.user.id : null;
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, details) VALUES (?,?,?,?,?,?)',
      [uid, action, entityType, entityId, req ? req.ip : null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { audit };

const { query } = require('../config/db');
const { asyncHandler, ok, pageMeta } = require('../utils/http');

exports.list = asyncHandler(async (req, res) => {
  const { page, page_size, action, user_id, entity_type } = req.valid.query;
  const where = [];
  const params = [];
  if (action) { where.push('l.action = ?'); params.push(action); }
  if (user_id) { where.push('l.user_id = ?'); params.push(user_id); }
  if (entity_type) { where.push('l.entity_type = ?'); params.push(entity_type); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await query(`SELECT COUNT(*) AS c FROM audit_logs l ${w}`, params))[0].c;
  const rows = await query(
    `SELECT l.id, l.user_id, u.full_name AS user_name, l.action, l.entity_type, l.entity_id,
            l.ip_address, l.details, l.created_at
       FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id ${w}
      ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, page_size, (page - 1) * page_size]
  );
  // MariaDB stores JSON as text, MySQL may return an object: handle both.
  const items = rows.map((r) => {
    let details = r.details;
    if (typeof details === 'string') { try { details = JSON.parse(details); } catch (_) { /* keep text */ } }
    return { ...r, details };
  });
  ok(res, items, pageMeta(page, page_size, total));
});

/** Login events (successful and failed) for the administrator. */
exports.logins = asyncHandler(async (req, res) => {
  const { page, page_size, success, user_id } = req.valid.query;
  const where = [];
  const params = [];
  if (success !== undefined) { where.push('l.success = ?'); params.push(Number(success)); }
  if (user_id) { where.push('l.user_id = ?'); params.push(user_id); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await query(`SELECT COUNT(*) AS c FROM login_events l ${w}`, params))[0].c;
  const items = await query(
    `SELECT l.id, l.user_id, u.full_name AS user_name, l.email, l.method, l.success, l.failure_reason,
            l.ip_address, l.user_agent, l.created_at
       FROM login_events l LEFT JOIN users u ON u.id = l.user_id ${w}
      ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, page_size, (page - 1) * page_size]
  );
  ok(res, items, pageMeta(page, page_size, total));
});

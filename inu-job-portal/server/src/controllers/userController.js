const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/db');
const { AppError, asyncHandler, ok, pageMeta, escapeLike } = require('../utils/http');
const { audit } = require('../utils/audit');

async function assertDepartmentExists(id) {
  const rows = await query('SELECT id FROM departments WHERE id = ?', [id]);
  if (!rows[0]) throw new AppError(400, 'Unknown department', [{ field: 'department_id', message: 'Not found' }]);
}

exports.listRoles = asyncHandler(async (req, res) => {
  ok(res, await query('SELECT id, code, name, description FROM roles ORDER BY id'));
});

exports.list = asyncHandler(async (req, res) => {
  const { page, page_size, q, role, is_active } = req.valid.query;
  const where = [];
  const params = [];
  if (q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
  }
  if (role) { where.push('r.code = ?'); params.push(role); }
  if (is_active !== undefined) { where.push('u.is_active = ?'); params.push(Number(is_active)); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await query(`SELECT COUNT(*) AS c FROM users u JOIN roles r ON r.id = u.role_id ${w}`, params))[0].c;
  const items = await query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.last_login_at, u.created_at, u.department_id, u.email_verified_at IS NOT NULL AS email_verified, r.code AS role
       FROM users u JOIN roles r ON r.id = u.role_id ${w}
      ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
    [...params, page_size, (page - 1) * page_size]
  );
  ok(res, items, pageMeta(page, page_size, total));
});

exports.create = asyncHandler(async (req, res) => {
  const { full_name, email, password, phone, role, department_id } = req.valid.body;
  if (role === 'department_head' && !department_id) {
    throw new AppError(400, 'A Department Head must belong to a department', [{ field: 'department_id', message: 'Select a department' }]);
  }
  if (department_id) await assertDepartmentExists(department_id);
  const roles = await query('SELECT id FROM roles WHERE code = ?', [role]);
  const hash = await bcrypt.hash(password, 10);
  const [r] = await pool.query(
    'INSERT INTO users (role_id, full_name, email, password_hash, phone, department_id, email_verified_at) VALUES (?,?,?,?,?,?, NOW())',
    [roles[0].id, full_name, email, hash, phone, role === 'department_head' ? department_id : null]
  );
  await audit({ req, action: 'user.create', entityType: 'user', entityId: r.insertId, details: { role } });
  ok(res, { id: r.insertId, full_name, email, role }, undefined, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const targetId = req.valid.params.id;
  const { full_name, role, is_active, department_id } = req.valid.body;
  const rows = await query(
    'SELECT u.id, r.code AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
    [targetId]
  );
  const target = rows[0];
  if (!target) throw new AppError(404, 'User not found');

  if (target.role === 'applicant' && role) {
    throw new AppError(400, 'The role of an applicant account cannot be changed');
  }
  if (targetId === req.user.id && ((is_active === false) || (role && role !== target.role))) {
    throw new AppError(400, 'You cannot deactivate your own account or change your own role');
  }

  const sets = [];
  const params = [];
  if (full_name !== undefined) { sets.push('full_name = ?'); params.push(full_name); }
  if (is_active !== undefined) { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (role) {
    const roleRow = await query('SELECT id FROM roles WHERE code = ?', [role]);
    sets.push('role_id = ?');
    params.push(roleRow[0].id);
  }
  if (department_id !== undefined) {
    if (department_id !== null) await assertDepartmentExists(department_id);
    sets.push('department_id = ?');
    params.push(department_id);
  }
  const finalRole = role || target.role;
  if (finalRole === 'department_head') {
    const dept = department_id !== undefined ? department_id : (await query('SELECT department_id FROM users WHERE id = ?', [targetId]))[0].department_id;
    if (!dept) throw new AppError(400, 'A Department Head must belong to a department', [{ field: 'department_id', message: 'Select a department' }]);
  }
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, targetId]);
  await audit({ req, action: 'user.update', entityType: 'user', entityId: targetId, details: { full_name, role, is_active, department_id } });
  ok(res, { id: targetId, updated: true });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const targetId = req.valid.params.id;
  const exists = await query('SELECT id FROM users WHERE id = ?', [targetId]);
  if (!exists[0]) throw new AppError(404, 'User not found');
  const hash = await bcrypt.hash(req.valid.body.new_password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, targetId]);
  await audit({ req, action: 'user.password_reset', entityType: 'user', entityId: targetId });
  ok(res, { message: 'Password reset' });
});

/** Minimal staff directory (id, name, role) so HR can pick Department Heads and panel members. */
exports.directory = asyncHandler(async (req, res) => {
  ok(res, await query(
    `SELECT u.id, u.full_name, r.code AS role, u.department_id
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.is_active = 1 AND r.code IN ('department_head','hr_officer') ORDER BY u.full_name`
  ));
});

const { query, pool } = require('../config/db');
const { AppError, asyncHandler, ok } = require('../utils/http');
const { audit } = require('../utils/audit');

exports.list = asyncHandler(async (req, res) => {
  ok(res, await query(
    `SELECT d.id, d.name,
            (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) AS staff_count,
            (SELECT COUNT(*) FROM job_vacancies v WHERE v.department_id = d.id) AS vacancy_count
       FROM departments d ORDER BY d.name`));
});

exports.create = asyncHandler(async (req, res) => {
  const [r] = await pool.query('INSERT INTO departments (name) VALUES (?)', [req.valid.body.name]);
  await audit({ req, action: 'department.create', entityType: 'department', entityId: r.insertId });
  ok(res, { id: r.insertId, name: req.valid.body.name }, undefined, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const [r] = await pool.query('UPDATE departments SET name = ? WHERE id = ?', [req.valid.body.name, req.valid.params.id]);
  if (!r.affectedRows) throw new AppError(404, 'Department not found');
  await audit({ req, action: 'department.update', entityType: 'department', entityId: req.valid.params.id });
  ok(res, { id: req.valid.params.id, name: req.valid.body.name });
});

exports.remove = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const used = await query('SELECT (SELECT COUNT(*) FROM job_vacancies WHERE department_id = ?) AS v', [id]);
  if (used[0].v) throw new AppError(409, 'This department has vacancies and cannot be deleted');
  const [r] = await pool.query('DELETE FROM departments WHERE id = ?', [id]);
  if (!r.affectedRows) throw new AppError(404, 'Department not found');
  await audit({ req, action: 'department.delete', entityType: 'department', entityId: id });
  ok(res, { id, deleted: true });
});

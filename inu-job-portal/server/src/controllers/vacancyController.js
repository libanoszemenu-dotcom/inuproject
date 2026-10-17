const crypto = require('crypto');
const env = require('../config/env');
const { query, pool, withTransaction } = require('../config/db');
const { AppError, asyncHandler, ok, pageMeta, escapeLike } = require('../utils/http');
const { audit } = require('../utils/audit');

// ---------- helpers ----------
async function assertFuture(dateTimeString) {
  const rows = await query('SELECT ? > NOW() AS ok', [dateTimeString]);
  if (!rows[0].ok) throw new AppError(400, 'The deadline must be in the future', [{ field: 'deadline_at', message: 'Must be in the future' }]);
}

async function resolveDocumentTypeIds(codes) {
  const unique = [...new Set(codes)];
  const rows = await query('SELECT id, code FROM document_types WHERE code IN (?)', [unique]);
  if (rows.length !== unique.length) {
    const known = new Set(rows.map((r) => r.code));
    const unknown = unique.filter((c) => !known.has(c));
    throw new AppError(400, 'Unknown document type', unknown.map((c) => ({ field: 'required_document_codes', message: `Unknown code: ${c}` })));
  }
  return rows.map((r) => r.id);
}

async function assertDepartment(id) {
  const rows = await query('SELECT id FROM departments WHERE id = ?', [id]);
  if (!rows[0]) throw new AppError(400, 'Unknown department', [{ field: 'department_id', message: 'Not found' }]);
}

async function saveSkills(conn, vacancyId, skills) {
  await conn.query('DELETE FROM vacancy_skills WHERE vacancy_id = ?', [vacancyId]);
  if (skills.length) await conn.query('INSERT INTO vacancy_skills (vacancy_id, name) VALUES ?', [skills.map((s) => [vacancyId, s])]);
}

const isStaff = (user) => user && ['hr_officer', 'admin'].includes(user.role);

/** Move a vacancy from one status to another; fails (409) if someone else changed it first. */
async function moveStatus(id, fromStatus, setSql, params) {
  const [r] = await pool.query(`UPDATE job_vacancies SET ${setSql} WHERE id = ? AND status = ?`, [...params, id, fromStatus]);
  if (r.affectedRows === 0) {
    const exists = await query('SELECT status FROM job_vacancies WHERE id = ?', [id]);
    if (!exists[0]) throw new AppError(404, 'Vacancy not found');
    throw new AppError(409, `Vacancy is "${exists[0].status}", expected "${fromStatus}"`);
  }
}

// ---------- public ----------
exports.listPublic = asyncHandler(async (req, res) => {
  const { page, page_size, q, department_id, category, employment_type } = req.valid.query;
  const where = ["v.status = 'published'", 'v.deadline_at > NOW()'];
  const params = [];
  if (q) {
    where.push('(v.title LIKE ? OR v.description LIKE ?)');
    params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
  }
  if (department_id) { where.push('v.department_id = ?'); params.push(department_id); }
  if (category) { where.push('v.category = ?'); params.push(category); }
  if (employment_type) { where.push('v.employment_type = ?'); params.push(employment_type); }
  const w = where.join(' AND ');

  const total = (await query(`SELECT COUNT(*) AS c FROM job_vacancies v WHERE ${w}`, params))[0].c;
  const items = await query(
    `SELECT v.id, v.reference_no, v.title, v.category, v.employment_type, v.positions_count,
            v.location, v.deadline_at, v.published_at, d.name AS department
       FROM job_vacancies v JOIN departments d ON d.id = v.department_id
      WHERE ${w} ORDER BY v.published_at DESC, v.id DESC LIMIT ? OFFSET ?`,
    [...params, page_size, (page - 1) * page_size]
  );
  ok(res, items, pageMeta(page, page_size, total));
});

exports.getOne = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const rows = await query(
    `SELECT v.*, d.name AS department,
            (v.status = 'published' AND v.deadline_at > NOW()) AS is_open
       FROM job_vacancies v JOIN departments d ON d.id = v.department_id WHERE v.id = ?`,
    [id]
  );
  const v = rows[0];
  const publiclyVisible = v && ['published', 'closed'].includes(v.status);
  if (!v || (!publiclyVisible && !isStaff(req.user))) throw new AppError(404, 'Vacancy not found');

  const docs = await query(
    `SELECT dt.code, dt.name, vrd.is_mandatory
       FROM vacancy_required_documents vrd JOIN document_types dt ON dt.id = vrd.document_type_id
      WHERE vrd.vacancy_id = ? ORDER BY dt.id`,
    [id]
  );

  const data = {
    id: v.id, reference_no: v.reference_no, title: v.title, department: v.department,
    category: v.category, employment_type: v.employment_type, description: v.description,
    qualifications: v.qualifications, positions_count: v.positions_count, location: v.location,
    deadline_at: v.deadline_at, published_at: v.published_at, status: v.status,
    is_open: Boolean(Number(v.is_open)), required_documents: docs,
    required_skills: (await query('SELECT name FROM vacancy_skills WHERE vacancy_id = ? ORDER BY name', [id])).map((r) => r.name),
  };

  if (isStaff(req.user)) {
    data.department_id = v.department_id;
    data.created_by = v.created_by;
    data.approved_by = v.approved_by;
    data.applications_count = (await query('SELECT COUNT(*) AS c FROM applications WHERE vacancy_id = ?', [id]))[0].c;
  }
  if (req.user && req.user.role === 'applicant') {
    const mine = await query('SELECT id, status FROM applications WHERE vacancy_id = ? AND applicant_id = ?', [id, req.user.id]);
    data.my_application = mine[0] || null;
  }
  ok(res, data);
});

// ---------- staff ----------
exports.listManage = asyncHandler(async (req, res) => {
  const { page, page_size, q, status } = req.valid.query;
  const where = [];
  const params = [];
  if (q) {
    where.push('(v.title LIKE ? OR v.reference_no LIKE ?)');
    params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
  }
  if (status) { where.push('v.status = ?'); params.push(status); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await query(`SELECT COUNT(*) AS c FROM job_vacancies v ${w}`, params))[0].c;
  const items = await query(
    `SELECT v.id, v.reference_no, v.title, v.category, v.employment_type, v.status, v.deadline_at,
            v.positions_count, v.created_at, d.name AS department,
            (SELECT COUNT(*) FROM applications a WHERE a.vacancy_id = v.id) AS applications_count
       FROM job_vacancies v JOIN departments d ON d.id = v.department_id ${w}
      ORDER BY v.created_at DESC, v.id DESC LIMIT ? OFFSET ?`,
    [...params, page_size, (page - 1) * page_size]
  );
  ok(res, items, pageMeta(page, page_size, total));
});

exports.create = asyncHandler(async (req, res) => {
  const b = req.valid.body;
  await assertFuture(b.deadline_at);
  await assertDepartment(b.department_id);
  const docIds = await resolveDocumentTypeIds(b.required_document_codes);

  const vacancyId = await withTransaction(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO job_vacancies
         (reference_no, title, department_id, category, employment_type, description, qualifications,
          positions_count, location, status, deadline_at, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,'draft',?,?)`,
      [`TMP-${crypto.randomUUID()}`, b.title, b.department_id, b.category, b.employment_type,
        b.description, b.qualifications, b.positions_count, b.location, b.deadline_at, req.user.id]
    );
    const vid = r.insertId;
    const ref = `VAC-${new Date().getFullYear()}-${String(vid).padStart(4, '0')}`;
    await conn.query('UPDATE job_vacancies SET reference_no = ? WHERE id = ?', [ref, vid]);
    await conn.query('INSERT INTO vacancy_required_documents (vacancy_id, document_type_id, is_mandatory) VALUES ?', [
      docIds.map((d) => [vid, d, 1]),
    ]);
    await saveSkills(conn, vid, b.required_skills);
    return vid;
  });

  await audit({ req, action: 'vacancy.create', entityType: 'job_vacancy', entityId: vacancyId });
  ok(res, { id: vacancyId }, undefined, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const b = req.valid.body;
  await assertFuture(b.deadline_at);
  await assertDepartment(b.department_id);
  const docIds = await resolveDocumentTypeIds(b.required_document_codes);

  await withTransaction(async (conn) => {
    const [r] = await conn.query(
      `UPDATE job_vacancies SET title=?, department_id=?, category=?, employment_type=?, description=?,
              qualifications=?, positions_count=?, location=?, deadline_at=?
        WHERE id = ? AND status = 'draft'`,
      [b.title, b.department_id, b.category, b.employment_type, b.description, b.qualifications,
        b.positions_count, b.location, b.deadline_at, id]
    );
    if (r.affectedRows === 0) {
      const ex = await conn.query('SELECT status FROM job_vacancies WHERE id = ?', [id]);
      if (!ex[0][0]) throw new AppError(404, 'Vacancy not found');
      throw new AppError(409, 'Only draft vacancies can be edited');
    }
    await conn.query('DELETE FROM vacancy_required_documents WHERE vacancy_id = ?', [id]);
    await conn.query('INSERT INTO vacancy_required_documents (vacancy_id, document_type_id, is_mandatory) VALUES ?', [
      docIds.map((d) => [id, d, 1]),
    ]);
    await saveSkills(conn, id, b.required_skills);
  });
  await audit({ req, action: 'vacancy.update', entityType: 'job_vacancy', entityId: id });
  ok(res, { id, updated: true });
});

exports.remove = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const [r] = await pool.query("DELETE FROM job_vacancies WHERE id = ? AND status = 'draft'", [id]);
  if (r.affectedRows === 0) throw new AppError(409, 'Only draft vacancies can be deleted');
  await audit({ req, action: 'vacancy.delete', entityType: 'job_vacancy', entityId: id });
  ok(res, { id, deleted: true });
});

/** Draft -> pending approval (or straight to published when approval is switched off). */
exports.submit = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const rows = await query('SELECT deadline_at FROM job_vacancies WHERE id = ?', [id]);
  if (!rows[0]) throw new AppError(404, 'Vacancy not found');
  await assertFuture(rows[0].deadline_at);

  if (env.requireVacancyApproval) {
    await moveStatus(id, 'draft', "status = 'pending_approval'", []);
    await audit({ req, action: 'vacancy.submit', entityType: 'job_vacancy', entityId: id });
    return ok(res, { id, status: 'pending_approval' });
  }
  await moveStatus(id, 'draft', "status = 'published', published_at = NOW(), approved_by = ?", [req.user.id]);
  await audit({ req, action: 'vacancy.publish', entityType: 'job_vacancy', entityId: id });
  ok(res, { id, status: 'published' });
});

function requireApprover(req) {
  if (!env.vacancyApproverRoles.includes(req.user.role)) {
    throw new AppError(403, 'Your role is not allowed to approve vacancies');
  }
}

exports.approve = asyncHandler(async (req, res) => {
  requireApprover(req);
  const id = req.valid.params.id;
  const rows = await query('SELECT deadline_at FROM job_vacancies WHERE id = ?', [id]);
  if (!rows[0]) throw new AppError(404, 'Vacancy not found');
  await assertFuture(rows[0].deadline_at);
  await moveStatus(id, 'pending_approval', "status = 'published', published_at = NOW(), approved_by = ?", [req.user.id]);
  await audit({ req, action: 'vacancy.approve', entityType: 'job_vacancy', entityId: id });
  ok(res, { id, status: 'published' });
});

exports.returnToDraft = asyncHandler(async (req, res) => {
  requireApprover(req);
  const id = req.valid.params.id;
  await moveStatus(id, 'pending_approval', "status = 'draft'", []);
  await audit({ req, action: 'vacancy.return_to_draft', entityType: 'job_vacancy', entityId: id, details: { reason: req.valid.body.reason } });
  ok(res, { id, status: 'draft' });
});

exports.close = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  await moveStatus(id, 'published', "status = 'closed', closed_at = NOW()", []);
  await audit({ req, action: 'vacancy.close', entityType: 'job_vacancy', entityId: id });
  ok(res, { id, status: 'closed' });
});

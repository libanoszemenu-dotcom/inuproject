const crypto = require('crypto');
const { query, pool, withTransaction } = require('../config/db');
const { AppError, asyncHandler, ok, pageMeta, escapeLike } = require('../utils/http');
const { audit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { detectFileType, storeFile, removeFile, safeOriginalName } = require('../utils/files');
const { manualTransitionsFor, applyStatusChange, cancelOpenInterviews } = require('../utils/statusWorkflow');
const { departmentHeadScope, departmentHeadCanSee } = require('../utils/access');
const { loadLists } = require('./profileController');
const env = require('../config/env');

const STATUS_TEXT = {
  under_review: 'Your application is now under review.',
  screened: 'Your application has passed the initial screening.',
  shortlisted: 'Good news: you have been shortlisted.',
  selected: 'Congratulations: you have been selected for this position.',
  rejected: 'Your application was not successful.',
  withdrawn: 'Your application has been withdrawn.',
};

// ---------- access control ----------
/**
 * Load an application only if the caller is allowed to see it.
 * Applicants: their own. HR officers: all. Department Heads: assigned ones and those of their own department.
 * Administrators: none (they manage accounts, not applicant data).
 * Unauthorized callers get 404 so we do not reveal which ids exist.
 */
async function loadAccessible(user, applicationId) {
  const rows = await query(
    `SELECT a.*, v.title AS vacancy_title, v.reference_no AS vacancy_reference
       FROM applications a JOIN job_vacancies v ON v.id = a.vacancy_id WHERE a.id = ?`,
    [applicationId]
  );
  const app = rows[0];
  if (!app) throw new AppError(404, 'Application not found');

  if (user.role === 'applicant') {
    if (app.applicant_id !== user.id) throw new AppError(404, 'Application not found');
  } else if (user.role === 'department_head') {
    if (!(await departmentHeadCanSee(user.id, applicationId))) throw new AppError(404, 'Application not found');
  } else if (user.role !== 'hr_officer') {
    throw new AppError(403, 'You do not have permission to view applications');
  }
  return app;
}

// ---------- applicant: submit ----------
exports.create = asyncHandler(async (req, res) => {
  const { vacancy_id, cover_note } = req.valid.body;
  const files = req.files || [];
  if (env.requireEmailVerification && !req.user.email_verified) {
    throw new AppError(403, 'Please verify your email address before applying. Check your inbox for the verification link.');
  }

  const vac = await query("SELECT id, title FROM job_vacancies WHERE id = ? AND status = 'published' AND deadline_at > NOW()", [vacancy_id]);
  if (!vac[0]) throw new AppError(404, 'This vacancy is not open for applications');

  const docs = await query(
    `SELECT dt.id, dt.code, dt.name, vrd.is_mandatory
       FROM vacancy_required_documents vrd JOIN document_types dt ON dt.id = vrd.document_type_id
      WHERE vrd.vacancy_id = ?`,
    [vacancy_id]
  );
  const byCode = new Map(docs.map((d) => [d.code, d]));

  const seen = new Set();
  for (const f of files) {
    if (!byCode.has(f.fieldname)) throw new AppError(400, `Unexpected document field "${f.fieldname}" for this vacancy`);
    if (seen.has(f.fieldname)) throw new AppError(400, `Only one file is allowed for "${f.fieldname}"`);
    seen.add(f.fieldname);
  }
  const missing = docs.filter((d) => d.is_mandatory && !seen.has(d.code));
  if (missing.length) {
    throw new AppError(400, 'Required documents are missing', missing.map((d) => ({ field: d.code, message: `${d.name} is required` })));
  }

  const dup = await query('SELECT id FROM applications WHERE vacancy_id = ? AND applicant_id = ?', [vacancy_id, req.user.id]);
  if (dup[0]) throw new AppError(409, 'You have already applied for this vacancy');

  // Check the real content of every file before storing anything.
  const prepared = files.map((f) => {
    const detected = detectFileType(f.buffer);
    const doc = byCode.get(f.fieldname);
    if (!detected) throw new AppError(400, `"${doc.name}" must be a valid PDF, JPEG or PNG file`, [{ field: f.fieldname, message: 'Invalid file content' }]);
    return { file: f, doc, mime: detected.mime };
  });

  const saved = [];
  try {
    for (const p of prepared) saved.push({ ...p, storedName: await storeFile(p.file.buffer) });

    const applicationId = await withTransaction(async (conn) => {
      const [r] = await conn.query(
        'INSERT INTO applications (application_no, vacancy_id, applicant_id, cover_note) VALUES (?,?,?,?)',
        [`TMP-${crypto.randomUUID()}`, vacancy_id, req.user.id, cover_note]
      );
      const appId = r.insertId;
      await conn.query('UPDATE applications SET application_no = ? WHERE id = ?', [`APP-${new Date().getFullYear()}-${String(appId).padStart(5, '0')}`, appId]);
      await conn.query(
        "INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, reason) VALUES (?, NULL, 'submitted', ?, 'Application submitted')",
        [appId, req.user.id]
      );
      for (const s of saved) {
        await conn.query(
          `INSERT INTO application_documents (application_id, document_type_id, original_name, stored_name, mime_type, size_bytes)
           VALUES (?,?,?,?,?,?)`,
          [appId, s.doc.id, safeOriginalName(s.file.originalname), s.storedName, s.mime, s.file.size]
        );
      }
      await notify(conn, req.user.id, appId, 'Application received', `Your application for "${vac[0].title}" was submitted successfully.`);
      return appId;
    });

    await audit({ req, action: 'application.submit', entityType: 'application', entityId: applicationId, details: { vacancy_id } });
    ok(res, { id: applicationId, status: 'submitted' }, undefined, 201);
  } catch (err) {
    await Promise.all(saved.map((s) => removeFile(s.storedName))); // do not leave orphan files
    throw err;
  }
});

// ---------- lists ----------
exports.listMine = asyncHandler(async (req, res) => {
  const { page, page_size } = req.valid.query;
  const total = (await query('SELECT COUNT(*) AS c FROM applications WHERE applicant_id = ?', [req.user.id]))[0].c;
  const items = await query(
    `SELECT a.id, a.application_no, a.status, a.submitted_at, a.updated_at, a.vacancy_id,
            v.title AS vacancy_title, v.reference_no AS vacancy_reference
       FROM applications a JOIN job_vacancies v ON v.id = a.vacancy_id
      WHERE a.applicant_id = ? ORDER BY a.submitted_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    [req.user.id, page_size, (page - 1) * page_size]
  );
  ok(res, items, pageMeta(page, page_size, total));
});

exports.listStaff = asyncHandler(async (req, res) => {
  const { page, page_size, status, vacancy_id, q } = req.valid.query;
  const where = [];
  const params = [];
  if (req.user.role === 'department_head') {
    const scope = departmentHeadScope(req.user.id, 'a');
    where.push(scope.sql);
    params.push(...scope.params);
  }
  if (status) { where.push('a.status = ?'); params.push(status); }
  if (vacancy_id) { where.push('a.vacancy_id = ?'); params.push(vacancy_id); }
  if (q) {
    where.push('(u.full_name LIKE ? OR a.application_no LIKE ?)');
    params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await query(`SELECT COUNT(*) AS c FROM applications a JOIN users u ON u.id = a.applicant_id ${w}`, params))[0].c;
  const items = await query(
    `SELECT a.id, a.application_no, a.status, a.submitted_at, a.updated_at, a.vacancy_id,
            v.title AS vacancy_title, v.reference_no AS vacancy_reference,
            u.full_name AS applicant_name, u.email AS applicant_email
       FROM applications a
       JOIN job_vacancies v ON v.id = a.vacancy_id
       JOIN users u ON u.id = a.applicant_id ${w}
      ORDER BY a.submitted_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    [...params, page_size, (page - 1) * page_size]
  );
  if (req.user.role === 'department_head') items.forEach((i) => delete i.applicant_email); // data minimization
  ok(res, items, pageMeta(page, page_size, total));
});

// ---------- details ----------
exports.getOne = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const app = await loadAccessible(req.user, id);
  const isApplicant = req.user.role === 'applicant';
  const isHr = req.user.role === 'hr_officer';

  const [documents, history, interviews] = await Promise.all([
    query(
      `SELECT d.id, dt.name AS type_name, dt.code AS type_code, d.original_name, d.mime_type, d.size_bytes, d.uploaded_at
         FROM application_documents d JOIN document_types dt ON dt.id = d.document_type_id
        WHERE d.application_id = ? ORDER BY dt.id`,
      [id]
    ),
    query(
      isApplicant
        ? `SELECT h.from_status, h.to_status, h.reason, h.changed_at FROM application_status_history h
            WHERE h.application_id = ? ORDER BY h.id`
        : `SELECT h.from_status, h.to_status, h.reason, h.changed_at, u.full_name AS changed_by_name
             FROM application_status_history h JOIN users u ON u.id = h.changed_by
            WHERE h.application_id = ? ORDER BY h.id`,
      [id]
    ),
    query(
      `SELECT id, scheduled_at, duration_minutes, location, mode, status, notes FROM interviews WHERE application_id = ? ORDER BY scheduled_at`,
      [id]
    ),
  ]);

  const data = {
    id: app.id, application_no: app.application_no, status: app.status, cover_note: app.cover_note,
    submitted_at: app.submitted_at, updated_at: app.updated_at,
    vacancy: { id: app.vacancy_id, title: app.vacancy_title, reference_no: app.vacancy_reference },
    documents, history, interviews,
  };

  if (!isApplicant) {
    const applicant = await query(
      `SELECT u.id, u.full_name, u.email, u.phone, p.date_of_birth, p.city, p.highest_education,
              p.field_of_study, p.years_experience, p.summary
         FROM users u LEFT JOIN applicant_profiles p ON p.user_id = u.id WHERE u.id = ?`,
      [app.applicant_id]
    );
    data.applicant = applicant[0];
    if (req.user.role === 'department_head') delete data.applicant.email;
    Object.assign(data.applicant, await loadLists(app.applicant_id));

    // Information for the human reviewer only: which required skills does the applicant list?
    const required = (await query('SELECT name FROM vacancy_skills WHERE vacancy_id = ? ORDER BY name', [app.vacancy_id])).map((r) => r.name);
    const have = new Set(data.applicant.skills.map((s) => s.toLowerCase()));
    data.skill_match = {
      required,
      matched: required.filter((s) => have.has(s.toLowerCase())),
      missing: required.filter((s) => !have.has(s.toLowerCase())),
    };

    data.evaluations = await query(
      `SELECT e.id, e.stage, e.score, e.recommendation, e.comments, e.created_at, u.full_name AS evaluator_name
         FROM screening_evaluations e JOIN users u ON u.id = e.evaluator_id
        WHERE e.application_id = ? ORDER BY e.created_at`,
      [id]
    );
    data.interviews = await Promise.all(
      interviews.map(async (iv) => ({
        ...iv,
        panel: await query(
          `SELECT p.user_id, u.full_name, p.score, p.feedback, p.submitted_at
             FROM interview_panel_members p JOIN users u ON u.id = p.user_id WHERE p.interview_id = ?`,
          [iv.id]
        ),
      }))
    );
  }
  if (!isApplicant) data.allowed_next_statuses = manualTransitionsFor(req.user.role, app.status);
  if (isHr) {
    data.assignments = await query(
      `SELECT s.reviewer_id, u.full_name, s.assigned_at
         FROM application_assignments s JOIN users u ON u.id = s.reviewer_id WHERE s.application_id = ?`,
      [id]
    );
  }
  ok(res, data);
});

// ---------- HR and Department Head: status changes ----------
exports.changeStatus = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const { to_status, reason } = req.valid.body;
  await loadAccessible(req.user, id); // a Department Head can only act on applications of the own department / assigned

  const applicantId = await withTransaction(async (conn) => {
    await applyStatusChange(conn, { applicationId: id, to: to_status, userId: req.user.id, reason: reason || null, manual: true, role: req.user.role });
    if (to_status === 'rejected') await cancelOpenInterviews(conn, id);
    const [rows] = await conn.query('SELECT applicant_id FROM applications WHERE id = ?', [id]);
    const text = STATUS_TEXT[to_status] + (to_status === 'rejected' && reason ? ` Reason: ${reason}` : '');
    await notify(conn, rows[0].applicant_id, id, 'Application status updated', text);
    return rows[0].applicant_id;
  });

  await audit({ req, action: 'application.status_change', entityType: 'application', entityId: id, details: { to_status, applicant_id: applicantId, by_role: req.user.role } });
  ok(res, { id, status: to_status });
});

// ---------- applicant: withdraw ----------
exports.withdraw = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const reason = req.valid.body.reason || null;
  await loadAccessible(req.user, id); // ownership check

  await withTransaction(async (conn) => {
    await applyStatusChange(conn, { applicationId: id, to: 'withdrawn', userId: req.user.id, reason });
    await cancelOpenInterviews(conn, id);
  });
  await audit({ req, action: 'application.withdraw', entityType: 'application', entityId: id });
  ok(res, { id, status: 'withdrawn' });
});

// ---------- HR: assign Department Head reviewers ----------
exports.assign = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const { reviewer_id } = req.valid.body;
  await loadAccessible(req.user, id);
  const reviewer = await query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.is_active = 1 AND r.code = 'department_head'`,
    [reviewer_id]
  );
  if (!reviewer[0]) throw new AppError(400, 'Reviewer must be an active Department Head');
  await query('INSERT IGNORE INTO application_assignments (application_id, reviewer_id, assigned_by) VALUES (?,?,?)', [id, reviewer_id, req.user.id]);
  await audit({ req, action: 'application.assign', entityType: 'application', entityId: id, details: { reviewer_id } });
  ok(res, { application_id: id, reviewer_id }, undefined, 201);
});

exports.unassign = asyncHandler(async (req, res) => {
  const { id, reviewerId } = req.valid.params;
  await loadAccessible(req.user, id);
  await query('DELETE FROM application_assignments WHERE application_id = ? AND reviewer_id = ?', [id, reviewerId]);
  await audit({ req, action: 'application.unassign', entityType: 'application', entityId: id, details: { reviewer_id: reviewerId } });
  ok(res, { application_id: id, reviewer_id: reviewerId, removed: true });
});

// ---------- evaluations ----------
exports.evaluate = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const { stage, score, recommendation, comments } = req.valid.body;
  const app = await loadAccessible(req.user, id);

  if (['selected', 'rejected', 'withdrawn'].includes(app.status)) {
    throw new AppError(409, 'This application is closed and can no longer be evaluated');
  }
  if (req.user.role === 'department_head' && stage !== 'department_head') {
    throw new AppError(403, 'Department Heads can only record department evaluations');
  }
  if (req.user.role === 'hr_officer' && stage === 'department_head') {
    throw new AppError(403, 'Department evaluations are recorded by Department Heads');
  }

  const [r] = await pool.query(
    'INSERT INTO screening_evaluations (application_id, evaluator_id, stage, score, recommendation, comments) VALUES (?,?,?,?,?,?)',
    [id, req.user.id, stage, score, recommendation, comments]
  );
  await audit({ req, action: 'application.evaluate', entityType: 'application', entityId: id, details: { stage, recommendation } });
  ok(res, { id: r.insertId }, undefined, 201);
});

const { query, pool, withTransaction } = require('../config/db');
const { AppError, asyncHandler, ok, pageMeta } = require('../utils/http');
const { audit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { applyStatusChange } = require('../utils/statusWorkflow');
const { assertNoConflicts, findConflicts, describeConflicts } = require('../utils/scheduling');
const { departmentHeadScope } = require('../utils/access');

exports.create = asyncHandler(async (req, res) => {
  const b = req.valid.body;

  const panel = await query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id IN (?) AND u.is_active = 1 AND r.code IN ('department_head','hr_officer')`,
    [b.panel_member_ids]
  );
  if (panel.length !== b.panel_member_ids.length) {
    throw new AppError(400, 'Panel members must be active Department Heads or HR officers');
  }

  const interviewId = await withTransaction(async (conn) => {
    const [apps] = await conn.query('SELECT applicant_id, status FROM applications WHERE id = ? FOR UPDATE', [b.application_id]);
    if (!apps[0]) throw new AppError(404, 'Application not found');
    if (apps[0].status !== 'shortlisted') {
      throw new AppError(409, 'Interviews can only be scheduled for shortlisted applicants');
    }
    const [[chk]] = await conn.query('SELECT ? > NOW() AS ok', [b.scheduled_at]);
    if (!chk.ok) throw new AppError(400, 'The interview time must be in the future', [{ field: 'scheduled_at', message: 'Must be in the future' }]);

    // nobody (panel member or applicant) may be booked twice at overlapping times
    await assertNoConflicts(conn, {
      scheduledAt: b.scheduled_at, durationMinutes: b.duration_minutes,
      panelIds: b.panel_member_ids, applicantId: apps[0].applicant_id,
    });

    const [r] = await conn.query(
      'INSERT INTO interviews (application_id, scheduled_at, duration_minutes, location, mode, notes, scheduled_by) VALUES (?,?,?,?,?,?,?)',
      [b.application_id, b.scheduled_at, b.duration_minutes, b.location, b.mode, b.notes, req.user.id]
    );
    await conn.query('INSERT INTO interview_panel_members (interview_id, user_id) VALUES ?', [
      b.panel_member_ids.map((uid) => [r.insertId, uid]),
    ]);
    // panel members can open the application they will interview for
    await conn.query('INSERT IGNORE INTO application_assignments (application_id, reviewer_id, assigned_by) VALUES ?', [
      b.panel_member_ids.map((uid) => [b.application_id, uid, req.user.id]),
    ]);
    await applyStatusChange(conn, { applicationId: b.application_id, to: 'interview_scheduled', userId: req.user.id, reason: 'Interview scheduled' });

    await notify(conn, apps[0].applicant_id, b.application_id, 'Interview scheduled',
      `Your interview is on ${b.scheduled_at.slice(0, 16)} at ${b.location} (${b.mode === 'online' ? 'online' : 'in person'}).`);
    for (const uid of b.panel_member_ids) {
      if (uid !== req.user.id) {
        await notify(conn, uid, b.application_id, 'Interview panel assignment', `You are on the panel for an interview on ${b.scheduled_at.slice(0, 16)}.`);
      }
    }
    return r.insertId;
  });

  await audit({ req, action: 'interview.schedule', entityType: 'interview', entityId: interviewId, details: { application_id: b.application_id } });
  ok(res, { id: interviewId }, undefined, 201);
});

/** Preview: which bookings would collide with a proposed interview? (nothing is saved) */
exports.checkConflicts = asyncHandler(async (req, res) => {
  const b = req.valid.body;
  const apps = await query('SELECT applicant_id FROM applications WHERE id = ?', [b.application_id]);
  if (!apps[0]) throw new AppError(404, 'Application not found');
  const conflicts = await findConflicts(pool, {
    scheduledAt: b.scheduled_at, durationMinutes: b.duration_minutes,
    panelIds: b.panel_member_ids, applicantId: apps[0].applicant_id,
  });
  ok(res, { has_conflicts: conflicts.length > 0, conflicts: describeConflicts(conflicts) });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, page_size, status, upcoming } = req.valid.query;
  const where = [];
  const params = [];
  if (req.user.role === 'applicant') { where.push('a.applicant_id = ?'); params.push(req.user.id); }
  else if (req.user.role === 'department_head') {
    // interviews where they sit on the panel, or for applications of their own department
    const scope = departmentHeadScope(req.user.id, 'a');
    where.push(`(i.id IN (SELECT interview_id FROM interview_panel_members WHERE user_id = ?) OR ${scope.sql})`);
    params.push(req.user.id, ...scope.params);
  } // HR officers see all
  if (status) { where.push('i.status = ?'); params.push(status); }
  if (upcoming === 'true') where.push("i.scheduled_at >= NOW() AND i.status = 'scheduled'");
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const base = `FROM interviews i
       JOIN applications a ON a.id = i.application_id
       JOIN job_vacancies v ON v.id = a.vacancy_id
       JOIN users u ON u.id = a.applicant_id ${w}`;
  const total = (await query(`SELECT COUNT(*) AS c ${base}`, params))[0].c;
  const items = await query(
    `SELECT i.id, i.application_id, i.scheduled_at, i.duration_minutes, i.location, i.mode, i.status, i.notes,
            a.application_no, v.title AS vacancy_title, u.full_name AS applicant_name
       ${base} ORDER BY i.scheduled_at DESC LIMIT ? OFFSET ?`,
    [...params, page_size, (page - 1) * page_size]
  );
  if (req.user.role === 'applicant') items.forEach((i) => delete i.applicant_name);
  ok(res, items, pageMeta(page, page_size, total));
});

exports.cancel = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT i.status, i.application_id, a.applicant_id FROM interviews i
         JOIN applications a ON a.id = i.application_id WHERE i.id = ? FOR UPDATE`, [id]);
    if (!rows[0]) throw new AppError(404, 'Interview not found');
    if (rows[0].status !== 'scheduled') throw new AppError(409, 'Only scheduled interviews can be cancelled');
    await conn.query("UPDATE interviews SET status = 'cancelled' WHERE id = ?", [id]);
    await applyStatusChange(conn, { applicationId: rows[0].application_id, to: 'shortlisted', userId: req.user.id, reason: 'Interview cancelled' });
    await notify(conn, rows[0].applicant_id, rows[0].application_id, 'Interview cancelled', 'Your interview has been cancelled. You will be contacted if it is rescheduled.');
  });
  await audit({ req, action: 'interview.cancel', entityType: 'interview', entityId: id });
  ok(res, { id, status: 'cancelled' });
});

exports.complete = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  await withTransaction(async (conn) => {
    const [rows] = await conn.query(
      `SELECT i.status, i.application_id, a.applicant_id FROM interviews i
         JOIN applications a ON a.id = i.application_id WHERE i.id = ? FOR UPDATE`, [id]);
    if (!rows[0]) throw new AppError(404, 'Interview not found');
    if (rows[0].status !== 'scheduled') throw new AppError(409, 'Only scheduled interviews can be completed');
    await conn.query("UPDATE interviews SET status = 'completed' WHERE id = ?", [id]);
    await applyStatusChange(conn, { applicationId: rows[0].application_id, to: 'interview_completed', userId: req.user.id, reason: 'Interview completed' });
    await notify(conn, rows[0].applicant_id, rows[0].application_id, 'Interview completed', 'Your interview has been recorded as completed. A decision will follow.');
  });
  await audit({ req, action: 'interview.complete', entityType: 'interview', entityId: id });
  ok(res, { id, status: 'completed' });
});

/** A panel member records their own score and feedback. */
exports.feedback = asyncHandler(async (req, res) => {
  const id = req.valid.params.id;
  const { score, feedback } = req.valid.body;
  const [r] = await pool.query(
    `UPDATE interview_panel_members p JOIN interviews i ON i.id = p.interview_id
        SET p.score = ?, p.feedback = ?, p.submitted_at = NOW()
      WHERE p.interview_id = ? AND p.user_id = ? AND i.status <> 'cancelled'`,
    [score, feedback, id, req.user.id]
  );
  if (r.affectedRows === 0) throw new AppError(403, 'You are not on the panel of this interview, or it was cancelled');
  await audit({ req, action: 'interview.feedback', entityType: 'interview', entityId: id });
  ok(res, { id, recorded: true });
});

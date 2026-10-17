const { departmentHeadScope } = require('../utils/access');
const { loadLists, completion } = require('./profileController');
const { query } = require('../config/db');
const { asyncHandler, ok } = require('../utils/http');
const { audit } = require('../utils/audit');
const { STATUSES } = require('../utils/statusWorkflow');

const VACANCY_STATUSES = ['draft', 'pending_approval', 'published', 'closed', 'cancelled'];

/** Turn [{status, total}] into {status: total} including zeros, so charts always have every bar. */
function toCounts(rows, keys, field = 'status') {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  rows.forEach((r) => { out[r[field]] = Number(r.total); });
  return out;
}

const vacanciesByStatus = async () =>
  toCounts(await query('SELECT status, COUNT(*) AS total FROM job_vacancies GROUP BY status'), VACANCY_STATUSES);
const applicationsByStatus = async () =>
  toCounts(await query('SELECT status, COUNT(*) AS total FROM applications GROUP BY status'), STATUSES);
const monthlyApplications = () =>
  query(
    `SELECT DATE_FORMAT(submitted_at, '%Y-%m') AS month, COUNT(*) AS total
       FROM applications
      WHERE submitted_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 11 MONTH)
      GROUP BY DATE_FORMAT(submitted_at, '%Y-%m') ORDER BY month`
  );

// ---------- reports (HR officers and administrators; aggregate numbers only) ----------
exports.vacanciesByStatus = asyncHandler(async (req, res) => ok(res, await vacanciesByStatus()));
exports.applicationsByStatus = asyncHandler(async (req, res) => ok(res, await applicationsByStatus()));
exports.monthlyApplications = asyncHandler(async (req, res) => ok(res, await monthlyApplications()));

exports.applicationsByVacancy = asyncHandler(async (req, res) => {
  ok(res, await query(
    `SELECT v.id, v.reference_no, v.title, v.status, COUNT(a.id) AS applications
       FROM job_vacancies v LEFT JOIN applications a ON a.vacancy_id = v.id
      GROUP BY v.id, v.reference_no, v.title, v.status ORDER BY applications DESC, v.id DESC LIMIT 100`
  ));
});

exports.outcomes = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT status, COUNT(*) AS total FROM applications
      WHERE status IN ('selected','rejected','withdrawn') GROUP BY status`
  );
  ok(res, toCounts(rows, ['selected', 'rejected', 'withdrawn']));
});

exports.interviewSchedule = asyncHandler(async (req, res) => {
  ok(res, await query(
    `SELECT i.id, i.scheduled_at, i.location, i.mode, i.status, a.application_no, v.title AS vacancy_title
       FROM interviews i JOIN applications a ON a.id = i.application_id JOIN job_vacancies v ON v.id = a.vacancy_id
      WHERE i.status = 'scheduled' AND i.scheduled_at >= NOW() ORDER BY i.scheduled_at LIMIT 100`
  ));
});

// ---------- CSV export (HR only: it contains applicant names) ----------
/** Stop spreadsheet "formula injection": a cell starting with = + - @ would run as a formula in Excel. */
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

exports.applicationsCsv = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT a.application_no, v.reference_no, v.title, u.full_name, a.status, a.submitted_at
       FROM applications a JOIN job_vacancies v ON v.id = a.vacancy_id JOIN users u ON u.id = a.applicant_id
      ORDER BY a.submitted_at DESC`
  );
  const header = ['Application No', 'Vacancy Ref', 'Vacancy Title', 'Applicant', 'Status', 'Submitted At'];
  const lines = [header.map(csvCell).join(',')];
  rows.forEach((r) => lines.push([r.application_no, r.reference_no, r.title, r.full_name, r.status, r.submitted_at].map(csvCell).join(',')));

  await audit({ req, action: 'report.export_csv', entityType: 'report', details: { rows: rows.length } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
  res.send('\uFEFF' + lines.join('\r\n')); // BOM so Excel reads UTF-8
});

// ---------- dashboards (all numbers come from the database) ----------
exports.dashboard = asyncHandler(async (req, res) => {
  const u = req.user;

  if (u.role === 'admin') {
    const [users, roles, vac, apps, recent] = await Promise.all([
      query('SELECT COUNT(*) AS c FROM users'),
      query('SELECT r.code AS role, COUNT(u.id) AS total FROM roles r LEFT JOIN users u ON u.role_id = r.id GROUP BY r.code'),
      vacanciesByStatus(),
      applicationsByStatus(),
      query(
        `SELECT l.id, l.action, l.entity_type, l.entity_id, l.created_at, u.full_name AS user_name
           FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 10`
      ),
    ]);
    return ok(res, {
      role: 'admin',
      total_users: users[0].c,
      users_by_role: toCounts(roles, ['admin', 'hr_officer', 'department_head', 'applicant'], 'role'),
      vacancies_by_status: vac,
      total_applications: Object.values(apps).reduce((a, b) => a + b, 0),
      applications_by_status: apps,
      monthly_applications: await monthlyApplications(),
      recent_activity: recent,
    });
  }

  if (u.role === 'hr_officer') {
    const [vac, apps, upcoming, completedInterviews] = await Promise.all([
      vacanciesByStatus(),
      applicationsByStatus(),
      query(
        `SELECT i.id, i.scheduled_at, i.location, a.application_no, v.title AS vacancy_title
           FROM interviews i JOIN applications a ON a.id = i.application_id JOIN job_vacancies v ON v.id = a.vacancy_id
          WHERE i.status = 'scheduled' AND i.scheduled_at >= NOW() ORDER BY i.scheduled_at LIMIT 5`
      ),
      query("SELECT COUNT(*) AS c FROM interviews WHERE status = 'completed'"),
    ]);
    return ok(res, {
      role: 'hr_officer',
      vacancies_by_status: vac,
      applications_by_status: apps,
      pending_applications: apps.submitted,
      upcoming_interviews: upcoming,
      completed_interviews: completedInterviews[0].c,
      monthly_applications: await monthlyApplications(),
    });
  }

  if (u.role === 'department_head') {
    const scope = departmentHeadScope(u.id, 'a');
    const [assigned, pendingEval, upcoming, dept] = await Promise.all([
      query(`SELECT a.status, COUNT(*) AS total FROM applications a WHERE ${scope.sql} GROUP BY a.status`, scope.params),
      query(
        `SELECT COUNT(*) AS c FROM applications a
          WHERE ${scope.sql}
            AND a.status NOT IN ('selected','rejected','withdrawn')
            AND NOT EXISTS (SELECT 1 FROM screening_evaluations e
                             WHERE e.application_id = a.id AND e.evaluator_id = ? AND e.stage = 'department_head')`, [...scope.params, u.id]),
      query(
        `SELECT i.id, i.scheduled_at, i.location, a.application_no
           FROM interviews i JOIN applications a ON a.id = i.application_id
          WHERE i.status = 'scheduled' AND i.scheduled_at >= NOW()
            AND (i.id IN (SELECT interview_id FROM interview_panel_members WHERE user_id = ?) OR ${scope.sql})
          ORDER BY i.scheduled_at LIMIT 5`, [u.id, ...scope.params]),
      query('SELECT d.name FROM users x JOIN departments d ON d.id = x.department_id WHERE x.id = ?', [u.id]),
    ]);
    const byStatus = toCounts(assigned, STATUSES);
    return ok(res, {
      role: 'department_head',
      department: dept[0] ? dept[0].name : null,
      assigned_total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      assigned_by_status: byStatus,
      pending_evaluations: pendingEval[0].c,
      upcoming_interviews: upcoming,
    });
  }

  // applicant
  const [mine, profile, open, recent, unread, upcoming] = await Promise.all([
    query('SELECT status, COUNT(*) AS total FROM applications WHERE applicant_id = ? GROUP BY status', [u.id]),
    query(
      `SELECT phone, date_of_birth, city, highest_education, field_of_study, years_experience, summary
         FROM users u LEFT JOIN applicant_profiles p ON p.user_id = u.id WHERE u.id = ?`, [u.id]),
    query("SELECT COUNT(*) AS c FROM job_vacancies WHERE status = 'published' AND deadline_at > NOW()"),
    query(
      `SELECT v.id, v.reference_no, v.title, v.deadline_at, d.name AS department
         FROM job_vacancies v JOIN departments d ON d.id = v.department_id
        WHERE v.status = 'published' AND v.deadline_at > NOW() ORDER BY v.published_at DESC LIMIT 5`),
    query('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', [u.id]),
    query(
      `SELECT i.id, i.scheduled_at, i.location, i.mode, v.title AS vacancy_title
         FROM interviews i JOIN applications a ON a.id = i.application_id JOIN job_vacancies v ON v.id = a.vacancy_id
        WHERE a.applicant_id = ? AND i.status = 'scheduled' AND i.scheduled_at >= NOW() ORDER BY i.scheduled_at LIMIT 5`, [u.id]),
  ]);
  const lists = await loadLists(u.id);
  const completionPercent = completion(profile[0] || {}, lists.education, lists.experience, lists.skills);
  const byStatus = toCounts(mine, STATUSES);
  ok(res, {
    role: 'applicant',
    profile_completion_percent: completionPercent,
    applications_by_status: byStatus,
    total_applications: Object.values(byStatus).reduce((a, b) => a + b, 0),
    open_vacancies: open[0].c,
    recent_vacancies: recent,
    unread_notifications: unread[0].c,
    upcoming_interviews: upcoming,
  });
});

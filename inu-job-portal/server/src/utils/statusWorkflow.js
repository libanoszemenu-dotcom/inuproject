const { AppError } = require('./http');

const STATUSES = [
  'submitted', 'under_review', 'screened', 'shortlisted',
  'interview_scheduled', 'interview_completed', 'selected', 'rejected', 'withdrawn',
];

/** Every change the SYSTEM may make (including through interview scheduling). */
const TRANSITIONS = {
  submitted: ['under_review', 'rejected', 'withdrawn'],
  under_review: ['screened', 'rejected', 'withdrawn'],
  screened: ['shortlisted', 'rejected', 'withdrawn'],
  shortlisted: ['interview_scheduled', 'rejected', 'withdrawn'],
  interview_scheduled: ['interview_completed', 'shortlisted', 'rejected', 'withdrawn'],
  interview_completed: ['selected', 'rejected', 'withdrawn'],
  selected: [],
  rejected: [],
  withdrawn: [],
};

/** Changes an HR officer may make by hand. Interview-related steps happen through the interview API. */
const MANUAL = {
  submitted: ['under_review', 'rejected'],
  under_review: ['screened', 'rejected'],
  screened: ['shortlisted', 'rejected'],
  shortlisted: ['rejected'],
  interview_scheduled: ['rejected'],
  interview_completed: ['selected', 'rejected'],
  selected: [],
  rejected: [],
  withdrawn: [],
};

/**
 * Changes a Department Head may make by hand on applications of the own department.
 * Intake (submitted -> under_review) stays with HR; interview steps go through the interview API.
 */
const DEPARTMENT_HEAD_MANUAL = {
  under_review: ['screened', 'rejected'],
  screened: ['shortlisted', 'rejected'],
  shortlisted: ['rejected'],
  interview_scheduled: ['rejected'],
  interview_completed: ['selected', 'rejected'],
};

/** Manual transitions available to a role from a given status. */
function manualTransitionsFor(role, from) {
  const map = role === 'department_head' ? DEPARTMENT_HEAD_MANUAL : role === 'hr_officer' ? MANUAL : {};
  return map[from] || [];
}

const ACTIVE_STATUSES = STATUSES.filter((s) => !['selected', 'rejected', 'withdrawn'].includes(s));

/**
 * Change an application's status safely inside a transaction:
 * locks the row, checks the transition is allowed, updates, writes history.
 * Returns the previous status.
 */
async function applyStatusChange(conn, { applicationId, to, userId, reason = null, manual = false, role = 'hr_officer' }) {
  const [rows] = await conn.query('SELECT status FROM applications WHERE id = ? FOR UPDATE', [applicationId]);
  if (!rows[0]) throw new AppError(404, 'Application not found');
  const from = rows[0].status;
  const allowed = manual ? manualTransitionsFor(role, from) : TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new AppError(409, `Cannot change status from "${from}" to "${to}"`);
  }
  await conn.query('UPDATE applications SET status = ? WHERE id = ?', [to, applicationId]);
  await conn.query(
    'INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, reason) VALUES (?,?,?,?,?)',
    [applicationId, from, to, userId, reason]
  );
  return from;
}

/** Cancel any still-scheduled interviews (used when an application is rejected or withdrawn). */
async function cancelOpenInterviews(conn, applicationId) {
  await conn.query(
    "UPDATE interviews SET status = 'cancelled' WHERE application_id = ? AND status = 'scheduled'",
    [applicationId]
  );
}

module.exports = { STATUSES, ACTIVE_STATUSES, TRANSITIONS, MANUAL, DEPARTMENT_HEAD_MANUAL, manualTransitionsFor, applyStatusChange, cancelOpenInterviews };

const { AppError } = require('./http');

/** Two time ranges overlap when each starts before the other ends (touching ends do not overlap). */
function overlaps(startA, minutesA, startB, minutesB) {
  const a0 = new Date(startA).getTime();
  const a1 = a0 + minutesA * 60000;
  const b0 = new Date(startB).getTime();
  const b1 = b0 + minutesB * 60000;
  return a0 < b1 && b0 < a1;
}

/**
 * Find existing SCHEDULED interviews that collide with a proposed one, for the panel members
 * and for the applicant. `executor` is a pool or a transaction connection.
 */
async function findConflicts(executor, { scheduledAt, durationMinutes, panelIds, applicantId, excludeInterviewId = 0 }) {
  const range = `i.status = 'scheduled' AND i.id <> ?
      AND i.scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
      AND DATE_ADD(i.scheduled_at, INTERVAL i.duration_minutes MINUTE) > ?`;
  const [panelRows] = await executor.query(
    `SELECT i.id AS interview_id, i.scheduled_at, i.duration_minutes, u.id AS person_id, u.full_name AS person_name,
            'panel_member' AS kind
       FROM interviews i
       JOIN interview_panel_members p ON p.interview_id = i.id
       JOIN users u ON u.id = p.user_id
      WHERE p.user_id IN (?) AND ${range}`,
    [panelIds, excludeInterviewId, scheduledAt, durationMinutes, scheduledAt]
  );
  const [applicantRows] = await executor.query(
    `SELECT i.id AS interview_id, i.scheduled_at, i.duration_minutes, u.id AS person_id, u.full_name AS person_name,
            'applicant' AS kind
       FROM interviews i
       JOIN applications a ON a.id = i.application_id
       JOIN users u ON u.id = a.applicant_id
      WHERE a.applicant_id = ? AND ${range}`,
    [applicantId, excludeInterviewId, scheduledAt, durationMinutes, scheduledAt]
  );
  return [...panelRows, ...applicantRows];
}

const hhmm = (dt) => String(dt).slice(11, 16);

/** Human-readable messages for the error response. */
function describeConflicts(conflicts) {
  return conflicts.map((c) => {
    const end = new Date(new Date(`${String(c.scheduled_at).replace(' ', 'T')}Z`).getTime() + c.duration_minutes * 60000)
      .toISOString().slice(11, 16);
    const who = c.kind === 'applicant' ? `The applicant (${c.person_name})` : c.person_name;
    return { field: c.kind === 'applicant' ? 'application_id' : 'panel_member_ids',
      message: `${who} already has an interview on ${String(c.scheduled_at).slice(0, 10)} from ${hhmm(c.scheduled_at)} to ${end}` };
  });
}

/**
 * Inside a transaction: lock the people involved (in id order, to avoid deadlocks) so two HR officers
 * cannot book the same person at the same time, then throw 409 if anything collides.
 */
async function assertNoConflicts(conn, args) {
  const ids = [...new Set([...args.panelIds, args.applicantId])].sort((a, b) => a - b);
  await conn.query('SELECT id FROM users WHERE id IN (?) ORDER BY id FOR UPDATE', [ids]);
  const conflicts = await findConflicts(conn, args);
  if (conflicts.length) throw new AppError(409, 'Schedule conflict: someone is already booked at that time', describeConflicts(conflicts));
}

module.exports = { overlaps, findConflicts, describeConflicts, assertNoConflicts };

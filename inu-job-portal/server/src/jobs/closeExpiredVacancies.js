const { pool } = require('../config/db');

/**
 * Close every published vacancy whose deadline has passed and write one audit entry per vacancy.
 * Safe to run repeatedly and from several processes (each update is conditional on the status).
 */
async function closeExpiredVacancies() {
  const [expired] = await pool.query("SELECT id FROM job_vacancies WHERE status = 'published' AND deadline_at <= NOW()");
  let closed = 0;
  for (const { id } of expired) {
    const [r] = await pool.query(
      "UPDATE job_vacancies SET status = 'closed', closed_at = NOW() WHERE id = ? AND status = 'published'", [id]);
    if (r.affectedRows) {
      closed += 1;
      await pool.query(
        "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (NULL, 'vacancy.auto_close', 'job_vacancy', ?, ?)",
        [id, JSON.stringify({ reason: 'deadline passed' })]
      );
    }
  }
  return closed;
}

function startExpiryJob(minutes) {
  const run = async () => {
    try {
      const n = await closeExpiredVacancies();
      if (n) console.log(`Auto-closed ${n} expired vacancy(ies)`);
    } catch (err) {
      console.error('Auto-close failed:', err.message);
    }
  };
  run();
  const timer = setInterval(run, Math.max(1, minutes) * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { closeExpiredVacancies, startExpiryJob };

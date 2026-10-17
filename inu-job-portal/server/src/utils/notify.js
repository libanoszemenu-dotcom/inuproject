const { pool } = require('../config/db');

/** Create an in-app notification. Pass a transaction connection to keep it atomic. */
async function notify(executor, userId, applicationId, title, message) {
  const db = executor || pool;
  await db.query(
    'INSERT INTO notifications (user_id, application_id, title, message) VALUES (?,?,?,?)',
    [userId, applicationId || null, String(title).slice(0, 150), String(message).slice(0, 500)]
  );
}

module.exports = { notify };

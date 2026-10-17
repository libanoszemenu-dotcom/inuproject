const env = require('./config/env');
const app = require('./app');
const { pool } = require('./config/db');
const { startExpiryJob } = require('./jobs/closeExpiredVacancies');

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('\nCannot connect to the database:', err.message);
    console.error('Is MySQL running and are the DB_* values in server/.env correct?\n');
    process.exit(1);
  }
  try {
    await pool.query('SELECT 1 FROM schema_migrations WHERE name = ?', ['002_inu_upgrade.sql']).then(([rows]) => {
      if (!rows.length) throw new Error('missing');
    });
  } catch (_) {
    console.error('\nThe database has not been upgraded yet. Run:  npm run migrate\n');
    process.exit(1);
  }
  if (env.isProduction && !env.smtpConfigured) {
    console.warn('WARNING: SMTP is not configured: verification emails will only be printed to this log.');
  }

  const stopJob = startExpiryJob(env.expiryCheckMinutes);
  const server = app.listen(env.port, () => console.log(`API running on http://localhost:${env.port}/api`));
  const stop = () => { stopJob(); server.close(() => pool.end().then(() => process.exit(0))); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

start();

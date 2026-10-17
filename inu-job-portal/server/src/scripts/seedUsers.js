/**
 * Development helper: gives the fictional sample accounts (from database/seed.sql)
 * a real bcrypt password so you can log in. Refuses to run in production.
 */
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { pool } = require('../config/db');

(async () => {
  if (env.isProduction) {
    console.error('Refusing to run in production.');
    process.exit(1);
  }
  if (env.seedPassword.length < 8) {
    console.error('Set SEED_PASSWORD (at least 8 chars, with upper, lower and a digit) in server/.env first.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(env.seedPassword, 10);
  const [r] = await pool.query("UPDATE users SET password_hash = ? WHERE email LIKE '%@example.test'", [hash]);
  console.log(`Updated ${r.affectedRows} sample account(s). Log in with e.g. admin@example.test / <your SEED_PASSWORD>`);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });

/**
 * Applies every database/migrations/*.sql file once, in name order, and records it
 * in the schema_migrations table. Usage:  npm run migrate
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const DIR = path.resolve(__dirname, '../../../database/migrations');

/** Remove "-- comment" lines, then split into statements at ";" line ends. */
function splitStatements(sql) {
  const cleaned = sql.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
  return cleaned.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean);
}

(async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name VARCHAR(120) NOT NULL PRIMARY KEY,
       applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB`
  );
  const [done] = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(done.map((r) => r.name));
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) { console.log(`skip   ${file} (already applied)`); continue; }
    const statements = splitStatements(fs.readFileSync(path.join(DIR, file), 'utf8'));
    console.log(`apply  ${file} (${statements.length} statements)`);
    for (const st of statements) {
      try {
        await pool.query(st);
      } catch (err) {
        console.error(`\nFailed in ${file}:\n${st.slice(0, 300)}\n\n${err.message}`);
        console.error('DDL statements cannot be rolled back automatically: fix the cause, restore a backup, and re-run.');
        process.exit(1);
      }
    }
    await pool.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    count += 1;
  }
  console.log(count ? `Done: ${count} migration(s) applied.` : 'Database is up to date.');
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });

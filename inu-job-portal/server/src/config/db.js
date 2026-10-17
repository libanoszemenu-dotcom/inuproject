const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // return DATE/DATETIME as plain strings (no timezone surprises)
  charset: 'utf8mb4',
});

// XAMPP's MariaDB is not strict by default. Strict mode makes bad data an error
// instead of silently truncating or storing zero-dates.
pool.pool.on('connection', (conn) => {
  conn.query(
    "SET SESSION sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"
  );
});

/** Run a parameterized query and return the rows. */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run several statements so that they all succeed or all fail together. */
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, withTransaction };

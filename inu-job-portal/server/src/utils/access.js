const { query } = require('../config/db');

/**
 * A Department Head can work with an application when
 *   (a) HR assigned it to them, or
 *   (b) its vacancy belongs to the Department Head's own department (users.department_id).
 * Returns the SQL condition and its parameters for use in a WHERE clause.
 */
function departmentHeadScope(userId, alias = 'a') {
  return {
    sql: `(EXISTS (SELECT 1 FROM application_assignments s WHERE s.application_id = ${alias}.id AND s.reviewer_id = ?)
           OR ${alias}.vacancy_id IN (SELECT v.id FROM job_vacancies v
                                       JOIN users du ON du.department_id = v.department_id WHERE du.id = ?))`,
    params: [userId, userId],
  };
}

async function departmentHeadCanSee(userId, applicationId) {
  const scope = departmentHeadScope(userId);
  const rows = await query(`SELECT 1 FROM applications a WHERE a.id = ? AND ${scope.sql} LIMIT 1`, [applicationId, ...scope.params]);
  return Boolean(rows[0]);
}

module.exports = { departmentHeadScope, departmentHeadCanSee };

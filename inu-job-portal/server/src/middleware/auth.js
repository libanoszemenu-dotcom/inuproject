const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { AppError, asyncHandler } = require('../utils/http');

/**
 * Identify the caller from the HTTP-only cookie. The role is ALWAYS read from the
 * database, never from the token or from anything the browser sends, so a
 * deactivated user or a changed role takes effect immediately.
 */
async function loadUser(req) {
  const token = req.cookies && req.cookies.token;
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch (_) {
    return null;
  }
  const rows = await query(
    `SELECT u.id, u.full_name, u.email, u.is_active, u.department_id, u.email_verified_at, r.code AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?`,
    [payload.sub]
  );
  const u = rows[0];
  if (!u || !u.is_active) return null;
  return {
    id: u.id, full_name: u.full_name, email: u.email, role: u.role,
    department_id: u.department_id || null, email_verified: Boolean(u.email_verified_at),
  };
}

const authenticate = asyncHandler(async (req, res, next) => {
  const user = await loadUser(req);
  if (!user) throw new AppError(401, 'Authentication required');
  req.user = user;
  next();
});

/** Like authenticate, but anonymous visitors are allowed (req.user stays null). */
const optionalAuth = asyncHandler(async (req, res, next) => {
  req.user = await loadUser(req);
  next();
});

/** Allow only the listed roles. Use after authenticate. */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, 'You do not have permission to perform this action'));
  }
  next();
};

module.exports = { authenticate, optionalAuth, authorize };

const env = require('../config/env');
const { AppError } = require('../utils/http');

/**
 * CSRF defence, layer 2 (layer 1 is the SameSite cookie). For requests that change
 * data, if the browser tells us which site sent the request (Origin header), it must
 * be our own frontend. Tools like Postman send no Origin header and are not browsers,
 * so they pass.
 */
function originCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== env.clientOrigin) {
    return next(new AppError(403, 'Request origin not allowed'));
  }
  next();
}

module.exports = originCheck;

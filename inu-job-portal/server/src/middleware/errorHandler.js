const multer = require('multer');
const { ZodError } = require('zod');
const { AppError } = require('../utils/http');

function duplicateMessage(err) {
  const m = err.sqlMessage || '';
  if (m.includes('uq_users_email')) return 'This email address is already registered';
  if (m.includes('uq_one_application_per_vacancy')) return 'You have already applied for this vacancy';
  if (m.includes('uq_vacancy_ref') || m.includes('uq_application_no')) return 'Reference number clash, please retry';
  return 'A record with the same unique value already exists';
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let message = 'Internal server error';
  let errors;

  if (err instanceof AppError) {
    status = err.status;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    errors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'A file is larger than the allowed size' : `Upload error: ${err.message}`;
  } else if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = duplicateMessage(err);
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  }

  if (status === 500) console.error(err); // details stay in the server log only
  const body = { success: false, message };
  if (errors) body.errors = errors;
  res.status(status).json(body);
}

module.exports = errorHandler;

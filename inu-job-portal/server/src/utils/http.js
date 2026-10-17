/** An error we throw on purpose, with the HTTP status to send back. */
class AppError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

/** Lets async route handlers throw errors without try/catch everywhere. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Standard success response: { success: true, data, meta? } */
function ok(res, data = null, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function pageMeta(page, pageSize, total) {
  return { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Escape % and _ so user text is matched literally inside LIKE. */
const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => '\\' + c);

module.exports = { AppError, asyncHandler, ok, pageMeta, escapeLike };

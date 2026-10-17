const { departmentHeadCanSee } = require('../utils/access');
const fs = require('fs');
const { query } = require('../config/db');
const { AppError, asyncHandler } = require('../utils/http');
const { audit } = require('../utils/audit');
const { filePathFor } = require('../utils/files');

/**
 * Secure download. There is NO public URL for applicant files: this endpoint checks
 * the caller's permission first, then streams the file from the private folder.
 * Allowed: the applicant who owns it, HR officers, and Department Heads assigned to the application.
 */
exports.download = asyncHandler(async (req, res) => {
  const docId = req.valid.params.id;
  const rows = await query(
    `SELECT d.id, d.application_id, d.original_name, d.stored_name, d.mime_type, a.applicant_id
       FROM application_documents d JOIN applications a ON a.id = d.application_id WHERE d.id = ?`,
    [docId]
  );
  const doc = rows[0];
  if (!doc) throw new AppError(404, 'Document not found');

  const user = req.user;
  let allowed = false;
  if (user.role === 'applicant') allowed = doc.applicant_id === user.id;
  else if (user.role === 'hr_officer') allowed = true;
  else if (user.role === 'department_head') {
    allowed = await departmentHeadCanSee(user.id, doc.application_id);
  }
  if (!allowed) throw new AppError(404, 'Document not found'); // 404, not 403: do not reveal it exists

  const filePath = filePathFor(doc.stored_name);
  if (!fs.existsSync(filePath)) throw new AppError(404, 'The stored file is missing');

  await audit({ req, action: 'document.download', entityType: 'application_document', entityId: doc.id, details: { application_id: doc.application_id } });
  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.download(filePath, doc.original_name); // forces "attachment": never displayed inside our site
});

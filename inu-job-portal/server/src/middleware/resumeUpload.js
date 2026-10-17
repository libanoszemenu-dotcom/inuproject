const multer = require('multer');
const env = require('../config/env');

const ALLOWED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/** One CV file in the form field "resume", held in memory only (never written to disk). */
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 1, fields: 2 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      const { AppError } = require('../utils/http');
      return cb(new AppError(400, 'Please upload a PDF or a Word (.docx) file'));
    }
    cb(null, true);
  },
}).single('resume');

const multer = require('multer');
const env = require('../config/env');
const { AppError } = require('../utils/http');

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

// Files are held in memory first so we can check their real content before writing anything to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024, files: 10, fields: 20, fieldSize: 20 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new AppError(400, 'Only PDF, JPEG and PNG files are allowed'));
    }
    cb(null, true);
  },
});

module.exports = upload.any(); // field name = document type code, e.g. "cv", "degree"

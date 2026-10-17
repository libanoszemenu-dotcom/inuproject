const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function fail(lines) {
  console.error(`\n${lines.join('\n')}\n`);
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET || '';
const PLACEHOLDERS = ['change-me', 'changeme', 'your-secret', 'replace-with-a-long-random-string'];
if (jwtSecret.length < 32 || PLACEHOLDERS.some((p) => jwtSecret.toLowerCase().includes(p))) {
  fail([
    'JWT_SECRET is missing, too short (< 32 chars) or still a placeholder. Set a real value in server/.env.',
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
  ]);
}

const list = (value, fallback) => (value || fallback).split(',').map((s) => s.trim()).filter(Boolean);
const bool = (value, fallback) => (value === undefined || value === '' ? fallback : value === 'true');

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
if (isProduction && !clientOrigin.startsWith('https://')) {
  fail(['In production CLIENT_ORIGIN must be an https:// URL (cookies are sent over HTTPS only).']);
}
if (isProduction && !process.env.DB_PASSWORD) {
  fail(['In production DB_PASSWORD must be set (do not run the application as a passwordless database user).']);
}

const smtp = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 587),
  secure: bool(process.env.SMTP_SECURE, false),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || 'Injibara University Recruitment <no-reply@localhost>',
};

module.exports = {
  nodeEnv,
  isProduction,
  appName: 'Injibara University Recruitment Portal',
  port: Number(process.env.PORT || 5000),
  clientOrigin,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'recruitment_db',
  },
  jwtSecret,
  tokenHours: Number(process.env.TOKEN_HOURS || 8),
  uploadDir: process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, '../../uploads/private'),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 5),
  requireVacancyApproval: bool(process.env.REQUIRE_VACANCY_APPROVAL, true),
  vacancyApproverRoles: list(process.env.VACANCY_APPROVER_ROLES, 'admin'),
  seedPassword: process.env.SEED_PASSWORD || '',
  // email verification + SMTP
  requireEmailVerification: bool(process.env.REQUIRE_EMAIL_VERIFICATION, true),
  emailTokenHours: Number(process.env.EMAIL_TOKEN_HOURS || 24),
  smtp,
  smtpConfigured: Boolean(smtp.host),
  // Google OAuth 2.0 (Google Identity Services "Sign in with Google")
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
  // background job
  expiryCheckMinutes: Number(process.env.EXPIRY_CHECK_MINUTES || 5),
};

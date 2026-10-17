const env = require('../config/env');

let transporter = null;
function getTransporter() {
  if (!env.smtpConfigured) return null;
  if (!transporter) {
    // required lazily so the API still starts if SMTP is not used
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

/**
 * Send an email. Never throws: a mail problem must not break registration.
 * Without SMTP settings (development) the message is printed to the server console instead.
 * Returns true when a real email was handed to the SMTP server.
 */
async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[mail:console] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  }
  try {
    await t.sendMail({ from: env.smtp.from, to, subject, text, html });
    return true;
  } catch (err) {
    console.error('Sending email failed:', err.message);
    return false;
  }
}

module.exports = { sendMail };

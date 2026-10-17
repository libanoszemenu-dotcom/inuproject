const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

fs.mkdirSync(env.uploadDir, { recursive: true });

/** Identify a file by its first bytes ("magic numbers"), not by what the browser claims. */
function detectFileType(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png' };
  return null;
}

/** Save a file under a random name in the private folder. Returns the stored name. */
async function storeFile(buffer) {
  const storedName = crypto.randomUUID();
  await fsp.writeFile(path.join(env.uploadDir, storedName), buffer, { flag: 'wx', mode: 0o600 });
  return storedName;
}

async function removeFile(storedName) {
  try {
    await fsp.unlink(path.join(env.uploadDir, storedName));
  } catch (_) {
    /* already gone */
  }
}

const filePathFor = (storedName) => path.join(env.uploadDir, storedName);

function safeOriginalName(name) {
  const base = path
    .basename(String(name || 'file'))
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .slice(0, 200);
  return base || 'file';
}

module.exports = { detectFileType, storeFile, removeFile, filePathFor, safeOriginalName };

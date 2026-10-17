/**
 * Resume (CV) parsing.
 *  - extractText(buffer): reads text from a PDF or DOCX file (real file content is checked, not the file name)
 *  - parseResumeText(text): turns plain text into suggested education / experience / skills
 * The result is only a SUGGESTION: the applicant reviews and edits it before saving.
 * Nothing here is stored; the uploaded file is discarded after parsing.
 */
const { AppError } = require('./http');

// ---------- text extraction ----------
function detectKind(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05);
  if (isZip && buf.includes(Buffer.from('word/'))) return 'docx';
  return null;
}

async function extractText(buf) {
  const kind = detectKind(buf);
  if (!kind) throw new AppError(400, 'Please upload a PDF or a Word (.docx) file. Old .doc files are not supported.');
  try {
    if (kind === 'pdf') {
      const pdfParse = require('pdf-parse');
      const out = await pdfParse(buf);
      return out.text || '';
    }
    const mammoth = require('mammoth');
    const out = await mammoth.extractRawText({ buffer: buf });
    return out.value || '';
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(422, 'The file could not be read. It may be damaged or password-protected.');
  }
}

// ---------- helpers ----------
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_PART = `(?:${MONTH_RE}\\.?\\s+)?(?:19|20)\\d{2}`;
const RANGE_RE = new RegExp(`(${DATE_PART})\\s*(?:-|–|—|to|until)\\s*(${DATE_PART}|present|current|now|date|ongoing)`, 'i');

const BULLET = /^[\s•●▪■◦○*\-–—·>]+/;
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function toDate(part, now, asEnd) {
  if (/present|current|now|date|ongoing/i.test(part)) return { iso: now.toISOString().slice(0, 10), current: true };
  const y = Number((part.match(/(?:19|20)\d{2}/) || [])[0]);
  const m = (part.match(new RegExp(MONTH_RE, 'i')) || [])[0];
  const month = m ? MONTHS[m.toLowerCase().slice(0, m.toLowerCase().startsWith('sept') ? 4 : 3)] : asEnd ? 12 : 1;
  return { iso: `${y}-${String(month).padStart(2, '0')}-01`, current: false, year: y };
}

const SECTION_RULES = [
  ['summary', /^(professional\s+|career\s+)?(summary|profile|objective|about\s+me|personal\s+statement)\b/i],
  ['education', /^(education(al)?(\s+(background|qualifications?))?|academic\s+(background|qualifications?)|qualifications?)\b/i],
  ['experience', /^((work|professional|employment|relevant|teaching)\s+)?(experience|history)\b|^employment\b/i],
  ['skills', /^((technical|key|core|professional|computer|it)\s+)?(skills?|competenc(y|ies)|expertise)\b/i],
  ['other', /^(projects?|references?|languages?|certifications?|certificates?|training|interests|hobbies|awards?|honou?rs|publications?|volunteer|declaration|personal\s+(details|information))\b/i],
];

function sectionOf(line) {
  const t = line.replace(/[:\s_\-–—=]+$/, '').trim();
  if (t.length === 0 || t.length > 45 || BULLET.test(line) && !/^[A-Za-z]/.test(t)) return null;
  for (const [name, re] of SECTION_RULES) if (re.test(t)) return name;
  return null;
}

function splitSections(lines) {
  const sections = { head: [], summary: [], education: [], experience: [], skills: [], other: [] };
  let current = 'head';
  for (const raw of lines) {
    const line = raw.trim();
    const s = line ? sectionOf(line) : null;
    if (s) { current = s; continue; }
    sections[current].push(raw);
  }
  return sections;
}

// ---------- education ----------
const LEVELS = [
  ['PhD', /\b(ph\.?\s?d|doctorate|doctoral)\b/i, 5],
  ["Master's degree", /\b(m\.?\s?sc|m\.?\s?a|m\.?\s?ed|m\.?\s?b\.?\s?a|master'?s?|masters)\b\.?/i, 4],
  ["Bachelor's degree", /\b(b\.?\s?sc|b\.?\s?a|b\.?\s?ed|b\.?\s?eng|bachelor'?s?|degree)\b\.?/i, 3],
  ['Diploma', /\b(advanced\s+)?diploma\b/i, 2],
  ['Certificate', /\bcertificate\b/i, 1],
];
const INSTITUTION = /\b(university|college|institute|polytechnic|school|academy)\b/i;
const YEAR = /\b(?:19[5-9]\d|20[0-4]\d)\b/g;

function parseEducation(lines, now) {
  const items = [];
  let block = [];
  const flush = () => {
    const text = block.map(clean).filter(Boolean);
    block = [];
    if (!text.length) return;
    const joined = text.join(' | ');
    const level = LEVELS.find(([, re]) => re.test(joined));
    const instLine = text.find((l) => INSTITUTION.test(l));
    if (!level && !instLine) return;
    let institution = instLine ? instLine.replace(YEAR, '').replace(/[()|,\-–—\s]+$/g, '').replace(/^[\s,|\-–—]+/, '') : '';
    const m = joined.match(/\b(?:in|of)\s+([A-Z][A-Za-z&,\/ ]{2,60}?)(?=\s*(?:\||,|\(|-|–|—|$|\d))/);
    const f = joined.match(/(?:field|major|specialization)\s*[:\-]\s*([^|,(]+)/i);
    const years = (joined.match(YEAR) || []).map(Number).filter((y) => y <= now.getFullYear() + 5);
    items.push({
      institution: (institution || 'Unknown institution').slice(0, 150),
      degree_level: level ? level[0] : null,
      field_of_study: clean((f && f[1]) || (m && m[1]) || '').slice(0, 120) || null,
      start_year: years.length > 1 ? Math.min(...years) : null,
      end_year: years.length ? Math.max(...years) : null,
    });
  };
  for (const raw of lines) {
    if (!raw.trim()) { flush(); continue; }
    // a new line that has a degree keyword after we already have one starts another entry
    if (block.length && LEVELS.some(([, re]) => re.test(raw)) && block.some((l) => LEVELS.some(([, re]) => re.test(l))) ) flush();
    block.push(raw);
  }
  flush();
  return items.slice(0, 10);
}

// ---------- experience ----------
function parseExperience(lines, now) {
  const idx = [];
  lines.forEach((l, i) => { if (RANGE_RE.test(l)) idx.push(i); });
  if (!idx.length) return [];

  const isHeader = (l) => l && l.trim() && !BULLET.test(l) && l.trim().length <= 90 && !RANGE_RE.test(l);
  const entries = [];
  const used = new Set();

  idx.forEach((d, k) => {
    const lower = k === 0 ? 0 : idx[k - 1] + 1;
    const header = [];
    const sameLine = clean(lines[d].replace(RANGE_RE, '').replace(/[()\[\]|]/g, ' ').replace(/^[\s,\-–—:]+|[\s,\-–—:]+$/g, ''));
    if (sameLine.length >= 3) header.push(sameLine);
    for (let i = d - 1; i >= lower && header.length < 2; i -= 1) {
      if (used.has(i)) break;
      if (!isHeader(lines[i])) break;
      header.unshift(clean(lines[i]));
      used.add(i);
    }
    entries.push({ d, header, headerStart: d - header.filter((h) => h !== sameLine).length });
  });

  const out = [];
  entries.forEach((e, k) => {
    const end = k + 1 < entries.length ? entries[k + 1].headerStart : lines.length;
    const desc = lines.slice(e.d + 1, end).map((l) => clean(l.replace(BULLET, ''))).filter(Boolean).join('\n').slice(0, 1500);
    const [startRaw, endRaw] = lines[e.d].match(RANGE_RE).slice(1, 3);
    const s = toDate(startRaw, now, false);
    const en = toDate(endRaw, now, true);
    let title = '';
    let employer = '';
    const h = e.header.join(' | ');
    const at = h.match(/^(.*?)\s+(?:at|@)\s+(.*)$/i);
    const parts = h.split(/\s*[|,]\s*|\s+[-–—]\s+/).filter(Boolean);
    if (at) { title = at[1]; employer = at[2]; }
    else if (parts.length >= 2) { [title, employer] = parts; }
    else { title = parts[0] || ''; }
    if (INSTITUTION.test(title) && !INSTITUTION.test(employer)) [title, employer] = [employer, title];
    if (new Date(en.iso) < new Date(s.iso)) return;
    out.push({
      employer: clean(employer || 'Unknown employer').slice(0, 150),
      job_title: clean(title || 'Unknown position').slice(0, 150),
      start_date: s.iso,
      end_date: en.current ? null : en.iso,
      is_current: en.current,
      description: desc || null,
    });
  });
  return out.slice(0, 15);
}

/** Total years of experience from the date ranges (overlaps are merged). */
function yearsOfExperience(experience, now) {
  const spans = experience.map((e) => [new Date(e.start_date).getTime(), new Date(e.end_date || now.toISOString().slice(0, 10)).getTime()])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur = null;
  for (const s of spans) {
    if (!cur) cur = [...s];
    else if (s[0] <= cur[1]) cur[1] = Math.max(cur[1], s[1]);
    else { total += cur[1] - cur[0]; cur = [...s]; }
  }
  if (cur) total += cur[1] - cur[0];
  return Math.min(60, Math.floor(total / (365.25 * 24 * 3600 * 1000)));
}

// ---------- skills ----------
const KNOWN_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'React', 'Node.js',
  'Express', 'HTML', 'CSS', 'Tailwind CSS', 'Git', 'Linux', 'Networking', 'Cybersecurity', 'Data Analysis', 'Machine Learning',
  'Microsoft Excel', 'Microsoft Word', 'Microsoft Office', 'Research', 'Teaching', 'Curriculum Development', 'Project Management',
  'Communication', 'Leadership', 'Accounting', 'Statistics', 'Laboratory Work', 'Academic Writing', 'Public Speaking',
];

function parseSkills(skillLines, wholeText) {
  const found = [];
  const seen = new Set();
  const add = (s) => {
    const name = clean(s).replace(/^[\s\-–—•:]+|[\s.:;,]+$/g, '');
    if (name.length < 2 || name.length > 60 || /^\d+$/.test(name)) return;
    const key = name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); found.push(name); }
  };
  for (const raw of skillLines) {
    const line = raw.replace(BULLET, '');
    const afterLabel = line.includes(':') && line.indexOf(':') < 35 ? line.slice(line.indexOf(':') + 1) : line;
    afterLabel.split(/[,;|•●▪·\u2022]|\s{3,}/).forEach(add);
  }
  if (found.length < 3) {
    for (const k of KNOWN_SKILLS) {
      const re = new RegExp(`(^|[^A-Za-z0-9+#])${k.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9+#])`, 'i');
      if (re.test(wholeText)) add(k);
    }
  }
  return found.slice(0, 40);
}

// ---------- main ----------
function parseResumeText(text, now = new Date()) {
  const normalized = String(text || '').replace(/\r/g, '').replace(/\u00a0/g, ' ');
  const lines = normalized.split('\n');
  const sections = splitSections(lines);

  const email = (normalized.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [null])[0];
  const phone = (normalized.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)\d{3}[\s-]?\d{3,4}/) || [null])[0];

  const education = parseEducation(sections.education, now);
  const experience = parseExperience(sections.experience, now);
  const skills = parseSkills(sections.skills, normalized);
  const top = [...education].sort((a, b) => {
    const rank = (e) => (LEVELS.find(([n]) => n === e.degree_level) || [0, 0, 0])[2];
    return rank(b) - rank(a);
  })[0];
  const summary = clean(sections.summary.join(' ')).slice(0, 1500) || null;

  const warnings = [];
  if (!education.length) warnings.push('No education section was recognised. Please add your education manually.');
  if (!experience.length) warnings.push('No work experience with dates was recognised. Please add it manually.');
  if (!skills.length) warnings.push('No skills were recognised. Please add your skills manually.');

  return {
    email, phone: phone ? clean(phone) : null, summary,
    highest_education: top ? top.degree_level : null,
    field_of_study: top ? top.field_of_study : null,
    years_experience: experience.length ? yearsOfExperience(experience, now) : null,
    education, experience, skills, warnings,
  };
}

module.exports = { extractText, parseResumeText, detectKind, yearsOfExperience };

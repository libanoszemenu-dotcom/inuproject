const { query, withTransaction } = require('../config/db');
const { AppError, asyncHandler, ok } = require('../utils/http');
const { audit } = require('../utils/audit');
const { extractText, parseResumeText } = require('../utils/resumeParser');

const PROFILE_SQL = `
  SELECT u.id, u.full_name, u.email, u.phone,
         p.date_of_birth, p.city, p.highest_education, p.field_of_study, p.years_experience, p.summary
    FROM users u LEFT JOIN applicant_profiles p ON p.user_id = u.id
   WHERE u.id = ?`;

const SCALAR_FIELDS = ['phone', 'date_of_birth', 'city', 'highest_education', 'field_of_study', 'years_experience', 'summary'];

/** Percentage of profile parts that are filled: 7 basic fields + education + experience + skills. */
function completion(profile, education, experience, skills) {
  const filled = SCALAR_FIELDS.filter((f) => profile[f] !== null && profile[f] !== undefined && profile[f] !== '').length
    + (education.length ? 1 : 0) + (experience.length ? 1 : 0) + (skills.length ? 1 : 0);
  return Math.round((filled / (SCALAR_FIELDS.length + 3)) * 100);
}

async function loadLists(userId, executor = { query: (s, p) => query(s, p).then((r) => [r]) }) {
  const [education] = await executor.query(
    `SELECT id, institution, degree_level, field_of_study, start_year, end_year
       FROM profile_education WHERE user_id = ? ORDER BY COALESCE(end_year, 9999) DESC, id`, [userId]);
  const [experience] = await executor.query(
    `SELECT id, employer, job_title, start_date, end_date, is_current, description
       FROM profile_experience WHERE user_id = ? ORDER BY is_current DESC, start_date DESC, id`, [userId]);
  const [skills] = await executor.query('SELECT name FROM profile_skills WHERE user_id = ? ORDER BY name', [userId]);
  return {
    education,
    experience: experience.map((e) => ({ ...e, is_current: Boolean(e.is_current) })),
    skills: skills.map((s) => s.name),
  };
}

async function fullProfile(userId) {
  const rows = await query(PROFILE_SQL, [userId]);
  const lists = await loadLists(userId);
  return { ...rows[0], ...lists, completion_percent: completion(rows[0], lists.education, lists.experience, lists.skills) };
}

exports.loadLists = loadLists;
exports.completion = completion;

exports.get = asyncHandler(async (req, res) => ok(res, await fullProfile(req.user.id)));

exports.update = asyncHandler(async (req, res) => {
  const b = req.valid.body;
  await withTransaction(async (conn) => {
    if (b.full_name !== undefined) {
      await conn.query('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [b.full_name, b.phone, req.user.id]);
    } else {
      await conn.query('UPDATE users SET phone = ? WHERE id = ?', [b.phone, req.user.id]);
    }
    await conn.query(
      `INSERT INTO applicant_profiles
         (user_id, date_of_birth, city, highest_education, field_of_study, years_experience, summary)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE date_of_birth = VALUES(date_of_birth), city = VALUES(city),
         highest_education = VALUES(highest_education), field_of_study = VALUES(field_of_study),
         years_experience = VALUES(years_experience), summary = VALUES(summary)`,
      [req.user.id, b.date_of_birth, b.city, b.highest_education, b.field_of_study, b.years_experience, b.summary]
    );

    // A list that is sent replaces the stored list; a list that is not sent is left untouched.
    if (b.education) {
      await conn.query('DELETE FROM profile_education WHERE user_id = ?', [req.user.id]);
      if (b.education.length) {
        await conn.query(
          'INSERT INTO profile_education (user_id, institution, degree_level, field_of_study, start_year, end_year, sort_order) VALUES ?',
          [b.education.map((e, i) => [req.user.id, e.institution, e.degree_level, e.field_of_study, e.start_year || null, e.end_year || null, i])]
        );
      }
    }
    if (b.experience) {
      await conn.query('DELETE FROM profile_experience WHERE user_id = ?', [req.user.id]);
      if (b.experience.length) {
        await conn.query(
          'INSERT INTO profile_experience (user_id, employer, job_title, start_date, end_date, is_current, description, sort_order) VALUES ?',
          [b.experience.map((e, i) => [req.user.id, e.employer, e.job_title, e.start_date, e.end_date, e.is_current ? 1 : 0, e.description, i])]
        );
      }
    }
    if (b.skills) {
      await conn.query('DELETE FROM profile_skills WHERE user_id = ?', [req.user.id]);
      if (b.skills.length) {
        await conn.query('INSERT INTO profile_skills (user_id, name) VALUES ?', [b.skills.map((s) => [req.user.id, s])]);
      }
    }
  });
  await audit({ req, action: 'profile.update', entityType: 'user', entityId: req.user.id });
  ok(res, await fullProfile(req.user.id));
});

/**
 * Read an uploaded CV and return SUGGESTED profile data. Nothing is saved and the file is discarded:
 * the applicant reviews the suggestions in the form and presses "Save profile".
 */
exports.parseResume = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'Choose a PDF or Word (.docx) file first');
  const text = await extractText(req.file.buffer);
  if (text.replace(/\s/g, '').length < 40) {
    throw new AppError(422, 'No readable text was found. A scanned CV (picture) cannot be read: upload a text-based PDF or a Word file.');
  }
  const parsed = parseResumeText(text);
  await audit({ req, action: 'profile.resume_parse', entityType: 'user', entityId: req.user.id,
    details: { education: parsed.education.length, experience: parsed.experience.length, skills: parsed.skills.length } });
  ok(res, parsed);
});

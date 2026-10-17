const test = require('node:test');
const assert = require('node:assert');
const { parseResumeText } = require('../src/utils/resumeParser');

const NOW = new Date('2026-10-17T00:00:00Z');
const CV = `Abebe Kebede
abebe@example.test | +251 911 000 000

Professional Summary
Computer scientist with experience in teaching and web development.

Education
BSc in Computer Science
Injibara University, 2018 - 2022

MSc in Information Systems
Bahir Dar University, 2023 - 2025

Work Experience
Lecturer, Sample College
Jan 2023 - Present
- Taught programming courses
- Supervised student projects

Junior Developer at Example Software
2022 - 2023
Built internal web tools

Skills
Programming: JavaScript, Python, SQL
Tools: Git, Linux

References
Available on request
`;

test('parses education, experience, skills', () => {
  const r = parseResumeText(CV, NOW);
  assert.equal(r.email, 'abebe@example.test');
  assert.equal(r.education.length, 2);
  assert.equal(r.education[0].degree_level, "Bachelor's degree");
  assert.equal(r.education[0].field_of_study, 'Computer Science');
  assert.equal(r.education[0].start_year, 2018);
  assert.equal(r.education[1].degree_level, "Master's degree");
  assert.equal(r.highest_education, "Master's degree");
  assert.equal(r.experience.length, 2);
  assert.equal(r.experience[0].job_title, 'Lecturer');
  assert.equal(r.experience[0].employer, 'Sample College');
  assert.equal(r.experience[0].is_current, true);
  assert.equal(r.experience[0].end_date, null);
  assert.equal(r.experience[1].job_title, 'Junior Developer');
  assert.equal(r.experience[1].employer, 'Example Software');
  assert.match(r.experience[0].description, /Taught programming/);
  assert.deepEqual(r.skills, ['JavaScript', 'Python', 'SQL', 'Git', 'Linux']);
  assert.ok(r.years_experience >= 3);
  assert.match(r.summary, /Computer scientist/);
  assert.equal(r.warnings.length, 0);
});

test('empty or unreadable text gives warnings, not errors', () => {
  const r = parseResumeText('hello world', NOW);
  assert.equal(r.education.length, 0);
  assert.equal(r.experience.length, 0);
  assert.ok(r.warnings.length >= 2);
});

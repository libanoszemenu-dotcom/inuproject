const { z } = require('zod');
const { STATUSES } = require('../utils/statusWorkflow');

// ---------- reusable pieces ----------
const id = z.coerce.number().int().positive();
const idParam = z.object({ id });

const page = {
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
};

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(150);
const fullName = z.string().trim().min(2, 'Name is too short').max(120);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[0-9]/, 'Password needs a digit');
const phone = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number');
const optionalPhone = z.union([phone, z.literal('')]).nullish().transform((v) => v || null);
const optionalText = (max) => z.string().trim().max(max).nullish().transform((v) => v || null);

function validParts(y, mo, d, h = 0, mi = 0) {
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d &&
    dt.getUTCHours() === h && dt.getUTCMinutes() === mi;
}

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use format YYYY-MM-DD').refine((s) => {
  const [y, m, d] = s.split('-').map(Number);
  return validParts(y, m, d);
}, 'Invalid date');

const dateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/, 'Use format YYYY-MM-DD HH:mm')
  .refine((s) => {
    const [d, t] = s.split(/[T ]/);
    const [y, m, day] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    return validParts(y, m, day, h, mi);
  }, 'Invalid date or time')
  .transform((s) => {
    const v = s.replace('T', ' ');
    return v.length === 16 ? `${v}:00` : v;
  });

const status = z.enum(STATUSES);
const skillName = z.preprocess((v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v),
  z.string().min(2, 'Skill is too short').max(60, 'Skill is too long'));
const uniqueSkills = (max) => z.array(skillName).max(max)
  .refine((a) => new Set(a.map((s) => s.toLowerCase())).size === a.length, 'Duplicate skills');

// ---------- auth ----------
const register = z.object({ full_name: fullName, email, password, phone: optionalPhone });
const login = z.object({ email, password: z.string().min(1).max(72) });
const googleLogin = z.object({ credential: z.string().min(20).max(4096) });
const verifyEmail = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid token') });
const changePassword = z.object({ current_password: z.string().min(1).max(72), new_password: password });

// ---------- users (admin) ----------
const staffRoles = z.enum(['admin', 'hr_officer', 'department_head']);
const userList = z.object({
  ...page,
  q: z.string().trim().max(100).optional(),
  role: z.enum(['admin', 'hr_officer', 'department_head', 'applicant']).optional(),
  is_active: z.enum(['0', '1']).optional(),
});
const userCreate = z.object({ full_name: fullName, email, password, phone: optionalPhone, role: staffRoles, department_id: id.nullish() });
const userUpdate = z
  .object({ full_name: fullName.optional(), role: staffRoles.optional(), is_active: z.boolean().optional(), department_id: id.nullable().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
const userResetPassword = z.object({ new_password: password });

// ---------- profile ----------
const profileUpdate = z.object({
  full_name: fullName.optional(),
  phone: optionalPhone,
  date_of_birth: z.union([dateOnly, z.literal('')]).nullish().transform((v) => v || null),
  city: optionalText(80),
  highest_education: optionalText(80),
  field_of_study: optionalText(120),
  years_experience: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.coerce.number().int().min(0).max(60).nullable()
  ),
  summary: optionalText(2000),
  education: z.array(z.object({
    institution: z.string().trim().min(2).max(150),
    degree_level: optionalText(80),
    field_of_study: optionalText(120),
    start_year: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().min(1950).max(2100).nullish()),
    end_year: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().min(1950).max(2100).nullish()),
  }).refine((e) => !e.start_year || !e.end_year || e.end_year >= e.start_year, { message: 'End year cannot be before start year', path: ['end_year'] })).max(10).optional(),
  experience: z.array(z.object({
    employer: z.string().trim().min(2).max(150),
    job_title: z.string().trim().min(2).max(150),
    start_date: dateOnly,
    end_date: z.union([dateOnly, z.literal('')]).nullish().transform((v) => v || null),
    is_current: z.boolean().default(false),
    description: optionalText(1500),
  }).refine((e) => e.is_current || e.end_date, { message: 'Enter an end date or tick "I currently work here"', path: ['end_date'] })
    .refine((e) => e.is_current || !e.end_date || e.end_date >= e.start_date, { message: 'End date cannot be before start date', path: ['end_date'] })
    .transform((e) => (e.is_current ? { ...e, end_date: null } : e))).max(15).optional(),
  skills: uniqueSkills(40).optional(),
});

// ---------- vacancies ----------
const category = z.enum(['academic', 'administrative', 'technical']);
const employmentType = z.enum(['full_time', 'part_time', 'contract']);
const vacancyPublicList = z.object({
  ...page,
  q: z.string().trim().max(100).optional(),
  department_id: id.optional(),
  category: category.optional(),
  employment_type: employmentType.optional(),
});
const vacancyManageList = z.object({
  ...page,
  q: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'pending_approval', 'published', 'closed', 'cancelled']).optional(),
});
const vacancyBody = z.object({
  title: z.string().trim().min(5).max(150),
  department_id: id,
  category,
  employment_type: employmentType,
  description: z.string().trim().min(20, 'Description is too short').max(10000),
  qualifications: z.string().trim().min(10, 'Qualifications are too short').max(5000),
  positions_count: z.coerce.number().int().min(1).max(100).default(1),
  location: z.string().trim().min(2).max(120),
  deadline_at: dateTime,
  required_document_codes: z.array(z.string().trim().min(1).max(40)).min(1, 'Select at least one required document').max(10),
  required_skills: uniqueSkills(30).default([]),
});
const reasonBody = z.object({ reason: z.string().trim().min(5).max(500) });

// ---------- applications ----------
const applicationCreate = z.object({
  vacancy_id: id,
  cover_note: z.string().trim().max(3000).optional().transform((v) => v || null),
});
const applicationList = z.object({
  ...page,
  status: status.optional(),
  vacancy_id: id.optional(),
  q: z.string().trim().max(100).optional(),
});
const applicationMine = z.object({ ...page });
const statusChange = z
  .object({ to_status: status, reason: z.string().trim().max(500).optional() })
  .refine((v) => v.to_status !== 'rejected' || (v.reason && v.reason.length >= 5), {
    message: 'A reason (at least 5 characters) is required when rejecting an application',
    path: ['reason'],
  });
const withdraw = z.object({ reason: z.string().trim().max(500).optional() });
const assignment = z.object({ reviewer_id: id });
const assignmentParams = z.object({ id, reviewerId: id });
const evaluation = z.object({
  stage: z.enum(['completeness', 'screening', 'department_head']),
  score: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().min(0).max(100).nullable()),
  recommendation: z.enum(['proceed', 'hold', 'reject']),
  comments: z.string().trim().max(2000).optional().transform((v) => v || null),
});

// ---------- interviews ----------
const interviewCreate = z.object({
  application_id: id,
  scheduled_at: dateTime,
  location: z.string().trim().min(2).max(150),
  duration_minutes: z.coerce.number().int().min(10).max(480).default(45),
  mode: z.enum(['in_person', 'online']).default('in_person'),
  notes: z.string().trim().max(500).optional().transform((v) => v || null),
  panel_member_ids: z.array(id).min(1, 'Add at least one panel member').max(10)
    .refine((a) => new Set(a).size === a.length, 'Duplicate panel members'),
});
const interviewConflictCheck = z.object({
  application_id: id,
  scheduled_at: dateTime,
  duration_minutes: z.coerce.number().int().min(10).max(480).default(45),
  panel_member_ids: z.array(id).min(1).max(10),
});
const departmentBody = z.object({ name: z.string().trim().min(3, 'Name is too short').max(150) });
const loginList = z.object({ ...page, success: z.enum(['0', '1']).optional(), user_id: id.optional() });
const interviewList = z.object({
  ...page,
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  upcoming: z.enum(['true', 'false']).optional(),
});
const interviewFeedback = z.object({
  score: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().min(0).max(100).nullable()),
  feedback: z.string().trim().min(3, 'Feedback is required').max(2000),
});

// ---------- notifications / audit ----------
const notificationList = z.object({ ...page, unread: z.enum(['true', 'false']).optional() });
const auditList = z.object({
  ...page,
  action: z.string().trim().max(60).optional(),
  user_id: id.optional(),
  entity_type: z.string().trim().max(40).optional(),
});

module.exports = {
  googleLogin, verifyEmail, interviewConflictCheck, departmentBody, loginList,
  idParam, register, login, changePassword,
  userList, userCreate, userUpdate, userResetPassword,
  profileUpdate,
  vacancyPublicList, vacancyManageList, vacancyBody, reasonBody,
  applicationCreate, applicationList, applicationMine, statusChange, withdraw,
  assignment, assignmentParams, evaluation,
  interviewCreate, interviewList, interviewFeedback,
  notificationList, auditList,
};

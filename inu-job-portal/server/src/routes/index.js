const express = require('express');
const v = require('../validators/schemas');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const resumeUpload = require('../middleware/resumeUpload');
const { loginLimiter, registerLimiter, parseLimiter, mailLimiter } = require('../middleware/rateLimit');

const auth = require('../controllers/authController');
const users = require('../controllers/userController');
const profile = require('../controllers/profileController');
const meta = require('../controllers/metaController');
const vacancies = require('../controllers/vacancyController');
const applications = require('../controllers/applicationController');
const documents = require('../controllers/documentController');
const interviews = require('../controllers/interviewController');
const notifications = require('../controllers/notificationController');
const reports = require('../controllers/reportController');
const audit = require('../controllers/auditController');
const departments = require('../controllers/departmentController');
const { query } = require('../config/db');
const { asyncHandler, ok } = require('../utils/http');

const router = express.Router();
const HR = 'hr_officer';
const idOnly = validate({ params: v.idParam });

// ---- health / lookups (public) ----
router.get('/health', asyncHandler(async (req, res) => {
  await query('SELECT 1');
  ok(res, { status: 'ok', database: 'connected' });
}));
router.get('/meta/lookups', meta.lookups);

// ---- authentication ----
router.post('/auth/register', registerLimiter, validate({ body: v.register }), auth.register);
router.post('/auth/login', loginLimiter, validate({ body: v.login }), auth.login);
router.post('/auth/google', loginLimiter, validate({ body: v.googleLogin }), auth.google);
router.get('/auth/config', auth.config);
router.post('/auth/verify-email', loginLimiter, validate({ body: v.verifyEmail }), auth.verifyEmail);
router.post('/auth/resend-verification', authenticate, mailLimiter, auth.resendVerification);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', authenticate, auth.me);
router.post('/auth/change-password', authenticate, validate({ body: v.changePassword }), auth.changePassword);

// ---- departments (administrator manages, everyone reads through /meta/lookups) ----
router.get('/departments', authenticate, authorize('admin'), departments.list);
router.post('/departments', authenticate, authorize('admin'), validate({ body: v.departmentBody }), departments.create);
router.put('/departments/:id', authenticate, authorize('admin'), validate({ params: v.idParam, body: v.departmentBody }), departments.update);
router.delete('/departments/:id', authenticate, authorize('admin'), idOnly, departments.remove);

// ---- users and roles (administrator) ----
router.get('/roles', authenticate, authorize('admin'), users.listRoles);
router.get('/users/directory', authenticate, authorize(HR, 'admin'), users.directory);
router.get('/users', authenticate, authorize('admin'), validate({ query: v.userList }), users.list);
router.post('/users', authenticate, authorize('admin'), validate({ body: v.userCreate }), users.create);
router.patch('/users/:id', authenticate, authorize('admin'), validate({ params: v.idParam, body: v.userUpdate }), users.update);
router.post('/users/:id/reset-password', authenticate, authorize('admin'), validate({ params: v.idParam, body: v.userResetPassword }), users.resetPassword);

// ---- applicant profile ----
router.get('/profile', authenticate, authorize('applicant'), profile.get);
router.post('/profile/resume/parse', authenticate, authorize('applicant'), parseLimiter, resumeUpload, profile.parseResume);
router.put('/profile', authenticate, authorize('applicant'), validate({ body: v.profileUpdate }), profile.update);

// ---- vacancies ----
router.get('/vacancies', validate({ query: v.vacancyPublicList }), vacancies.listPublic);
router.get('/vacancies/manage/list', authenticate, authorize(HR, 'admin'), validate({ query: v.vacancyManageList }), vacancies.listManage);
router.get('/vacancies/:id', optionalAuth, idOnly, vacancies.getOne);
router.post('/vacancies', authenticate, authorize(HR), validate({ body: v.vacancyBody }), vacancies.create);
router.put('/vacancies/:id', authenticate, authorize(HR), validate({ params: v.idParam, body: v.vacancyBody }), vacancies.update);
router.delete('/vacancies/:id', authenticate, authorize(HR), idOnly, vacancies.remove);
router.post('/vacancies/:id/submit', authenticate, authorize(HR), idOnly, vacancies.submit);
router.post('/vacancies/:id/approve', authenticate, authorize(HR, 'admin', 'department_head'), idOnly, vacancies.approve);
router.post('/vacancies/:id/return', authenticate, authorize(HR, 'admin', 'department_head'), validate({ params: v.idParam, body: v.reasonBody }), vacancies.returnToDraft);
router.post('/vacancies/:id/close', authenticate, authorize(HR, 'admin'), idOnly, vacancies.close);

// ---- applications ----
router.post('/applications', authenticate, authorize('applicant'), upload, validate({ body: v.applicationCreate }), applications.create);
router.get('/applications/mine', authenticate, authorize('applicant'), validate({ query: v.applicationMine }), applications.listMine);
router.get('/applications', authenticate, authorize(HR, 'department_head'), validate({ query: v.applicationList }), applications.listStaff);
router.get('/applications/:id', authenticate, authorize('applicant', HR, 'department_head'), idOnly, applications.getOne);
router.post('/applications/:id/status', authenticate, authorize(HR, 'department_head'), validate({ params: v.idParam, body: v.statusChange }), applications.changeStatus);
router.patch('/applications/:id/status', authenticate, authorize(HR, 'department_head'), validate({ params: v.idParam, body: v.statusChange }), applications.changeStatus);
router.post('/applications/:id/withdraw', authenticate, authorize('applicant'), validate({ params: v.idParam, body: v.withdraw }), applications.withdraw);
router.post('/applications/:id/assignments', authenticate, authorize(HR), validate({ params: v.idParam, body: v.assignment }), applications.assign);
router.delete('/applications/:id/assignments/:reviewerId', authenticate, authorize(HR), validate({ params: v.assignmentParams }), applications.unassign);
router.post('/applications/:id/evaluations', authenticate, authorize(HR, 'department_head'), validate({ params: v.idParam, body: v.evaluation }), applications.evaluate);

// ---- documents (no public file URLs; every download is permission-checked) ----
router.get('/documents/:id/download', authenticate, idOnly, documents.download);

// ---- interviews ----
router.post('/interviews/check-conflicts', authenticate, authorize(HR), validate({ body: v.interviewConflictCheck }), interviews.checkConflicts);
router.post('/interviews', authenticate, authorize(HR), validate({ body: v.interviewCreate }), interviews.create);
router.get('/interviews', authenticate, authorize('applicant', HR, 'department_head'), validate({ query: v.interviewList }), interviews.list);
router.post('/interviews/:id/cancel', authenticate, authorize(HR), idOnly, interviews.cancel);
router.post('/interviews/:id/complete', authenticate, authorize(HR), idOnly, interviews.complete);
router.post('/interviews/:id/feedback', authenticate, authorize(HR, 'department_head'), validate({ params: v.idParam, body: v.interviewFeedback }), interviews.feedback);

// ---- notifications ----
router.get('/notifications', authenticate, validate({ query: v.notificationList }), notifications.list);
router.post('/notifications/read-all', authenticate, notifications.markAllRead);
router.patch('/notifications/:id/read', authenticate, idOnly, notifications.markRead);

// ---- dashboards and reports ----
router.get('/dashboard', authenticate, reports.dashboard);
router.get('/reports/vacancies-by-status', authenticate, authorize(HR, 'admin'), reports.vacanciesByStatus);
router.get('/reports/applications-by-status', authenticate, authorize(HR, 'admin'), reports.applicationsByStatus);
router.get('/reports/applications-by-vacancy', authenticate, authorize(HR, 'admin'), reports.applicationsByVacancy);
router.get('/reports/monthly-applications', authenticate, authorize(HR, 'admin'), reports.monthlyApplications);
router.get('/reports/outcomes', authenticate, authorize(HR, 'admin'), reports.outcomes);
router.get('/reports/interview-schedule', authenticate, authorize(HR, 'admin'), reports.interviewSchedule);
router.get('/reports/applications.csv', authenticate, authorize(HR), reports.applicationsCsv);

// ---- audit logs (administrator) ----
router.get('/audit-logs/logins', authenticate, authorize('admin'), validate({ query: v.loginList }), audit.logins);
router.get('/audit-logs', authenticate, authorize('admin'), validate({ query: v.auditList }), audit.list);

module.exports = router;

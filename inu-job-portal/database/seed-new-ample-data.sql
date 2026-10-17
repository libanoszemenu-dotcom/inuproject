-- =====================================================================
-- FICTIONAL sample data for development and testing only.
-- No real people, no real university data. Emails use the reserved
-- ".test" domain. Departments are placeholders, NOT the university's
-- verified structure.
--
-- Passwords: the hash below is a deliberate placeholder and cannot be
-- used to log in. The backend seed script (next step) will create real
-- bcrypt hashes for the development accounts.
-- =====================================================================
USE recruitment_db;

INSERT INTO roles (code, name, description) VALUES
 ('admin',     'System Administrator',  'Manages accounts, roles, configuration and audit logs'),
 ('hr_officer','HR / Recruitment Officer','Manages vacancies, applications, screening, interviews, reports'),
 ('committee', 'Recruitment Committee Member','Reviews assigned applications and records evaluations'),
 ('applicant', 'Applicant',             'Applies for vacancies and tracks status');

INSERT INTO document_types (code, name) VALUES
 ('cv',            'Curriculum Vitae'),
 ('degree',        'Degree / Academic Certificate'),
 ('transcript',    'Academic Transcript'),
 ('experience',    'Work Experience Letter'),
 ('id_copy',       'Identification Copy');

INSERT INTO departments (name) VALUES
 ('Department of Computer Science (sample)'),
 ('Department of Mathematics (sample)'),
 ('Human Resource Office (sample)'),
 ('Library Services (sample)');

-- users: 1 admin, 1 HR officer, 1 committee member, 2 applicants
SET @ph = 'PLACEHOLDER_NOT_A_REAL_HASH';
INSERT INTO users (role_id, full_name, email, password_hash, phone) VALUES
 (1, 'Sample Admin',        'admin@example.test',     @ph, NULL),
 (2, 'Sample HR Officer',   'hr@example.test',        @ph, NULL),
 (3, 'Sample Committee One','committee1@example.test',@ph, NULL),
 (4, 'Sample Applicant A',  'applicant.a@example.test',@ph, NULL),
 (4, 'Sample Applicant B',  'applicant.b@example.test',@ph, NULL);

INSERT INTO applicant_profiles
 (user_id, city, highest_education, field_of_study, years_experience, summary) VALUES
 (4, 'Sample City', 'BSc', 'Computer Science', 2, 'Fictional profile for testing.'),
 (5, 'Sample City', 'MSc', 'Mathematics',      4, 'Fictional profile for testing.');

INSERT INTO job_vacancies
 (reference_no, title, department_id, category, employment_type, description,
  qualifications, positions_count, location, status, deadline_at,
  created_by, approved_by, published_at) VALUES
 ('SAMPLE-2026-001','Assistant Lecturer (sample)',1,'academic','full_time',
  'Fictional vacancy used for development.','Fictional qualification text.',
  2,'Sample Campus','published','2026-12-31 17:00:00',2,1,NOW()),
 ('SAMPLE-2026-002','Library Assistant (sample)',4,'administrative','full_time',
  'Fictional vacancy used for development.','Fictional qualification text.',
  1,'Sample Campus','published','2026-12-15 17:00:00',2,1,NOW()),
 ('SAMPLE-2026-003','IT Technician (sample)',3,'technical','contract',
  'Fictional draft vacancy.','Fictional qualification text.',
  1,'Sample Campus','draft','2027-01-15 17:00:00',2,NULL,NULL);

INSERT INTO vacancy_required_documents (vacancy_id, document_type_id, is_mandatory) VALUES
 (1,1,1),(1,2,1),(1,3,1),(2,1,1),(2,2,1);

-- one application with history, an evaluation, an interview, a notification
INSERT INTO applications (application_no, vacancy_id, applicant_id, cover_note, status) VALUES
 ('APP-SAMPLE-0001', 1, 4, 'Fictional cover note.', 'interview_scheduled'),
 ('APP-SAMPLE-0002', 1, 5, 'Fictional cover note.', 'under_review');

INSERT INTO application_status_history
 (application_id, from_status, to_status, changed_by, reason) VALUES
 (1, NULL,           'submitted',          4, 'Application submitted'),
 (1, 'submitted',    'under_review',       2, NULL),
 (1, 'under_review', 'screened',           2, 'Documents complete'),
 (1, 'screened',     'shortlisted',        2, 'Meets sample criteria'),
 (1, 'shortlisted',  'interview_scheduled',2, NULL),
 (2, NULL,           'submitted',          5, 'Application submitted'),
 (2, 'submitted',    'under_review',       2, NULL);

INSERT INTO application_assignments (application_id, reviewer_id, assigned_by) VALUES (1,3,2);

INSERT INTO screening_evaluations
 (application_id, evaluator_id, stage, score, recommendation, comments) VALUES
 (1, 2, 'completeness', NULL, 'proceed', 'All required documents present (sample).'),
 (1, 3, 'committee',    78.50,'proceed', 'Fictional evaluation comment.');

INSERT INTO interviews (application_id, scheduled_at, location, mode, scheduled_by) VALUES
 (1, '2026-11-20 09:00:00', 'Sample Meeting Room', 'in_person', 2);
INSERT INTO interview_panel_members (interview_id, user_id) VALUES (1,3);

INSERT INTO notifications (user_id, application_id, title, message) VALUES
 (4, 1, 'Interview scheduled', 'Your interview has been scheduled (fictional sample).');

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES
 (2, 'vacancy.create', 'job_vacancy', 1, JSON_OBJECT('note','sample seed'));

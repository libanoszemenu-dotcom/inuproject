-- =====================================================================
-- Migration 002 - Injibara University (INU) upgrade
-- Run ONCE, after schema.sql (and after the optional sample seed):
--     cd server && npm run migrate
-- (the runner records applied files in the schema_migrations table)
-- Works on MariaDB 10.4+ (XAMPP) and MySQL 8+.
-- =====================================================================
USE recruitment_db;

-- 1. Roles: "committee" becomes "Department Head"; make sure all four exist
UPDATE roles SET code = 'department_head', name = 'Department Head',
  description = 'Reviews applicants of the own department, evaluates, shortlists and decides within the department workflow'
 WHERE code = 'committee';

INSERT IGNORE INTO roles (code, name, description) VALUES
 ('admin', 'System Administrator', 'Manages accounts, roles, departments, configuration and audit logs'),
 ('hr_officer', 'HR / Recruitment Officer', 'Manages vacancies, applications, screening, interviews and reports'),
 ('department_head', 'Department Head', 'Reviews applicants of the own department, evaluates, shortlists and decides within the department workflow'),
 ('applicant', 'Applicant', 'Applies for vacancies and tracks status');

INSERT IGNORE INTO document_types (code, name) VALUES
 ('cv', 'Curriculum Vitae'),
 ('degree', 'Degree / Academic Certificate'),
 ('transcript', 'Academic Transcript'),
 ('experience', 'Work Experience Letter'),
 ('id_copy', 'Identification Copy');

-- 2. Users: department (for Department Heads), Google sign-in, email verification
ALTER TABLE users
  ADD COLUMN department_id SMALLINT UNSIGNED NULL AFTER role_id,
  ADD COLUMN auth_provider ENUM('password','google') NOT NULL DEFAULT 'password' AFTER password_hash,
  ADD COLUMN google_sub VARCHAR(40) NULL AFTER auth_provider,
  ADD COLUMN email_verified_at DATETIME NULL AFTER google_sub,
  ADD UNIQUE KEY uq_users_google_sub (google_sub),
  ADD KEY idx_users_department (department_id),
  ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL;

-- accounts that existed before this feature are treated as already verified
UPDATE users SET email_verified_at = NOW() WHERE email_verified_at IS NULL;

CREATE TABLE email_verification_tokens (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_evt_hash (token_hash),
  KEY idx_evt_user (user_id),
  CONSTRAINT fk_evt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Login events (every attempt, successful or not)
CREATE TABLE login_events (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NULL,
  email          VARCHAR(150) NULL,
  method         ENUM('password','google') NOT NULL,
  success        TINYINT(1) NOT NULL,
  failure_reason VARCHAR(40) NULL,
  ip_address     VARCHAR(45) NULL,
  user_agent     VARCHAR(255) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_login_user (user_id, created_at),
  KEY idx_login_when (created_at),
  CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. Structured applicant profile: education, experience, skills
CREATE TABLE profile_education (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  institution    VARCHAR(150) NOT NULL,
  degree_level   VARCHAR(80) NULL,
  field_of_study VARCHAR(120) NULL,
  start_year     SMALLINT UNSIGNED NULL,
  end_year       SMALLINT UNSIGNED NULL,
  sort_order     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_edu_user (user_id),
  CONSTRAINT fk_edu_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_edu_years CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year)
) ENGINE=InnoDB;

CREATE TABLE profile_experience (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  employer    VARCHAR(150) NOT NULL,
  job_title   VARCHAR(150) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NULL,
  is_current  TINYINT(1) NOT NULL DEFAULT 0,
  description TEXT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_exp_user (user_id),
  CONSTRAINT fk_exp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_exp_dates CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB;

CREATE TABLE profile_skills (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name    VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profile_skill (user_id, name),
  CONSTRAINT fk_pskill_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Skills required by a vacancy
CREATE TABLE vacancy_skills (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vacancy_id INT UNSIGNED NOT NULL,
  name       VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vacancy_skill (vacancy_id, name),
  CONSTRAINT fk_vskill_vacancy FOREIGN KEY (vacancy_id) REFERENCES job_vacancies (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Evaluation stage "committee" becomes "department_head"
ALTER TABLE screening_evaluations
  MODIFY stage ENUM('completeness','screening','committee','department_head') NOT NULL;
UPDATE screening_evaluations SET stage = 'department_head' WHERE stage = 'committee';
ALTER TABLE screening_evaluations
  MODIFY stage ENUM('completeness','screening','department_head') NOT NULL;

-- 7. Interviews: duration (needed for overlap checks) and panel lookup index
ALTER TABLE interviews
  ADD COLUMN duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 45 AFTER scheduled_at,
  ADD CONSTRAINT chk_interview_duration CHECK (duration_minutes BETWEEN 10 AND 480);

ALTER TABLE interview_panel_members
  ADD KEY idx_panel_user (user_id, interview_id);

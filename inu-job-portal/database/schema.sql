
CREATE DATABASE IF NOT EXISTS recruitment_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE recruitment_db;

-- ---------------------------------------------------------------------
-- 1. roles  (kept in a table so roles can be added/merged later)
-- ---------------------------------------------------------------------
CREATE TABLE roles (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(30)  NOT NULL,           -- used by backend checks
  name        VARCHAR(80)  NOT NULL,
  description VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. users  (one role per user in v0.1 [Assumption])
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id       TINYINT UNSIGNED NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,         -- bcrypt hash only
  phone         VARCHAR(30)  NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. applicant_profiles  (minimal personal data on purpose)
-- ---------------------------------------------------------------------
CREATE TABLE applicant_profiles (
  user_id           INT UNSIGNED NOT NULL,
  date_of_birth     DATE         NULL,
  city              VARCHAR(80)  NULL,
  highest_education VARCHAR(80)  NULL,
  field_of_study    VARCHAR(120) NULL,
  years_experience  TINYINT UNSIGNED NULL,
  summary           TEXT         NULL,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. departments  (fictional units; replace with verified structure)
-- ---------------------------------------------------------------------
CREATE TABLE departments (
  id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. job_vacancies
--    status flow [Assumption]: draft -> pending_approval -> published
--    -> closed (or cancelled)
-- ---------------------------------------------------------------------
CREATE TABLE job_vacancies (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_no    VARCHAR(40)  NOT NULL,
  title           VARCHAR(150) NOT NULL,
  department_id   SMALLINT UNSIGNED NOT NULL,
  category        ENUM('academic','administrative','technical') NOT NULL,
  employment_type ENUM('full_time','part_time','contract') NOT NULL,
  description     TEXT NOT NULL,
  qualifications  TEXT NOT NULL,
  positions_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
  location        VARCHAR(120) NOT NULL,
  status          ENUM('draft','pending_approval','published','closed','cancelled')
                  NOT NULL DEFAULT 'draft',
  deadline_at     DATETIME NOT NULL,
  created_by      INT UNSIGNED NOT NULL,
  approved_by     INT UNSIGNED NULL,
  published_at    DATETIME NULL,
  closed_at       DATETIME NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vacancy_ref (reference_no),
  KEY idx_vacancy_status_deadline (status, deadline_at),
  KEY idx_vacancy_department (department_id),
  KEY idx_vacancy_category (category),
  CONSTRAINT fk_vacancy_department FOREIGN KEY (department_id)
    REFERENCES departments (id),
  CONSTRAINT fk_vacancy_created_by FOREIGN KEY (created_by)
    REFERENCES users (id),
  CONSTRAINT fk_vacancy_approved_by FOREIGN KEY (approved_by)
    REFERENCES users (id),
  CONSTRAINT chk_positions CHECK (positions_count >= 1)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. document_types and per-vacancy required documents
-- ---------------------------------------------------------------------
CREATE TABLE document_types (
  id   TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_types_code (code)
) ENGINE=InnoDB;

CREATE TABLE vacancy_required_documents (
  vacancy_id       INT UNSIGNED NOT NULL,
  document_type_id TINYINT UNSIGNED NOT NULL,
  is_mandatory     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (vacancy_id, document_type_id),
  CONSTRAINT fk_vrd_vacancy FOREIGN KEY (vacancy_id)
    REFERENCES job_vacancies (id) ON DELETE CASCADE,
  CONSTRAINT fk_vrd_doctype FOREIGN KEY (document_type_id)
    REFERENCES document_types (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. applications  (UNIQUE key prevents duplicate applications)
--    status flow [Assumption]: submitted -> under_review -> screened ->
--    shortlisted -> interview_scheduled -> interview_completed ->
--    selected ; rejected / withdrawn possible from allowed stages.
--    Transition rules are enforced in the backend service layer.
-- ---------------------------------------------------------------------
CREATE TABLE applications (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_no VARCHAR(40)  NOT NULL,
  vacancy_id     INT UNSIGNED NOT NULL,
  applicant_id   INT UNSIGNED NOT NULL,
  cover_note     TEXT NULL,
  status         ENUM('submitted','under_review','screened','shortlisted',
                      'interview_scheduled','interview_completed',
                      'selected','rejected','withdrawn')
                 NOT NULL DEFAULT 'submitted',
  submitted_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                 ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_application_no (application_no),
  UNIQUE KEY uq_one_application_per_vacancy (vacancy_id, applicant_id),
  KEY idx_app_status (status),
  KEY idx_app_applicant (applicant_id),
  CONSTRAINT fk_app_vacancy FOREIGN KEY (vacancy_id)
    REFERENCES job_vacancies (id),
  CONSTRAINT fk_app_applicant FOREIGN KEY (applicant_id)
    REFERENCES users (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. application_documents  (file metadata only; files live on disk,
--    outside the public web folder, under random stored_name)
-- ---------------------------------------------------------------------
CREATE TABLE application_documents (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id   INT UNSIGNED NOT NULL,
  document_type_id TINYINT UNSIGNED NOT NULL,
  original_name    VARCHAR(255) NOT NULL,
  stored_name      CHAR(36)     NOT NULL,        -- random UUID, no extension guess
  mime_type        VARCHAR(100) NOT NULL,
  size_bytes       INT UNSIGNED NOT NULL,
  uploaded_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doc_stored_name (stored_name),
  KEY idx_doc_application (application_id),
  CONSTRAINT fk_doc_application FOREIGN KEY (application_id)
    REFERENCES applications (id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_type FOREIGN KEY (document_type_id)
    REFERENCES document_types (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. application_status_history  (append-only audit of status changes)
-- ---------------------------------------------------------------------
CREATE TABLE application_status_history (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id INT UNSIGNED NOT NULL,
  from_status    VARCHAR(30) NULL,
  to_status      VARCHAR(30) NOT NULL,
  changed_by     INT UNSIGNED NOT NULL,
  reason         VARCHAR(500) NULL,
  changed_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hist_application (application_id, changed_at),
  CONSTRAINT fk_hist_application FOREIGN KEY (application_id)
    REFERENCES applications (id) ON DELETE CASCADE,
  CONSTRAINT fk_hist_user FOREIGN KEY (changed_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. application_assignments  (which reviewer/committee member may see
--     which application; supports the optional fourth role)
-- ---------------------------------------------------------------------
CREATE TABLE application_assignments (
  application_id INT UNSIGNED NOT NULL,
  reviewer_id    INT UNSIGNED NOT NULL,
  assigned_by    INT UNSIGNED NOT NULL,
  assigned_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (application_id, reviewer_id),
  CONSTRAINT fk_assign_application FOREIGN KEY (application_id)
    REFERENCES applications (id) ON DELETE CASCADE,
  CONSTRAINT fk_assign_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id),
  CONSTRAINT fk_assign_by FOREIGN KEY (assigned_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. screening_evaluations
-- ---------------------------------------------------------------------
CREATE TABLE screening_evaluations (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id INT UNSIGNED NOT NULL,
  evaluator_id   INT UNSIGNED NOT NULL,
  stage          ENUM('completeness','screening','committee') NOT NULL,
  score          DECIMAL(5,2) NULL,
  recommendation ENUM('proceed','hold','reject') NOT NULL,
  comments       TEXT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_eval_application (application_id),
  CONSTRAINT fk_eval_application FOREIGN KEY (application_id)
    REFERENCES applications (id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_user FOREIGN KEY (evaluator_id) REFERENCES users (id),
  CONSTRAINT chk_eval_score CHECK (score IS NULL OR (score >= 0 AND score <= 100))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 12. interviews and panel members (feedback stored per panel member)
-- ---------------------------------------------------------------------
CREATE TABLE interviews (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id INT UNSIGNED NOT NULL,
  scheduled_at   DATETIME NOT NULL,
  location       VARCHAR(150) NOT NULL,
  mode           ENUM('in_person','online') NOT NULL DEFAULT 'in_person',
  status         ENUM('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  notes          VARCHAR(500) NULL,
  scheduled_by   INT UNSIGNED NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_interview_when (scheduled_at, status),
  KEY idx_interview_application (application_id),
  CONSTRAINT fk_interview_application FOREIGN KEY (application_id)
    REFERENCES applications (id) ON DELETE CASCADE,
  CONSTRAINT fk_interview_by FOREIGN KEY (scheduled_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE interview_panel_members (
  interview_id INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  score        DECIMAL(5,2) NULL,
  feedback     TEXT NULL,
  submitted_at DATETIME NULL,
  PRIMARY KEY (interview_id, user_id),
  CONSTRAINT fk_panel_interview FOREIGN KEY (interview_id)
    REFERENCES interviews (id) ON DELETE CASCADE,
  CONSTRAINT fk_panel_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT chk_panel_score CHECK (score IS NULL OR (score >= 0 AND score <= 100))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 13. notifications
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  application_id INT UNSIGNED NULL,
  title          VARCHAR(150) NOT NULL,
  message        VARCHAR(500) NOT NULL,
  is_read        TINYINT(1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_application FOREIGN KEY (application_id)
    REFERENCES applications (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 14. audit_logs  (who did what, to which record, from where)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(60)  NOT NULL,
  entity_type VARCHAR(40)  NOT NULL,
  entity_id   INT UNSIGNED NULL,
  ip_address  VARCHAR(45)  NULL,
  details     JSON NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id, created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

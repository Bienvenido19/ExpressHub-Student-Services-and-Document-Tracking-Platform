CREATE DATABASE IF NOT EXISTS expresshub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE expresshub;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS document_types (
  code VARCHAR(10) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  turnaround_text VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS document_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_code VARCHAR(40) NOT NULL,
  student_name VARCHAR(150) NOT NULL,
  student_number VARCHAR(40) NOT NULL,
  email VARCHAR(254) NOT NULL,
  document_type_code VARCHAR(10) NOT NULL,
  purpose TEXT NOT NULL,
  status ENUM('submitted', 'processing', 'ready', 'completed', 'rejected', 'cancelled')
    NOT NULL DEFAULT 'submitted',
  staff_notes TEXT NULL,
  assigned_to BIGINT UNSIGNED NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_requests_reference_code (reference_code),
  KEY idx_document_requests_student_number (student_number),
  KEY idx_document_requests_status (status),
  KEY idx_document_requests_submitted_at (submitted_at),
  CONSTRAINT fk_document_requests_document_type
    FOREIGN KEY (document_type_code) REFERENCES document_types (code),
  CONSTRAINT fk_document_requests_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES admin_users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  office VARCHAR(150) NOT NULL,
  published_at DATETIME NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_published (is_published, published_at),
  CONSTRAINT fk_announcements_created_by
    FOREIGN KEY (created_by) REFERENCES admin_users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS academic_schedules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  label VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  starts_on DATE NULL,
  ends_on DATE NULL,
  campuses VARCHAR(255) NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_academic_schedules_published (is_published, starts_on),
  CONSTRAINT fk_academic_schedules_created_by
    FOREIGN KEY (created_by) REFERENCES admin_users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO document_types (code, name, description, turnaround_text) VALUES
  ('OTR', 'Official Transcript of Records (OTR)', 'Certified transcript for employment, graduation, board exams, or school transfer.', '3–5 Working Days'),
  ('GRD', 'Certificate of Grades', 'Semester grade verification for scholarship or academic residency requirements.', '1–2 Working Days'),
  ('ENR', 'Certificate of Enrollment / Registration', 'Official enrollment certification for scholarships, internships, and validation.', '24–48 Hours'),
  ('CLR', 'University Clearance Form', 'Administrative clearance confirmation for students.', '2–3 Working Days'),
  ('TRF', 'Shifting & Transfer Credentials', 'Documents supporting internal academic movement and transfer requests.', '3–5 Working Days')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  turnaround_text = VALUES(turnaround_text);

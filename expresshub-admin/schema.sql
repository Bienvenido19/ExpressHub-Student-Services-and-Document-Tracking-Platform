-- ExpressHub admin-side schema (MySQL 8 / MariaDB 10.4+)
CREATE DATABASE IF NOT EXISTS expresshub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE expresshub;

-- STUDENTS: you already have this on the student side. Skip it (or keep IF NOT EXISTS) and
-- map your real column names in the STUDENT_COLS constant at the top of server.js.
CREATE TABLE IF NOT EXISTS students (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  student_no  VARCHAR(20)  NOT NULL UNIQUE,
  full_name   VARCHAR(120) NOT NULL,
  email       VARCHAR(120) NOT NULL,
  department  VARCHAR(120) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS staff (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  department    VARCHAR(120) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- The student side INSERTs rows here (status defaults to 'new'); staff only update them.
CREATE TABLE IF NOT EXISTS document_requests (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  request_no            VARCHAR(20)  NOT NULL UNIQUE,          -- e.g. REQ-2026-001
  student_id            INT NOT NULL,
  document_type         VARCHAR(80)  NOT NULL,
  purpose               VARCHAR(255) NULL,
  notes                 TEXT NULL,
  status                ENUM('new','processing','ready','completed') NOT NULL DEFAULT 'new',
  flagged               TINYINT(1) NOT NULL DEFAULT 0,          -- shown as "Action Needed"
  submitted_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processing_started_at DATETIME NULL,
  ready_at              DATETIME NULL,                          -- used for turnaround time (your 3 -> 2 day objective)
  completed_at          DATETIME NULL,
  handled_by            INT NULL,
  CONSTRAINT fk_req_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_req_staff   FOREIGN KEY (handled_by) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_status_submitted (status, submitted_at)
) ENGINE=InnoDB;

-- Audit trail (feeds "Verification Logs")
CREATE TABLE IF NOT EXISTS request_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  request_id  INT NOT NULL,
  staff_id    INT NULL,
  action      VARCHAR(30) NOT NULL,                             -- status_change | flagged | unflagged
  old_status  VARCHAR(20) NULL,
  new_status  VARCHAR(20) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_req   FOREIGN KEY (request_id) REFERENCES document_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_log_staff FOREIGN KEY (staff_id)   REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_log_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(150) NOT NULL,
  body         TEXT NOT NULL,
  category     ENUM('general','enrollment','schedule','deadline','event') NOT NULL DEFAULT 'general',
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_by   INT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ann_staff FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  to_email   VARCHAR(120) NOT NULL,
  subject    VARCHAR(200) NOT NULL,
  result     ENUM('sent','failed','logged_only') NOT NULL,
  error      VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mail_req FOREIGN KEY (request_id) REFERENCES document_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

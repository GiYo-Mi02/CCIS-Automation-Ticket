CREATE DATABASE IF NOT EXISTS ccis_ticketing;
USE ccis_ticketing;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  role ENUM('admin','staff','user') DEFAULT 'admin',
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  poster_url VARCHAR(512) DEFAULT NULL,
  starts_at DATETIME DEFAULT NULL,
  ends_at DATETIME DEFAULT NULL,
  performance_at DATETIME,
  capacity INT NOT NULL DEFAULT 1196,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seats (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT NOT NULL,
  section VARCHAR(50) DEFAULT 'Main',
  row_label VARCHAR(10),
  seat_number INT,
  row_idx INT,
  col_idx INT,
  status ENUM('available','blocked','reserved','sold') DEFAULT 'available',
  reserved_token VARCHAR(128) DEFAULT NULL,
  reserved_until DATETIME DEFAULT NULL,
  UNIQUE(event_id, section, row_label, seat_number),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_code VARCHAR(128) UNIQUE,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  event_id BIGINT NOT NULL,
  seat_id BIGINT,
  price DECIMAL(10,2) DEFAULT 0,
  status ENUM('active','used','cancelled') DEFAULT 'active',
  qr_payload TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME DEFAULT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (seat_id) REFERENCES seats(id)
);

CREATE TABLE IF NOT EXISTS email_queue (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),
  subject VARCHAR(255),
  body LONGTEXT,
  attachments JSON DEFAULT NULL,
  status ENUM('pending','sending','sent','failed') DEFAULT 'pending',
  tries INT DEFAULT 0,
  last_attempt DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seat_status ON seats(event_id, status);
CREATE INDEX idx_email_status ON email_queue(status, created_at);

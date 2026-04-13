-- PostgreSQL/Supabase note: MySQL CREATE DATABASE/USE removed; run this in the target database. -- MySQL database selection removed

CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- AUTO_INCREMENT -> identity
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff', 'user')), -- MySQL ENUM -> TEXT + CHECK
  password_hash VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP -- TIMESTAMP -> TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- AUTO_INCREMENT -> identity
  name VARCHAR(255) NOT NULL,
  description TEXT,
  poster_url VARCHAR(512) DEFAULT NULL,
  starts_at TIMESTAMPTZ DEFAULT NULL, -- DATETIME -> TIMESTAMPTZ
  ends_at TIMESTAMPTZ DEFAULT NULL, -- DATETIME -> TIMESTAMPTZ
  performance_at TIMESTAMPTZ, -- DATETIME -> TIMESTAMPTZ
  capacity INT NOT NULL DEFAULT 1196,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP -- TIMESTAMP -> TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS seats (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- AUTO_INCREMENT -> identity
  event_id BIGINT NOT NULL,
  section VARCHAR(50) DEFAULT 'Main',
  row_label VARCHAR(10),
  seat_number INT,
  row_idx INT,
  col_idx INT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'blocked', 'reserved', 'sold')), -- MySQL ENUM -> TEXT + CHECK
  reserved_token VARCHAR(128) DEFAULT NULL,
  reserved_until TIMESTAMPTZ DEFAULT NULL, -- DATETIME -> TIMESTAMPTZ
  UNIQUE(event_id, section, row_label, seat_number),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- AUTO_INCREMENT -> identity
  ticket_code VARCHAR(128) UNIQUE,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  student_section VARCHAR(120),
  event_id BIGINT NOT NULL,
  seat_id BIGINT,
  price DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled')), -- MySQL ENUM -> TEXT + CHECK
  qr_payload TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- TIMESTAMP -> TIMESTAMPTZ
  used_at TIMESTAMPTZ DEFAULT NULL, -- DATETIME -> TIMESTAMPTZ
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (seat_id) REFERENCES seats(id)
);

CREATE TABLE IF NOT EXISTS email_queue (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- AUTO_INCREMENT -> identity
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),
  subject VARCHAR(255),
  body TEXT, -- LONGTEXT -> TEXT
  attachments JSONB DEFAULT NULL, -- JSON -> JSONB
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')), -- MySQL ENUM -> TEXT + CHECK
  tries INT DEFAULT 0,
  last_attempt TIMESTAMPTZ DEFAULT NULL, -- DATETIME -> TIMESTAMPTZ
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP -- TIMESTAMP -> TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seat_status ON seats(event_id, status); -- add IF NOT EXISTS for safe reruns in PostgreSQL
CREATE INDEX IF NOT EXISTS idx_email_status ON email_queue(status, created_at); -- add IF NOT EXISTS for safe reruns in PostgreSQL

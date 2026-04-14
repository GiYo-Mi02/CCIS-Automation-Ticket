-- ============================================================
-- authorized_admins: whitelist of emails permitted to access
-- the CCIS Admin Console via Google OAuth.
-- ============================================================

CREATE TABLE IF NOT EXISTS authorized_admins (
  id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  role  TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed the 12 authorized UMAK emails
INSERT INTO authorized_admins (email) VALUES
  ('jmabignay.8869@umak.edu.ph'),
  ('sduno.k12254970@umak.edu.ph'),
  ('combao.8929@umak.edu.ph'),
  ('jurbano.k12255492@umak.edu.ph'),
  ('rmatencio.k12254702@umak.edu.ph'),
  ('pbuendia.k12043566@umak.edu.ph'),
  ('csiringan.k12257532@umak.edu.ph'),
  ('smerano.a12345466@umak.edu.ph'),
  ('isanesteban.8783@umak.edu.ph'),
  ('alexandra.macalla@umak.edu.ph'),
  ('ggonzales.k12254495@umak.edu.ph'),
  ('lbanalo.9684@umak.edu.ph')
ON CONFLICT (email) DO NOTHING;

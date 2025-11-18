-- Migration 003: Add Password Protection
-- Adds optional password protection for published reports

ALTER TABLE published_reports
ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN published_reports.password_hash IS 'Optional PBKDF2 hash with salt for password-protected reports';

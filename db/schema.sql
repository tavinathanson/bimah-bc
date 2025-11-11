-- Bimah BC Database Schema
-- PostgreSQL schema for published reports

-- Published reports metadata
CREATE TABLE published_reports (
  id SERIAL PRIMARY KEY,
  report_id TEXT UNIQUE NOT NULL,  -- e.g. 'xK9mP2qR8tBvN5hZ7wLcJ'
  title TEXT NOT NULL,              -- e.g. 'FY25 Pledge Report'
  snapshot_date DATE NOT NULL,      -- Date data was captured
  created_at TIMESTAMP DEFAULT NOW()
);

-- Anonymous pledge rows
CREATE TABLE report_rows (
  id SERIAL PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES published_reports(report_id) ON DELETE CASCADE,
  age INTEGER NOT NULL,
  pledge_current NUMERIC(10,2) NOT NULL,
  pledge_prior NUMERIC(10,2) NOT NULL,
  zip_code TEXT
);

-- Index for faster queries by report_id
CREATE INDEX idx_report_rows_report_id ON report_rows(report_id);

-- Comments for documentation
COMMENT ON TABLE published_reports IS 'Metadata for published pledge reports. Each report has a unique, unguessable ID.';
COMMENT ON TABLE report_rows IS 'Anonymous pledge data rows. Contains only age, pledge amounts, and optional ZIP code.';
COMMENT ON COLUMN published_reports.report_id IS '21-character nanoid (128-bit entropy) for secure, unguessable URLs';
COMMENT ON COLUMN published_reports.snapshot_date IS 'Date when the pledge data was captured. Ages are static snapshots.';

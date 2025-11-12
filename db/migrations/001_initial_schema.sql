-- Migration 001: Initial Schema
-- Creates the base tables for published reports

CREATE TABLE IF NOT EXISTS published_reports (
  id SERIAL PRIMARY KEY,
  report_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_rows (
  id SERIAL PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES published_reports(report_id) ON DELETE CASCADE,
  age INTEGER NOT NULL,
  pledge_current NUMERIC(10,2) NOT NULL,
  pledge_prior NUMERIC(10,2) NOT NULL,
  zip_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_report_rows_report_id ON report_rows(report_id);

COMMENT ON TABLE published_reports IS 'Metadata for published pledge reports. Each report has a unique, unguessable ID.';
COMMENT ON TABLE report_rows IS 'Anonymous pledge data rows. Contains only age, pledge amounts, and optional ZIP code.';
COMMENT ON COLUMN published_reports.report_id IS '21-character nanoid (128-bit entropy) for secure, unguessable URLs';
COMMENT ON COLUMN published_reports.snapshot_date IS 'Date when the pledge data was captured. Ages are static snapshots.';

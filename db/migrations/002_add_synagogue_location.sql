-- Migration 002: Add Synagogue Location
-- Adds columns for storing the synagogue's address and coordinates for geographic analysis

ALTER TABLE published_reports
ADD COLUMN IF NOT EXISTS synagogue_address TEXT,
ADD COLUMN IF NOT EXISTS synagogue_lat NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS synagogue_lng NUMERIC(10,7);

COMMENT ON COLUMN published_reports.synagogue_address IS 'Optional: Address for geographic analysis';
COMMENT ON COLUMN published_reports.synagogue_lat IS 'Optional: Latitude for geographic center';
COMMENT ON COLUMN published_reports.synagogue_lng IS 'Optional: Longitude for geographic center';

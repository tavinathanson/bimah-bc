/**
 * Database client that automatically switches between:
 * - SQLite (local development - no setup required!)
 * - Neon Postgres (production)
 *
 * Detects environment and uses the appropriate database.
 * Local development: SQLite file (bimah-local.db)
 * Production: Neon Postgres (from POSTGRES_URL env var)
 */

import postgres from 'postgres';

// Check if we're in production (Neon Postgres available)
const hasPostgres = process.env.POSTGRES_URL !== undefined;

// Create the appropriate SQL client
export const sql = hasPostgres
  ? postgres(process.env.POSTGRES_URL!)
  : require('./db-sqlite').sql;

// Log which database we're using (helpful for debugging)
if (process.env.NODE_ENV === 'development') {
  console.log(`📦 Database: ${hasPostgres ? 'Neon Postgres' : 'SQLite (local)'}`);
}

/**
 * Database client that automatically switches between:
 * - SQLite (local development - no setup required!)
 * - Vercel Postgres (production)
 *
 * Detects environment and uses the appropriate database.
 * Local development: SQLite file (bimah-local.db)
 * Production: Vercel Postgres (from POSTGRES_URL env var)
 */

// Check if we're in production (Vercel Postgres available)
const hasPostgres = process.env.POSTGRES_URL !== undefined;

// Re-export the appropriate SQL client
export const sql = hasPostgres
  ? require('@vercel/postgres').sql
  : require('./db-sqlite').sql;

// Log which database we're using (helpful for debugging)
if (process.env.NODE_ENV === 'development') {
  console.log(`📦 Database: ${hasPostgres ? 'Vercel Postgres' : 'SQLite (local)'}`);
}

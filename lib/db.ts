import { sql } from '@vercel/postgres';

/**
 * Database client using Vercel Postgres
 * Credentials are automatically loaded from environment variables:
 * - POSTGRES_URL (or individual POSTGRES_* variables)
 *
 * Usage:
 *   import { sql } from '@/lib/db';
 *   const result = await sql`SELECT * FROM published_reports`;
 */
export { sql };

#!/usr/bin/env tsx
/**
 * Database Migration Runner
 *
 * Runs SQL migrations against the Neon Postgres database.
 *
 * Usage:
 *   npm run db:migrate              - Run all pending migrations (uses .env.prod)
 *   npm run db:migrate:fresh        - Drop all tables and run all migrations from scratch
 *   npm run db:migrate -- --env=.env.local  - Use a different env file
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');

// Parse command line arguments
const args = process.argv.slice(2);
const envFileArg = args.find(arg => arg.startsWith('--env='));
const envFile = envFileArg ? envFileArg.split('=')[1] : '.env.prod';

// Load environment variables from specified file
const envPath = path.join(__dirname, '..', envFile);
if (fs.existsSync(envPath)) {
  console.log(`📄 Loading environment from: ${envFile}`);
  dotenv.config({ path: envPath });
} else {
  console.log(`⚠️  Warning: ${envFile} not found, using existing environment variables`);
}

// Check for POSTGRES_URL
if (!process.env.POSTGRES_URL) {
  console.error('❌ Error: POSTGRES_URL environment variable is not set');
  console.error('');
  console.error(`Make sure ${envFile} contains:`);
  console.error('  POSTGRES_URL=postgresql://user:pass@host/database');
  console.error('');
  console.error('Or run with a different env file:');
  console.error('  npm run db:migrate -- --env=.env.local');
  process.exit(1);
}

const sql = postgres(process.env.POSTGRES_URL);

async function runMigrations(fresh = false) {
  try {
    console.log('🔄 Connecting to database...');

    if (fresh) {
      console.log('⚠️  Running FRESH migration - dropping all tables!');
      console.log('');

      // Drop tables in correct order (foreign keys first)
      await sql`DROP TABLE IF EXISTS report_rows CASCADE`;
      await sql`DROP TABLE IF EXISTS published_reports CASCADE`;
      console.log('✓ Dropped all tables');
    }

    // Get all migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    console.log(`\n📁 Found ${files.length} migration(s)\n`);

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const migrationSQL = fs.readFileSync(filePath, 'utf-8');

      console.log(`🔄 Running migration: ${file}`);

      // Execute the migration
      await sql.unsafe(migrationSQL);

      console.log(`✅ Completed: ${file}\n`);
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Check if fresh migration is requested
const fresh = args.includes('--fresh') || args.includes('-f');

runMigrations(fresh);

/**
 * SQLite adapter for local development
 * Provides the same interface as Vercel Postgres for compatibility
 *
 * Uses the same migration files as Postgres to keep schemas in sync.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Initialize SQLite database
const dbPath = path.join(process.cwd(), 'bimah-local.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Convert Postgres SQL to SQLite-compatible SQL
 */
function postgrestoSqlite(sql: string): string {
  let result = sql
    // SERIAL -> INTEGER PRIMARY KEY AUTOINCREMENT
    .replace(/SERIAL\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    // NUMERIC(x,y) -> REAL
    .replace(/NUMERIC\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'REAL')
    // TIMESTAMP -> TEXT
    .replace(/TIMESTAMP/gi, 'TEXT')
    // DATE -> TEXT
    .replace(/\bDATE\b/gi, 'TEXT')
    // NOW() -> CURRENT_TIMESTAMP
    .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP')
    // Remove COMMENT statements (not supported in SQLite)
    .replace(/COMMENT\s+ON\s+[^;]+;/gi, '')
    // Remove IF NOT EXISTS from ADD COLUMN (SQLite doesn't support it)
    .replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi, 'ADD COLUMN');

  // Split multi-column ALTER TABLE into separate statements
  // Postgres: ALTER TABLE t ADD COLUMN a TEXT, ADD COLUMN b TEXT;
  // SQLite:   ALTER TABLE t ADD COLUMN a TEXT; ALTER TABLE t ADD COLUMN b TEXT;
  result = result.replace(
    /ALTER\s+TABLE\s+(\w+)\s+(ADD\s+COLUMN\s+[^,;]+(?:,\s*ADD\s+COLUMN\s+[^,;]+)+);/gi,
    (match, tableName, columns) => {
      const addStatements = columns.split(/,\s*(?=ADD\s+COLUMN)/i);
      return addStatements
        .map((stmt: string) => `ALTER TABLE ${tableName} ${stmt.trim()};`)
        .join('\n');
    }
  );

  return result;
}

/**
 * Run migrations from db/migrations directory
 */
const runMigrations = () => {
  // Create migrations tracking table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get list of applied migrations
  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[])
      .map(row => row.name)
  );

  // Get migration files
  const migrationsDir = path.join(process.cwd(), 'db', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.log('⚠️  No migrations directory found');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let migrationsRun = 0;

  for (const file of files) {
    if (applied.has(file)) {
      continue; // Already applied
    }

    const filePath = path.join(migrationsDir, file);
    const migrationSQL = fs.readFileSync(filePath, 'utf-8');
    const sqliteSQL = postgrestoSqlite(migrationSQL);

    console.log(`🔄 [SQLite] Running migration: ${file}`);

    try {
      // Split by semicolons and run each statement
      const statements = sqliteSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch (err: any) {
          // Ignore "duplicate column" errors for ADD COLUMN
          if (err.message?.includes('duplicate column')) {
            continue;
          }
          throw err;
        }
      }

      // Record migration as applied
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
      migrationsRun++;
      console.log(`✅ [SQLite] Completed: ${file}`);
    } catch (error) {
      console.error(`❌ [SQLite] Migration failed: ${file}`, error);
      throw error;
    }
  }

  if (migrationsRun > 0) {
    console.log(`🎉 [SQLite] ${migrationsRun} migration(s) applied`);
  }
};

// Run migrations on first import
runMigrations();

/**
 * SQL template tag that mimics Vercel Postgres API
 * Usage: sql`SELECT * FROM table WHERE id = ${id}`
 */
export function sql(strings: TemplateStringsArray, ...values: any[]) {
  // Build the SQL query
  let query = '';
  const params: any[] = [];

  for (let i = 0; i < strings.length; i++) {
    query += strings[i];
    if (i < values.length) {
      query += '?';
      params.push(values[i]);
    }
  }

  // Detect query type
  const trimmedQuery = query.trim().toUpperCase();

  try {
    if (trimmedQuery.startsWith('SELECT')) {
      // SELECT query - return rows
      const stmt = db.prepare(query);
      const rows = stmt.all(...params);
      return Promise.resolve({ rows, rowCount: rows.length });
    } else if (trimmedQuery.startsWith('INSERT') || trimmedQuery.startsWith('UPDATE') || trimmedQuery.startsWith('DELETE')) {
      // INSERT/UPDATE/DELETE - return affected rows
      const stmt = db.prepare(query);
      const info = stmt.run(...params);
      return Promise.resolve({ rows: [], rowCount: info.changes });
    } else {
      // Other queries
      const stmt = db.prepare(query);
      stmt.run(...params);
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
  } catch (error) {
    console.error('SQLite query error:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

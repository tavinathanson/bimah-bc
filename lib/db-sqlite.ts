/**
 * SQLite adapter for local development
 * Provides the same interface as Vercel Postgres for compatibility
 */

import Database from 'better-sqlite3';
import path from 'path';

// Initialize SQLite database
const dbPath = path.join(process.cwd(), 'bimah-local.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema if tables don't exist
const initSchema = () => {
  // Check if tables exist
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='published_reports'"
  ).get();

  if (!tableExists) {
    console.log('Initializing SQLite database schema...');

    // Create tables
    db.exec(`
      CREATE TABLE published_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE report_rows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id TEXT NOT NULL,
        age INTEGER NOT NULL,
        pledge_current REAL NOT NULL,
        pledge_prior REAL NOT NULL,
        zip_code TEXT,
        FOREIGN KEY (report_id) REFERENCES published_reports(report_id) ON DELETE CASCADE
      );

      CREATE INDEX idx_report_rows_report_id ON report_rows(report_id);
    `);

    console.log('✓ SQLite database initialized at:', dbPath);
  }
};

// Initialize on first import
initSchema();

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

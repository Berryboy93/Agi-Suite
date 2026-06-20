import Database from 'better-sqlite3';
import { unlink } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = join(__dirname, '../../.test-db.sqlite');

export interface TestDbContext {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  cleanup: () => Promise<void>;
  db: Database.Database;
}

export async function setupTestDb(): Promise<TestDbContext> {
  const db = new Database(TEST_DB_PATH);

  db.exec(`CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    resource TEXT NOT NULL,
    requester TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS approval_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT UNIQUE,
    event_type TEXT NOT NULL,
    approval_id TEXT NOT NULL,
    status TEXT NOT NULL,
    resource TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    payload TEXT NOT NULL,
    redaction_stage INTEGER DEFAULT 0,
    redacted_at DATETIME,
    redacted_by TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS approval_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    approval_id TEXT NOT NULL,
    action TEXT NOT NULL,
    note TEXT,
    metadata TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS event_redactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    stage INTEGER NOT NULL,
    action TEXT NOT NULL,
    metadata TEXT
  )`);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_approvals_resource ON approvals(resource)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_approval_history_approval_id ON approval_history(approval_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_approval_events_approval_id ON approval_events(approval_id)`);

  // Seed test data
  db.prepare(`INSERT INTO approvals (id, status, resource, requester) VALUES (?, ?, ?, ?)`).run('APR-001', 'PENDING', 'test-resource-1', 'test-requester');
  db.prepare(`INSERT INTO approvals (id, status, resource, requester) VALUES (?, ?, ?, ?)`).run('APR-002', 'PENDING', 'test-resource-2', 'test-requester');

  return {
    query: async (sql: string, params?: unknown[]) => {
      const convertedSql = sql.replace(/\$\d+/g, '?');
      const stmt = db.prepare(convertedSql);
      const rows = stmt.all(...(params || [])) as Record<string, unknown>[];
      return { rows };
    },
    cleanup: async () => {
      db.close();
      try { await unlink(TEST_DB_PATH); } catch {}
    },
    db,
  };
}

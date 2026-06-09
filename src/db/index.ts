import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import { config } from '../config';
import logger from '../utils/logger';

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;

async function initSql(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => {
        const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
        if (fs.existsSync(wasmPath)) {
          return wasmPath;
        }
        return `https://sql.js.org/dist/${file}`;
      },
    });
  }
  return SQL;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    const SQL = await initSql();
    const dbPath = config.database.path;
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

    logger.info(`Database connected: ${dbPath}`);
  }
  return db;
}

export async function initDb(): Promise<void> {
  const database = await getDb();

  database.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT,
      content TEXT NOT NULL,
      engine TEXT NOT NULL DEFAULT 'handlebars',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      channels TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      silent_hours_start TEXT,
      silent_hours_end TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, category)
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      category TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_snapshot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TEXT,
      read_at TEXT,
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata TEXT
    );
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON notification_logs(channel)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS in_app_notifications (
      id TEXT PRIMARY KEY,
      notification_log_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  database.run(`CREATE INDEX IF NOT EXISTS idx_in_app_user_id ON in_app_notifications(user_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_in_app_is_read ON in_app_notifications(is_read)`);

  database.run(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      id TEXT PRIMARY KEY,
      total_count INTEGER NOT NULL,
      completed_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  logger.info('Database tables initialized');
}

export function saveDb(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dbPath = config.database.path;
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    fs.writeFileSync(dbPath, buffer);
  }
}

export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

setInterval(() => {
  if (db) {
    saveDb();
  }
}, 5000);

process.on('exit', () => {
  closeDb();
});

export default { getDb, initDb, closeDb, saveDb };

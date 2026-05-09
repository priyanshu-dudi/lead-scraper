// ============================================================
// LeadForge Ultimate — SQLite Database Setup
// ============================================================
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../exports/leadforge.db');

export function setupDatabase() {
  // Ensure exports dir exists
  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Create Leads Table ────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT NOT NULL,
      business_name TEXT,
      owner_name    TEXT,
      niche         TEXT,
      phone         TEXT,
      whatsapp      TEXT,
      email         TEXT,
      linkedin_url  TEXT,
      instagram_url TEXT,
      facebook_url  TEXT,
      telegram      TEXT,
      website_url   TEXT,
      city          TEXT,
      state         TEXT,
      country       TEXT,
      pin_code      TEXT,
      source_url    TEXT,
      lead_score    INTEGER DEFAULT 0,
      is_duplicate  INTEGER DEFAULT 0,
      raw_data      TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_leads_session    ON leads(session_id);
    CREATE INDEX IF NOT EXISTS idx_leads_email      ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_leads_phone      ON leads(phone);
    CREATE INDEX IF NOT EXISTS idx_leads_niche      ON leads(niche);
    CREATE INDEX IF NOT EXISTS idx_leads_city       ON leads(city);
    CREATE INDEX IF NOT EXISTS idx_leads_score      ON leads(lead_score DESC);

    CREATE TABLE IF NOT EXISTS scraping_sessions (
      id            TEXT PRIMARY KEY,
      status        TEXT DEFAULT 'pending',
      config        TEXT,
      leads_found   INTEGER DEFAULT 0,
      pages_crawled INTEGER DEFAULT 0,
      errors        INTEGER DEFAULT 0,
      started_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at  DATETIME,
      duration_secs INTEGER
    );

    CREATE TABLE IF NOT EXISTS scraping_queue (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    TEXT,
      url           TEXT NOT NULL,
      source        TEXT,
      depth         INTEGER DEFAULT 0,
      status        TEXT DEFAULT 'pending',
      engine        TEXT DEFAULT 'httpx',
      priority      INTEGER DEFAULT 5,
      attempts      INTEGER DEFAULT 0,
      error_msg     TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at  DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_queue_session  ON scraping_queue(session_id, status);
    CREATE INDEX IF NOT EXISTS idx_queue_priority ON scraping_queue(priority DESC, created_at);

    CREATE TABLE IF NOT EXISTS scraping_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      level      TEXT DEFAULT 'info',
      message    TEXT,
      data       TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_logs_session ON scraping_logs(session_id);
  `);

  return db;
}

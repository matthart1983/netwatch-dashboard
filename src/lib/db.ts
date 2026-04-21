import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const DATA_DIR = process.env.NETWATCH_DASHBOARD_DATA_DIR
  || path.join(process.env.HOME || process.cwd(), '.netwatch-dashboard')

fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'dashboard.db')

declare global {
  var __netwatchDb: Database.Database | undefined
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number | null }
  const current = row?.v ?? 0

  if (current < 1) {
    db.exec(`
      CREATE TABLE hosts (
        id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        os TEXT,
        kernel TEXT,
        agent_version TEXT,
        uptime_secs INTEGER,
        cpu_model TEXT,
        cpu_cores INTEGER,
        memory_total_bytes INTEGER,
        last_seen_at TEXT NOT NULL,
        is_online INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
        time TEXT NOT NULL,
        gateway_rtt_ms REAL,
        gateway_loss_pct REAL,
        dns_rtt_ms REAL,
        dns_loss_pct REAL,
        connection_count INTEGER,
        cpu_usage_pct REAL,
        memory_used_bytes INTEGER,
        memory_available_bytes INTEGER,
        load_avg_1m REAL,
        load_avg_5m REAL,
        load_avg_15m REAL,
        swap_total_bytes INTEGER,
        swap_used_bytes INTEGER,
        disk_read_bytes INTEGER,
        disk_write_bytes INTEGER,
        disk_usage_pct REAL,
        tcp_time_wait INTEGER,
        tcp_close_wait INTEGER,
        net_rx_bytes INTEGER,
        net_tx_bytes INTEGER,
        net_rx_rate_bps REAL,
        net_tx_rate_bps REAL,
        cpu_per_core TEXT,
        payload TEXT NOT NULL
      );
      CREATE INDEX idx_snapshots_host_time ON snapshots(host_id, time DESC);

      CREATE TABLE agent_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
        time TEXT NOT NULL,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX idx_agent_alerts_host_time ON agent_alerts(host_id, time DESC);

      CREATE TABLE dashboards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tags TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE panels (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        query TEXT NOT NULL,
        config TEXT NOT NULL,
        position_x INTEGER NOT NULL,
        position_y INTEGER NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL
      );

      CREATE TABLE sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        config TEXT NOT NULL
      );

      INSERT INTO schema_version (version) VALUES (1);
    `)
  }

  if (current < 2) {
    db.exec(`
      CREATE TABLE alert_rules (
        id TEXT PRIMARY KEY,
        host_id TEXT REFERENCES hosts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        metric TEXT NOT NULL,
        condition TEXT NOT NULL,
        threshold REAL,
        threshold_str TEXT,
        duration_secs INTEGER NOT NULL DEFAULT 0,
        severity TEXT NOT NULL DEFAULT 'warning',
        enabled INTEGER NOT NULL DEFAULT 1,
        current_state TEXT NOT NULL DEFAULT 'ok',
        last_evaluated_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
      CREATE INDEX idx_alert_rules_host ON alert_rules(host_id);

      CREATE TABLE alert_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
        host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
        state TEXT NOT NULL,
        metric_value REAL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
      );
      CREATE INDEX idx_alert_events_rule ON alert_events(rule_id, created_at DESC);
      CREATE INDEX idx_alert_events_host ON alert_events(host_id, created_at DESC);

      INSERT INTO schema_version (version) VALUES (2);
    `)
  }
}

export function getDb(): Database.Database {
  if (!global.__netwatchDb) {
    const db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db)
    global.__netwatchDb = db
  }
  return global.__netwatchDb
}

export const dataDir = DATA_DIR

import { getDb } from './db'

const ONLINE_WINDOW_SECS = 120

export interface Host {
  id: string
  hostname: string
  os: string | null
  kernel: string | null
  agent_version: string | null
  is_online: boolean
  last_seen_at: string
  uptime_secs: number | null
  cpu_model: string | null
  cpu_cores: number | null
  memory_total_bytes: number | null
}

interface HostRow {
  id: string
  hostname: string
  os: string | null
  kernel: string | null
  agent_version: string | null
  last_seen_at: string
  uptime_secs: number | null
  cpu_model: string | null
  cpu_cores: number | null
  memory_total_bytes: number | null
  seconds_since_seen: number | null
}

function rowToHost(r: HostRow): Host {
  return {
    id: r.id,
    hostname: r.hostname,
    os: r.os,
    kernel: r.kernel,
    agent_version: r.agent_version,
    last_seen_at: r.last_seen_at,
    is_online: r.seconds_since_seen != null && r.seconds_since_seen < ONLINE_WINDOW_SECS,
    uptime_secs: r.uptime_secs,
    cpu_model: r.cpu_model,
    cpu_cores: r.cpu_cores,
    memory_total_bytes: r.memory_total_bytes,
  }
}

const SELECT_FIELDS = `
  id, hostname, os, kernel, agent_version,
  strftime('%Y-%m-%dT%H:%M:%SZ', last_seen_at) AS last_seen_at,
  uptime_secs, cpu_model, cpu_cores, memory_total_bytes,
  CAST(strftime('%s','now') - strftime('%s', last_seen_at) AS INTEGER) AS seconds_since_seen
`

export function listHosts(): Host[] {
  const rows = getDb().prepare(`SELECT ${SELECT_FIELDS} FROM hosts ORDER BY hostname`).all() as HostRow[]
  return rows.map(rowToHost)
}

export function getHost(id: string): Host | null {
  const row = getDb().prepare(`SELECT ${SELECT_FIELDS} FROM hosts WHERE id = ?`).get(id) as HostRow | undefined
  return row ? rowToHost(row) : null
}

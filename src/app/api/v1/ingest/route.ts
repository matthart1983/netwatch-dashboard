import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { checkBearer } from '@/lib/config'
import { evaluateRulesForSnapshot } from '@/lib/alerts'
import type {
  IngestRequest,
  IngestResponse,
  Snapshot,
  SnapshotResult,
} from '@/lib/ingest-types'

export const runtime = 'nodejs'

const MAX_BATCH = 100
const MIN_INTERVAL_SECS = 10

interface HotColumns {
  gateway_rtt_ms: number | null
  gateway_loss_pct: number | null
  dns_rtt_ms: number | null
  dns_loss_pct: number | null
  connection_count: number | null
  cpu_usage_pct: number | null
  memory_used_bytes: number | null
  memory_available_bytes: number | null
  load_avg_1m: number | null
  load_avg_5m: number | null
  load_avg_15m: number | null
  swap_total_bytes: number | null
  swap_used_bytes: number | null
  disk_read_bytes: number | null
  disk_write_bytes: number | null
  disk_usage_pct: number | null
  tcp_time_wait: number | null
  tcp_close_wait: number | null
  net_rx_bytes: number | null
  net_tx_bytes: number | null
  net_rx_rate_bps: number | null
  net_tx_rate_bps: number | null
  cpu_per_core: string | null
}

function extractHot(s: Snapshot): HotColumns {
  const h = s.health ?? null
  const sys = s.system ?? null
  const io = s.disk_io ?? null
  const maxDiskPct = s.disk_usage?.reduce<number | null>(
    (max, d) => (max == null || d.usage_pct > max ? d.usage_pct : max),
    null,
  ) ?? null

  let rxBytes = 0, txBytes = 0, rxRate = 0, txRate = 0
  let sawInterface = false
  for (const iface of s.interfaces ?? []) {
    if (iface.name === 'lo' || iface.name.startsWith('lo0')) continue
    sawInterface = true
    rxBytes += iface.rx_bytes
    txBytes += iface.tx_bytes
    rxRate += iface.rx_rate ?? 0
    txRate += iface.tx_rate ?? 0
  }

  return {
    gateway_rtt_ms: h?.gateway_rtt_ms ?? null,
    gateway_loss_pct: h?.gateway_loss_pct ?? null,
    dns_rtt_ms: h?.dns_rtt_ms ?? null,
    dns_loss_pct: h?.dns_loss_pct ?? null,
    connection_count: s.connection_count ?? null,
    cpu_usage_pct: sys?.cpu_usage_pct ?? null,
    memory_used_bytes: sys?.memory_used_bytes ?? null,
    memory_available_bytes: sys?.memory_available_bytes ?? null,
    load_avg_1m: sys?.load_avg_1m ?? null,
    load_avg_5m: sys?.load_avg_5m ?? null,
    load_avg_15m: sys?.load_avg_15m ?? null,
    swap_total_bytes: sys?.swap_total_bytes ?? null,
    swap_used_bytes: sys?.swap_used_bytes ?? null,
    disk_read_bytes: io?.read_bytes ?? null,
    disk_write_bytes: io?.write_bytes ?? null,
    disk_usage_pct: maxDiskPct,
    tcp_time_wait: s.tcp_time_wait ?? null,
    tcp_close_wait: s.tcp_close_wait ?? null,
    net_rx_bytes: sawInterface ? rxBytes : null,
    net_tx_bytes: sawInterface ? txBytes : null,
    net_rx_rate_bps: sawInterface ? rxRate : null,
    net_tx_rate_bps: sawInterface ? txRate : null,
    cpu_per_core: sys?.cpu_per_core ? JSON.stringify(sys.cpu_per_core) : null,
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!checkBearer(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let payload: IngestRequest
  try {
    payload = (await req.json()) as IngestRequest
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!payload.host?.host_id || !payload.snapshots) {
    return NextResponse.json({ error: 'missing host or snapshots' }, { status: 400 })
  }
  if (payload.snapshots.length === 0) {
    return NextResponse.json({ error: 'no snapshots' }, { status: 400 })
  }
  if (payload.snapshots.length > MAX_BATCH) {
    return NextResponse.json({ error: 'batch too large' }, { status: 413 })
  }

  const db = getDb()
  const hostId = payload.host.host_id

  const lastRow = db.prepare(
    `SELECT strftime('%s','now') - strftime('%s', last_seen_at) AS age FROM hosts WHERE id = ?`,
  ).get(hostId) as { age: number | null } | undefined
  if (lastRow?.age != null && lastRow.age >= 0 && lastRow.age < MIN_INTERVAL_SECS) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }

  const upsertHost = db.prepare(`
    INSERT INTO hosts (id, hostname, os, kernel, agent_version, uptime_secs, cpu_model, cpu_cores, memory_total_bytes, last_seen_at, is_online)
    VALUES (@id, @hostname, @os, @kernel, @agent_version, @uptime_secs, @cpu_model, @cpu_cores, @memory_total_bytes, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 1)
    ON CONFLICT(id) DO UPDATE SET
      hostname = excluded.hostname,
      os = excluded.os,
      kernel = excluded.kernel,
      agent_version = excluded.agent_version,
      uptime_secs = excluded.uptime_secs,
      cpu_model = excluded.cpu_model,
      cpu_cores = excluded.cpu_cores,
      memory_total_bytes = excluded.memory_total_bytes,
      last_seen_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
      is_online = 1
  `)

  const insertSnapshot = db.prepare(`
    INSERT INTO snapshots (
      host_id, time,
      gateway_rtt_ms, gateway_loss_pct, dns_rtt_ms, dns_loss_pct,
      connection_count, cpu_usage_pct, memory_used_bytes, memory_available_bytes,
      load_avg_1m, load_avg_5m, load_avg_15m, swap_total_bytes, swap_used_bytes,
      disk_read_bytes, disk_write_bytes, disk_usage_pct,
      tcp_time_wait, tcp_close_wait,
      net_rx_bytes, net_tx_bytes, net_rx_rate_bps, net_tx_rate_bps,
      cpu_per_core, payload
    ) VALUES (
      @host_id, @time,
      @gateway_rtt_ms, @gateway_loss_pct, @dns_rtt_ms, @dns_loss_pct,
      @connection_count, @cpu_usage_pct, @memory_used_bytes, @memory_available_bytes,
      @load_avg_1m, @load_avg_5m, @load_avg_15m, @swap_total_bytes, @swap_used_bytes,
      @disk_read_bytes, @disk_write_bytes, @disk_usage_pct,
      @tcp_time_wait, @tcp_close_wait,
      @net_rx_bytes, @net_tx_bytes, @net_rx_rate_bps, @net_tx_rate_bps,
      @cpu_per_core, @payload
    )
  `)

  const insertAlert = db.prepare(`
    INSERT INTO agent_alerts (host_id, time, severity, category, message, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const results: SnapshotResult[] = []
  let accepted = 0
  let rejected = 0

  const tx = db.transaction(() => {
    upsertHost.run({
      id: hostId,
      hostname: payload.host.hostname,
      os: payload.host.os ?? null,
      kernel: payload.host.kernel ?? null,
      agent_version: payload.agent_version,
      uptime_secs: payload.host.uptime_secs ?? null,
      cpu_model: payload.host.cpu_model ?? null,
      cpu_cores: payload.host.cpu_cores ?? null,
      memory_total_bytes: payload.host.memory_total_bytes ?? null,
    })

    payload.snapshots.forEach((snap, index) => {
      try {
        const hot = extractHot(snap)
        insertSnapshot.run({
          host_id: hostId,
          time: snap.timestamp,
          ...hot,
          payload: JSON.stringify(snap),
        })
        for (const alert of snap.alerts ?? []) {
          insertAlert.run(hostId, alert.time, alert.severity, alert.category, alert.message, alert.detail ?? '')
        }
        evaluateRulesForSnapshot(hostId, {
          gateway_rtt_ms: hot.gateway_rtt_ms,
          gateway_loss_pct: hot.gateway_loss_pct,
          dns_rtt_ms: hot.dns_rtt_ms,
          dns_loss_pct: hot.dns_loss_pct,
          connection_count: hot.connection_count,
          cpu_usage_pct: hot.cpu_usage_pct,
          swap_used_bytes: hot.swap_used_bytes,
          disk_usage_pct: hot.disk_usage_pct,
          disk_read_bytes: hot.disk_read_bytes,
          disk_write_bytes: hot.disk_write_bytes,
          tcp_time_wait: hot.tcp_time_wait,
          tcp_close_wait: hot.tcp_close_wait,
        })
        accepted++
        results.push({ index, status: 200, message: 'ok' })
      } catch (err) {
        rejected++
        results.push({
          index,
          status: 500,
          message: err instanceof Error ? err.message : 'insert failed',
        })
      }
    })
  })
  tx()

  const body: IngestResponse = { accepted, rejected, host_id: hostId, results }
  return NextResponse.json(body)
}

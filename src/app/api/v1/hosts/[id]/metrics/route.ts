import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

interface Row {
  time: string
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

const DEFAULT_WINDOW_SECS = 3600

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  const { id } = await ctx.params

  const url = new URL(req.url)
  const toParam = url.searchParams.get('to')
  const fromParam = url.searchParams.get('from')
  const to = toParam ?? new Date().toISOString()
  const from = fromParam ?? new Date(Date.parse(to) - DEFAULT_WINDOW_SECS * 1000).toISOString()

  const rows = getDb().prepare(`
    SELECT time, gateway_rtt_ms, gateway_loss_pct, dns_rtt_ms, dns_loss_pct,
           connection_count, cpu_usage_pct, memory_used_bytes, memory_available_bytes,
           load_avg_1m, load_avg_5m, load_avg_15m, swap_total_bytes, swap_used_bytes,
           disk_read_bytes, disk_write_bytes, disk_usage_pct,
           tcp_time_wait, tcp_close_wait,
           net_rx_bytes, net_tx_bytes, net_rx_rate_bps, net_tx_rate_bps,
           cpu_per_core
    FROM snapshots
    WHERE host_id = ? AND time >= ? AND time <= ?
    ORDER BY time ASC
  `).all(id, from, to) as Row[]

  const points = rows.map(r => ({
    ...r,
    cpu_per_core: r.cpu_per_core ? JSON.parse(r.cpu_per_core) as number[] : null,
  }))

  return NextResponse.json({ host_id: id, from, to, points })
}

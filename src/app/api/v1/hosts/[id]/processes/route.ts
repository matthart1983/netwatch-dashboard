import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { getLatestSnapshot } from '@/lib/latest-snapshot'

export const runtime = 'nodejs'

interface AgentProcess {
  process_name: string
  pid: number | null
  rx_bytes: number
  tx_bytes: number
  rx_rate: number
  tx_rate: number
  connection_count: number
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  const { id } = await ctx.params

  const latest = getLatestSnapshot(id)
  if (!latest) return NextResponse.json({ time: null, processes: [] })

  const agentProcs = (latest.snapshot.processes ?? []) as AgentProcess[]
  const processes = agentProcs.map(p => ({
    process_name: p.process_name,
    pid: p.pid,
    rx_bytes: p.rx_bytes,
    tx_bytes: p.tx_bytes,
    rx_rate_bps: p.rx_rate,
    tx_rate_bps: p.tx_rate,
    connection_count: p.connection_count,
  }))

  return NextResponse.json({ time: latest.time, processes })
}

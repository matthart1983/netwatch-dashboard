import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

interface AlertRow {
  id: number
  time: string
  severity: string
  category: string
  message: string
  detail: string
}

const DEFAULT_WINDOW_SECS = 86400

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
    SELECT id, time, severity, category, message, detail
    FROM agent_alerts
    WHERE host_id = ? AND time >= ? AND time <= ?
    ORDER BY time DESC
    LIMIT 500
  `).all(id, from, to) as AlertRow[]

  return NextResponse.json(rows)
}

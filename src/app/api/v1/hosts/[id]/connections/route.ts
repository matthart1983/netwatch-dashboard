import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { getLatestSnapshot } from '@/lib/latest-snapshot'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  const { id } = await ctx.params

  const latest = getLatestSnapshot(id)
  if (!latest) return NextResponse.json({ time: null, connections: [] })

  return NextResponse.json({
    time: latest.time,
    connections: latest.snapshot.connections ?? [],
  })
}

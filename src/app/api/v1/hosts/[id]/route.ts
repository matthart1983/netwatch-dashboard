import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { getHost } from '@/lib/hosts'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  const { id } = await ctx.params
  const host = getHost(id)
  if (!host) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(host)
}

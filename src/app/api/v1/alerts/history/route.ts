import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { listEvents } from '@/lib/alerts'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  const hostId = new URL(req.url).searchParams.get('host_id') ?? undefined
  return NextResponse.json(listEvents(hostId))
}

import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { listHosts } from '@/lib/hosts'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  return NextResponse.json(listHosts())
}

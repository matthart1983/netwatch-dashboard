import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { getLatestSnapshot } from '@/lib/latest-snapshot'

export const runtime = 'nodejs'

interface AgentDnsAnalytics {
  total_queries: number
  total_responses: number
  nxdomain_count: number
  latency_buckets: number[]
  top_domains: [string, number][]
}

const EMPTY = {
  total_queries: 0,
  total_responses: 0,
  nxdomain_count: 0,
  latency_buckets: [0, 0, 0, 0, 0, 0, 0, 0],
  top_domains: [] as { name: string; count: number }[],
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  const { id } = await ctx.params

  const latest = getLatestSnapshot(id)
  if (!latest) return NextResponse.json({ time: null, ...EMPTY })

  const dns = latest.snapshot.dns_analytics as AgentDnsAnalytics | null | undefined
  if (!dns) return NextResponse.json({ time: latest.time, ...EMPTY })

  return NextResponse.json({
    time: latest.time,
    total_queries: dns.total_queries,
    total_responses: dns.total_responses,
    nxdomain_count: dns.nxdomain_count,
    latency_buckets: dns.latency_buckets,
    top_domains: dns.top_domains.map(([name, count]) => ({ name, count })),
  })
}

import { NextResponse } from 'next/server'
import { getStars } from '@/lib/github-stars'

export const revalidate = 21600 // 6 hours

export async function GET() {
  const [netwatch, syswatch, diskwatch, essh] = await Promise.all([
    getStars('matthart1983/netwatch', 1597),
    getStars('matthart1983/syswatch', 284),
    getStars('matthart1983/diskwatch', 0),
    getStars('matthart1983/essh', 57),
  ])
  const total = netwatch + syswatch + diskwatch + essh
  return NextResponse.json(
    { netwatch, syswatch, diskwatch, essh, total },
    { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
  )
}

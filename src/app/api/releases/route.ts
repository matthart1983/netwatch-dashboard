import { NextResponse } from 'next/server'

export const revalidate = 21600 // 6 hours

interface GhRelease {
  tag_name?: string
  name?: string | null
  published_at?: string | null
  html_url?: string
  draft?: boolean
  prerelease?: boolean
}

export interface ReleaseEntry {
  project: string
  version: string
  date: string
  url: string
  prerelease: boolean
}

const REPOS = [
  { project: 'netwatch', repo: 'matthart1983/netwatch' },
  { project: 'syswatch', repo: 'matthart1983/syswatch' },
  { project: 'diskwatch', repo: 'matthart1983/diskwatch' },
  { project: 'essh', repo: 'matthart1983/essh' },
] as const

const FALLBACKS: ReleaseEntry[] = [
  { project: 'syswatch', version: 'v0.1.1', date: '2026-05-02', url: 'https://github.com/matthart1983/syswatch/releases/tag/v0.1.1', prerelease: false },
  { project: 'syswatch', version: 'v0.1.0', date: '2026-05-02', url: 'https://github.com/matthart1983/syswatch/releases/tag/v0.1.0', prerelease: false },
  { project: 'netwatch', version: 'v0.14.1', date: '2026-04-29', url: 'https://github.com/matthart1983/netwatch/releases/tag/v0.14.1', prerelease: false },
  { project: 'diskwatch', version: 'v0.1.1', date: '2026-05-18', url: 'https://github.com/matthart1983/diskwatch/releases/tag/v0.1.1', prerelease: false },
  { project: 'netwatch', version: 'v0.13.0', date: '2026-04-22', url: 'https://github.com/matthart1983/netwatch/releases/tag/v0.13.0', prerelease: false },
]

async function fetchProjectReleases(project: string, repo: string): Promise<ReleaseEntry[]> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=3`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 21600 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as GhRelease[]
    return data
      .filter(r => !r.draft && r.tag_name && r.published_at)
      .filter(r => !/-(rc|alpha|beta|pre)\b/i.test(r.tag_name as string))
      .map(r => ({
        project,
        version: r.tag_name as string,
        date: (r.published_at as string).slice(0, 10),
        url: r.html_url ?? `https://github.com/${repo}/releases/tag/${r.tag_name}`,
        prerelease: !!r.prerelease,
      }))
  } catch {
    return []
  }
}

export async function GET() {
  const results = await Promise.all(REPOS.map(r => fetchProjectReleases(r.project, r.repo)))
  let merged = results.flat().filter(r => !r.prerelease)

  if (merged.length < 4) {
    const seen = new Set(merged.map(r => `${r.project}@${r.version}`))
    for (const fb of FALLBACKS) {
      if (!seen.has(`${fb.project}@${fb.version}`)) merged.push(fb)
    }
  }

  merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  merged = merged.slice(0, 6)

  return NextResponse.json(
    { releases: merged },
    { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
  )
}

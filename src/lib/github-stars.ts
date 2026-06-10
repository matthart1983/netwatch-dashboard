type StarsResponse = { stargazers_count?: number }

const SIX_HOURS = 60 * 60 * 6

async function fetchStars(repo: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: SIX_HOURS },
    })
    if (!res.ok) return null
    const data = (await res.json()) as StarsResponse
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null
  } catch {
    return null
  }
}

export async function getStars(repo: string, fallback: number): Promise<number> {
  const live = await fetchStars(repo)
  return live ?? fallback
}

// ── Latest release version, live from GitHub (same 6h-cached pattern) ────────
type ReleaseResponse = { tag_name?: string }

async function fetchLatestRelease(repo: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: SIX_HOURS },
    })
    if (!res.ok) return null
    const data = (await res.json()) as ReleaseResponse
    return typeof data.tag_name === 'string' && data.tag_name.length > 0 ? data.tag_name : null
  } catch {
    return null
  }
}

/** Latest release tag for a repo (e.g. "v0.25.0"), falling back to a static value. */
export async function getLatestVersion(repo: string, fallback: string): Promise<string> {
  const live = await fetchLatestRelease(repo)
  return live ?? fallback
}

export async function getTotalStars(
  repos: { repo: string; fallback: number }[],
): Promise<number> {
  const counts = await Promise.all(repos.map(({ repo, fallback }) => getStars(repo, fallback)))
  return counts.reduce((a, b) => a + b, 0)
}

export function formatStars(n: number): string {
  if (n >= 1000) {
    const thousands = n / 1000
    return thousands >= 10 ? `${Math.round(thousands)}k` : `${thousands.toFixed(1)}k`
  }
  return String(n)
}

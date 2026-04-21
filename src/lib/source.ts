export type SourceKind = 'local' | 'core'

const raw = process.env.NEXT_PUBLIC_NETWATCH_SOURCE
export const SOURCE_KIND: SourceKind = raw === 'core' ? 'core' : 'local'

export const SOURCE_BASE_URL: string =
  SOURCE_KIND === 'core'
    ? (process.env.NEXT_PUBLIC_NETWATCH_CORE_URL || 'http://localhost:3001')
    : ''

declare global {
  interface Window {
    __NETWATCH_TOKEN__?: string
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  if (SOURCE_KIND === 'local') return window.__NETWATCH_TOKEN__ ?? null
  return localStorage.getItem('token')
}

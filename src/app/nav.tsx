'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { getAlertHistory } from '@/lib/api'

const signedInLinks = [
  { href: '/', label: 'Fleet' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/settings', label: 'Settings' },
]

export function Nav() {
  const { token, isLoading, logout } = useAuth()
  const pathname = usePathname()
  const [firingCount, setFiringCount] = useState(0)

  // Poll firing alerts count every 30s so the nav badge stays accurate
  // across tabs. Silent on error.
  useEffect(() => {
    if (!token) { setFiringCount(0); return }
    let cancelled = false
    const load = async () => {
      try {
        const events = await getAlertHistory()
        if (!cancelled) setFiringCount(events.filter(e => e.state === 'firing').length)
      } catch { /* ignore */ }
    }
    void load()
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [token])

  // Landing page and Labs pages have their own navs
  if (!isLoading && !token && pathname === '/') return null
  if (pathname?.startsWith('/labs')) return null

  return (
    <nav className="sticky top-0 z-40 border-b border-white/6 bg-[#08111a]/78 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 md:h-[4.5rem] md:flex-row md:items-center md:justify-between md:gap-6 md:py-0">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(61,214,198,0.25)] bg-[rgba(61,214,198,0.12)] text-sm font-semibold text-[var(--nw-text)] shadow-[0_10px_30px_rgba(61,214,198,0.18)]">
            NW
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--nw-text-soft)]">
              NetWatch Cloud
            </div>
            <div className="hidden truncate text-sm font-semibold text-[var(--nw-text)] group-hover:text-[var(--nw-accent)] sm:block">
              Fleet intelligence for Linux infrastructure
            </div>
            <div className="truncate text-sm font-semibold text-[var(--nw-text)] group-hover:text-[var(--nw-accent)] sm:hidden">
              Fleet intelligence
            </div>
          </div>
        </Link>

        {!isLoading && (
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            {token ? (
              <>
                <div className="order-2 flex gap-1 overflow-x-auto rounded-full border border-white/8 bg-white/4 p-1 md:order-1 md:overflow-visible">
                  {signedInLinks.map(link => {
                    const isActive = link.href === '/'
                      ? pathname === '/'
                      : pathname?.startsWith(link.href)
                    const showBadge = link.href === '/alerts' && firingCount > 0

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-[rgba(61,214,198,0.16)] text-[var(--nw-text)]'
                            : 'text-[var(--nw-text-muted)] hover:text-[var(--nw-text)]'
                        } shrink-0`}
                      >
                        {link.label}
                        {showBadge && (
                          <span className="rounded-full bg-red-500/20 text-red-400 px-1.5 py-0.5 text-[10px] font-semibold">
                            {firingCount}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
                <div className="order-1 flex items-center justify-between gap-2 sm:gap-3 md:order-2 md:justify-end">
                  <div className="hidden rounded-full border border-[rgba(61,214,198,0.18)] bg-[rgba(61,214,198,0.08)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#a9fff4] lg:inline-flex">
                    Live
                  </div>
                  <button
                    onClick={logout}
                    className="nw-button-ghost px-4 py-2 text-sm"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex w-full items-center justify-between gap-2 sm:justify-end sm:gap-3 md:w-auto">
                  <Link href="/labs" className="nw-button-ghost px-3 py-2 text-sm sm:px-4">
                    Labs
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

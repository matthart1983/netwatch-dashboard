'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { SOURCE_KIND } from '@/lib/source'
import { getAccount, getAlertHistory, getHosts, type AccountInfo } from '@/lib/api'
import { PulseLogo } from './PulseLogo'

type NavItem = { id: string; label: string; href: string; matches: (p: string | null) => boolean }

const NAV: NavItem[] = [
  { id: 'fleet', label: 'Fleet', href: '/', matches: p => p === '/' || p?.startsWith('/hosts') === true },
  { id: 'alerts', label: 'Alerts', href: '/alerts', matches: p => p?.startsWith('/alerts') === true },
  { id: 'settings', label: 'Settings', href: '/settings', matches: p => p?.startsWith('/settings') === true },
  { id: 'admin', label: 'Admin', href: '/admin', matches: p => p?.startsWith('/admin') === true },
  { id: 'labs', label: 'Labs', href: '/labs', matches: p => p?.startsWith('/labs') === true },
]

function DashboardSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const [counts, setCounts] = useState<{ fleet?: number; alerts?: number }>({})

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [hosts, events] = await Promise.all([
          getHosts().catch(() => []),
          getAlertHistory().catch(() => []),
        ])
        if (!cancelled) {
          setCounts({
            fleet: hosts.length,
            alerts: events.filter(e => e.state === 'firing').length,
          })
        }
      } catch {}
    }
    void load()
    const id = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <aside
      className={`flex w-[208px] shrink-0 flex-col border-r font-mono ${open ? 'fixed inset-y-0 left-0 z-50' : 'hidden'} md:static md:flex md:z-auto`}
      style={{ borderColor: 'var(--nw-border)', background: 'var(--nw-bg-raised)', padding: '18px 0' }}
    >
      <div className="mb-3 flex items-center justify-between px-[18px] pb-[18px]" style={{ borderBottom: '1px solid var(--nw-border)' }}>
        <Link href="/" onClick={onClose} className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
          <PulseLogo size={28} accent="var(--nw-accent)" fg="var(--nw-text)" />
          <div>
            <div className="font-semibold" style={{ fontSize: 12, color: 'var(--nw-text)' }}>netwatch</div>
            <div className="uppercase" style={{ fontSize: 9, color: 'var(--nw-text-soft)', letterSpacing: '0.08em' }}>
              fleet intel
            </div>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="md:hidden"
          style={{ background: 'transparent', border: 'none', color: 'var(--nw-text-muted)', fontSize: 18, padding: 4, cursor: 'pointer' }}
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      {NAV.map(item => {
        const active = item.matches(pathname)
        const count = item.id === 'fleet' ? counts.fleet : item.id === 'alerts' ? counts.alerts : undefined
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onClose}
            className="flex items-center justify-between transition-colors"
            style={{
              background: active ? 'var(--nw-bg-elevated)' : 'transparent',
              borderLeft: `2px solid ${active ? 'var(--nw-accent)' : 'transparent'}`,
              padding: '9px 18px',
              fontSize: 12.5,
              color: active ? 'var(--nw-text)' : 'var(--nw-text-muted)',
            }}
          >
            <span>{item.label}</span>
            {count != null && count > 0 && (
              <span style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>{count}</span>
            )}
          </Link>
        )
      })}

      <DashboardSidebarFooter />
    </aside>
  )
}

function DashboardSidebarFooter() {
  const { logout, token } = useAuth()
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [apiUp, setApiUp] = useState<boolean | null>(null) // null = still checking
  useEffect(() => {
    if (!token) return
    let cancelled = false
    getAccount().then(a => { if (!cancelled) setAccount(a) }).catch(() => {})
    return () => { cancelled = true }
  }, [token])
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 5000)
        const res = await fetch('/api/v1/health', { signal: ctrl.signal, cache: 'no-store' })
        clearTimeout(timer)
        if (!cancelled) setApiUp(res.ok)
      } catch {
        if (!cancelled) setApiUp(false)
      }
    }
    void check()
    const id = setInterval(check, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])
  return (
    <div className="mt-auto" style={{ padding: '12px 18px', borderTop: '1px solid var(--nw-border)' }}>
      <div className="font-mono leading-6" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>
        {account && (
          <>
            <div className="truncate" title={account.email}>{account.email}</div>
            <div>plan · {account.plan}</div>
          </>
        )}
        <div
          className="mt-1.5"
          style={{ color: apiUp === false ? 'var(--nw-danger)' : apiUp ? 'var(--nw-accent)' : 'var(--nw-text-soft)' }}
        >
          ● api {apiUp === false ? 'unreachable' : apiUp ? 'healthy' : 'checking…'}
        </div>
      </div>
      {SOURCE_KIND !== 'local' && (
        <button
          onClick={logout}
          className="mt-3 font-mono transition-colors hover:!text-[var(--nw-text)]"
          style={{ fontSize: 10, color: 'var(--nw-text-soft)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          $ logout
        </button>
      )}
    </div>
  )
}

export type Crumb = { label: string; href?: string }

export function TopBar({ crumbs, right }: { crumbs: Crumb[]; right?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-3 font-mono"
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--nw-border)',
        background: 'var(--nw-bg)',
        fontSize: 12,
      }}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden" style={{ color: 'var(--nw-text-muted)' }}>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2 min-w-0">
            {i > 0 && <span style={{ color: 'var(--nw-text-faint)' }}>/</span>}
            {c.href ? (
              <Link href={c.href} className="truncate transition-colors hover:!text-[var(--nw-text)]" style={{ color: i === crumbs.length - 1 ? 'var(--nw-text)' : 'var(--nw-text-muted)' }}>
                {c.label}
              </Link>
            ) : (
              <span className="truncate" style={{ color: i === crumbs.length - 1 ? 'var(--nw-text)' : 'var(--nw-text-muted)' }}>{c.label}</span>
            )}
          </span>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3.5">{right}</div>
    </div>
  )
}

export function DashboardChrome({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="-mx-4 -mt-8 flex flex-col sm:-mx-6 lg:-mx-8 md:flex-row" style={{ background: 'var(--nw-bg)', minHeight: '100vh' }}>
      {/* Mobile top bar */}
      <div
        className="flex items-center justify-between md:hidden"
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--nw-border)',
          background: 'var(--nw-bg-raised)',
        }}
      >
        <Link href="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
          <PulseLogo size={24} accent="var(--nw-accent)" fg="var(--nw-text)" />
          <span className="font-mono font-semibold" style={{ color: 'var(--nw-text)', fontSize: 13 }}>netwatch</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="font-mono"
          style={{
            background: 'transparent',
            border: '1px solid var(--nw-border)',
            borderRadius: 5,
            color: 'var(--nw-text-muted)',
            padding: '6px 10px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ≡ menu
        </button>
      </div>

      {/* Drawer backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setOpen(false)}
          style={{ background: 'rgba(0,0,0,0.65)' }}
          aria-hidden
        />
      )}

      <DashboardSidebar open={open} onClose={() => setOpen(false)} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}

export function Pill({ children, color = 'var(--nw-accent)', size = 'md' }: { children: ReactNode; color?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono font-medium"
      style={{
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        fontSize: size === 'sm' ? 10 : 11,
        color,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        borderRadius: 999,
        letterSpacing: '0.02em',
      }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}

export { useRouter }

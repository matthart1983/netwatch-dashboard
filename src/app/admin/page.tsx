'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { getAdminOverview, AdminOverview } from '@/lib/api'

export default function AdminPage() {
  const { token, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!token) { router.push('/login'); return }

    getAdminOverview()
      .then(setData)
      .catch(e => setError(e.message?.includes('403') ? 'Access denied. Admin only.' : e.message))
      .finally(() => setLoading(false))
  }, [authLoading, token, router])

  if (authLoading || loading) return <div className="mt-10 nw-muted">Loading admin panel...</div>

  if (error) {
    return (
      <div className="nw-empty-state mt-10 max-w-xl">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-3 text-sm nw-muted">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { summary, accounts } = data

  return (
    <div className="space-y-8">
      <section className="nw-card rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="nw-kicker">Admin</span>
            <div>
              <h1 className="nw-section-title">Platform overview</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 nw-muted">
                Accounts, hosts, and activity across the entire platform.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Accounts</div>
              <div className="mt-2 text-2xl font-semibold">{summary.total_accounts}</div>
            </div>
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Hosts</div>
              <div className="mt-2 text-2xl font-semibold">{summary.total_hosts}</div>
            </div>
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Online</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-400">{summary.online_hosts}</div>
            </div>
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Snapshots</div>
              <div className="mt-2 text-2xl font-semibold">{summary.total_snapshots.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="nw-card rounded-[1.5rem] p-5 sm:p-6">
        <div className="mb-5 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Accounts</p>
          <h2 className="text-2xl font-semibold">All registered users</h2>
        </div>
        <div className="nw-table-shell overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-white/8 text-left text-xs uppercase tracking-[0.14em] nw-subtle">
                <th className="p-3">Email</th>
                <th className="p-3">Plan</th>
                <th className="p-3 text-right">Hosts</th>
                <th className="p-3 text-right">Snapshots</th>
                <th className="p-3 text-right">Keys</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last active</th>
                <th className="p-3">Registered</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(account => (
                <tr key={account.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3 font-medium">{account.email}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-[rgba(61,214,198,0.14)] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#bffff8]">
                      {account.plan}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono">{account.host_count}</td>
                  <td className="p-3 text-right font-mono">{account.snapshot_count.toLocaleString()}</td>
                  <td className="p-3 text-right font-mono">{account.api_key_count}</td>
                  <td className="p-3">
                    {account.host_count === 0 ? (
                      <span className="text-xs nw-subtle">No hosts</span>
                    ) : account.any_online ? (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Offline
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs nw-muted">
                    {account.last_active ? timeAgo(account.last_active) : '—'}
                  </td>
                  <td className="p-3 text-xs nw-muted">
                    {new Date(account.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

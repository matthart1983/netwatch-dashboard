'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login as apiLogin } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiLogin(email, password)
      login(data.access_token, data.account_id)
      router.push('/')
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
      <section className="space-y-6">
        <span className="nw-kicker">Operator-grade monitoring</span>
        <div className="max-w-2xl space-y-4">
          <h1 className="nw-section-title max-w-xl">
            Sign back into a monitoring stack that actually respects your time.
          </h1>
          <p className="max-w-xl text-base leading-7 nw-muted">
            NetWatch Cloud gives lean infrastructure teams a cleaner way to watch Linux fleets: live health,
            network path visibility, and alerts that feel purposeful instead of noisy.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Install</div>
            <div className="mt-2 text-2xl font-semibold">2 min</div>
            <div className="mt-1 text-sm nw-muted">from signup to first host</div>
          </div>
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Agent</div>
            <div className="mt-2 text-2xl font-semibold">~5 MB</div>
            <div className="mt-1 text-sm nw-muted">single binary footprint</div>
          </div>
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Pricing</div>
            <div className="mt-2 text-2xl font-semibold">Free</div>
            <div className="mt-1 text-sm nw-muted">while we grow</div>
          </div>
        </div>
      </section>

      <section className="nw-card rounded-[1.75rem] p-6 sm:p-8">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Welcome back</p>
          <h2 className="text-3xl font-semibold">Sign in</h2>
          <p className="text-sm nw-muted">Access your fleet, alerts, and account controls.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</p>}
          <div>
            <label className="mb-2 block text-sm font-medium nw-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="nw-input"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium nw-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="nw-input"
              placeholder="Enter your password"
              required
            />
            <div className="mt-2 text-right">
              <Link href="/forgot-password" className="text-sm font-medium text-[var(--nw-accent)] hover:text-[#a7fff4]">
                Forgot password?
              </Link>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="nw-button-primary w-full disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Open dashboard'}
          </button>
        </form>
        <div className="mt-6 flex items-center justify-between gap-4 text-sm nw-muted">
          <span>No account yet?</span>
          <Link href="/register" className="font-medium text-[var(--nw-accent)] hover:text-[#a7fff4]">
            Create a free account
          </Link>
        </div>
      </section>
    </div>
  )
}

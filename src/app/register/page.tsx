'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { register as apiRegister } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useRedirectIfLocal } from '@/lib/use-redirect-if-local'

export default function RegisterPage() {
  const redirecting = useRedirectIfLocal()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuth()

  if (redirecting) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const reg = await apiRegister(email, password)
      setApiKey(reg.api_key)
      login(reg.access_token, reg.account_id)
    } catch {
      setError('Registration failed. Email may already be in use.')
    } finally {
      setLoading(false)
    }
  }

  if (apiKey) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <div className="nw-card rounded-[1.9rem] p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="nw-kicker">Workspace ready</span>
            <h1 className="text-3xl font-semibold text-[var(--nw-text)]">Your fleet workspace is live</h1>
          </div>
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <p className="text-sm leading-7 nw-muted">
                Your account is live and free to use.
                Copy the API key now, then install the agent on your first Linux server.
              </p>
              <div className="nw-command break-all text-sm">{apiKey}</div>
              <button
                onClick={() => navigator.clipboard.writeText(apiKey)}
                className="nw-button-secondary"
              >
                Copy API key
              </button>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="nw-stat-card">
                  <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Plan</div>
                  <div className="mt-2 text-xl font-semibold">Free</div>
                  <div className="mt-1 text-sm nw-muted">no card required</div>
                </div>
                <div className="nw-stat-card">
                  <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Start</div>
                  <div className="mt-2 text-xl font-semibold">Install</div>
                  <div className="mt-1 text-sm nw-muted">instant visibility</div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium nw-muted">Install the agent</p>
                <div className="nw-command break-all text-xs">
                  curl -sSL https://netwatch-api-production.up.railway.app/install.sh | sudo sh -s -- --api-key {apiKey} --endpoint https://netwatch-api-production.up.railway.app/api/v1/ingest
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium nw-muted">Operate it afterwards</p>
                <div className="nw-command space-y-1 text-xs">
                  <div><span className="text-[var(--nw-text-soft)]"># Check status</span></div>
                  <div>netwatch-agent status</div>
                  <div className="pt-1"><span className="text-[var(--nw-text-soft)]"># Update to latest version</span></div>
                  <div>sudo netwatch-agent update</div>
                  <div className="pt-1"><span className="text-[var(--nw-text-soft)]"># View logs</span></div>
                  <div>journalctl -u netwatch-agent -f</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => router.push('/')}
              className="nw-button-primary"
            >
              Go to dashboard
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(`curl -sSL https://netwatch-api-production.up.railway.app/install.sh | sudo sh -s -- --api-key ${apiKey} --endpoint https://netwatch-api-production.up.railway.app/api/v1/ingest`)}
              className="nw-button-secondary"
            >
              Copy install command
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
      <section className="space-y-6">
        <span className="nw-kicker">Free account</span>
        <div className="max-w-2xl space-y-4">
          <h1 className="nw-section-title max-w-xl">
            Launch a cleaner monitoring layer for your Linux fleet in one sitting.
          </h1>
          <p className="max-w-xl text-base leading-7 nw-muted">
            Skip the enterprise complexity. NetWatch Cloud gives you fleet health, network path visibility,
            and focused alerting with a small Rust agent and a setup flow your team will actually tolerate.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Plan</div>
            <div className="mt-2 text-2xl font-semibold">Free</div>
            <div className="mt-1 text-sm nw-muted">no card required</div>
          </div>
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Install</div>
            <div className="mt-2 text-2xl font-semibold">2 min</div>
            <div className="mt-1 text-sm nw-muted">from signup to first host</div>
          </div>
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Agent</div>
            <div className="mt-2 text-2xl font-semibold">~5 MB</div>
            <div className="mt-1 text-sm nw-muted">single binary</div>
          </div>
        </div>
      </section>

      <section className="nw-card rounded-[1.75rem] p-6 sm:p-8">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Create your workspace</p>
          <h2 className="text-3xl font-semibold">Create a free account</h2>
          <p className="text-sm nw-muted">We will create your account, generate your first API key, and drop you straight into the dashboard.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</p>}
          <div>
            <label className="mb-2 block text-sm font-medium nw-muted">Work email</label>
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
              minLength={8}
              className="nw-input"
              placeholder="Use at least 8 characters"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="nw-button-primary w-full disabled:opacity-50"
          >
            {loading ? 'Creating workspace...' : 'Create account'}
          </button>
        </form>
        <div className="mt-6 flex items-center justify-between gap-4 text-sm nw-muted">
          <span>Already running with NetWatch?</span>
          <Link href="/login" className="font-medium text-[var(--nw-accent)] hover:text-[#a7fff4]">
            Sign in
          </Link>
        </div>
      </section>
    </div>
  )
}

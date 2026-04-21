'use client'

import Link from 'next/link'
import { useState } from 'react'
import { requestPasswordReset } from '@/lib/api'
import { useRedirectIfLocal } from '@/lib/use-redirect-if-local'

export default function ForgotPasswordPage() {
  const redirecting = useRedirectIfLocal()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (redirecting) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSubmitted(true)
    } catch {
      setError('Enter a valid email address to request a reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
      <section className="space-y-6">
        <span className="nw-kicker">Account recovery</span>
        <div className="max-w-2xl space-y-4">
          <h1 className="nw-section-title max-w-xl">
            Recover access without opening a support thread.
          </h1>
          <p className="max-w-xl text-base leading-7 nw-muted">
            Enter the email tied to your NetWatch Cloud account and we will send a secure password reset link.
            The link expires after one hour.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Delivery</div>
            <div className="mt-2 text-2xl font-semibold">Email</div>
            <div className="mt-1 text-sm nw-muted">through the account owner inbox</div>
          </div>
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Expiry</div>
            <div className="mt-2 text-2xl font-semibold">60 min</div>
            <div className="mt-1 text-sm nw-muted">single-use reset link</div>
          </div>
        </div>
      </section>

      <section className="nw-card rounded-[1.75rem] p-6 sm:p-8">
        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Check your inbox</p>
            <h2 className="text-3xl font-semibold">Reset link sent</h2>
            <p className="text-sm leading-7 nw-muted">
              If an account exists for <span className="text-[var(--nw-text)]">{email}</span>, a reset email is on its way.
              Check spam if you do not see it within a couple of minutes.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/login" className="nw-button-primary">Back to sign in</Link>
              <button type="button" onClick={() => setSubmitted(false)} className="nw-button-ghost">
                Send another link
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Forgot password</p>
              <h2 className="text-3xl font-semibold">Email a reset link</h2>
              <p className="text-sm nw-muted">Use the same work email you use to sign in.</p>
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
              <button type="submit" disabled={loading} className="nw-button-primary w-full disabled:opacity-50">
                {loading ? 'Sending link...' : 'Send reset link'}
              </button>
            </form>
            <div className="mt-6 text-sm nw-muted">
              Remembered it?{' '}
              <Link href="/login" className="font-medium text-[var(--nw-accent)] hover:text-[#a7fff4]">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

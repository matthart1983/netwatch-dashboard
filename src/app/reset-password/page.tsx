'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { resetPassword } from '@/lib/api'
import { useRedirectIfLocal } from '@/lib/use-redirect-if-local'

function ResetPasswordContent() {
  const redirecting = useRedirectIfLocal()
  if (redirecting) return null
  return <ResetPasswordForm />
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('This reset link is invalid or incomplete.')
      return
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, password)
      setSuccess(true)
    } catch {
      setError('This reset link is invalid or has expired. Request a new one.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
      <section className="space-y-6">
        <span className="nw-kicker">Password reset</span>
        <div className="max-w-2xl space-y-4">
          <h1 className="nw-section-title max-w-xl">
            Set a new password and get back to the dashboard.
          </h1>
          <p className="max-w-xl text-base leading-7 nw-muted">
            Reset links are single-use and time-limited. Once you save the new password, the old one stops working immediately.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Security</div>
            <div className="mt-2 text-2xl font-semibold">Single-use</div>
            <div className="mt-1 text-sm nw-muted">each reset link expires after use</div>
          </div>
          <div className="nw-stat-card">
            <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Policy</div>
            <div className="mt-2 text-2xl font-semibold">8+ chars</div>
            <div className="mt-1 text-sm nw-muted">minimum password length</div>
          </div>
        </div>
      </section>

      <section className="nw-card rounded-[1.75rem] p-6 sm:p-8">
        {success ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Password updated</p>
            <h2 className="text-3xl font-semibold">You can sign in now</h2>
            <p className="text-sm leading-7 nw-muted">
              Your password has been changed successfully. Return to the login page and continue with the new credentials.
            </p>
            <Link href="/login" className="nw-button-primary mt-2 inline-flex">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">Choose a new password</p>
              <h2 className="text-3xl font-semibold">Reset access</h2>
              <p className="text-sm nw-muted">Use a password you have not used recently and keep it at least eight characters long.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</p>}
              <div>
                <label className="mb-2 block text-sm font-medium nw-muted">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="nw-input"
                  placeholder="Use at least 8 characters"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium nw-muted">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="nw-input"
                  placeholder="Re-enter your new password"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="nw-button-primary w-full disabled:opacity-50">
                {loading ? 'Updating password...' : 'Save new password'}
              </button>
            </form>
            <div className="mt-6 text-sm nw-muted">
              Need a new link?{' '}
              <Link href="/forgot-password" className="font-medium text-[var(--nw-accent)] hover:text-[#a7fff4]">
                Request another reset email
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="mt-10 nw-muted">Loading reset link...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}

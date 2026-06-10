'use client'

import Link from 'next/link'
import { useState } from 'react'
import { requestPasswordReset } from '@/lib/api'
import { useRedirectIfLocal } from '@/lib/use-redirect-if-local'
import { AuthError, AuthInput, AuthLabel, AuthPrimary, AuthShell, AUTH_T } from '@/app/_components/AuthShell'

export default function ForgotPasswordPage() {
  const redirecting = useRedirectIfLocal()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  if (redirecting) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      setError('could not send reset link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      label="forgot-password"
      title={<>Reset password.</>}
      subtitle="Enter the email on file. We&rsquo;ll send a one-time reset link."
      footer={
        <span>
          remembered it?{' '}
          <Link href="/login" style={{ color: AUTH_T.accent, textDecoration: 'none' }} className="hover:underline">
            $ login
          </Link>
        </span>
      }
    >
      {sent ? (
        <div className="font-mono space-y-3" style={{ fontSize: 12.5, color: AUTH_T.textMuted, lineHeight: 1.7 }}>
          <div style={{ color: AUTH_T.accent }}>✓ check your email</div>
          <div>
            If an account exists for <span style={{ color: AUTH_T.text }}>{email}</span>, a reset link is on its way.
            Token expires in 1 hour.
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <AuthError>{error}</AuthError>}
          <div>
            <AuthLabel>EMAIL</AuthLabel>
            <AuthInput
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>
          <AuthPrimary type="submit" disabled={loading}>
            {loading ? '$ reset --sending' : '$ reset --send'}
          </AuthPrimary>
        </form>
      )}
    </AuthShell>
  )
}

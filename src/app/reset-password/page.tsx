'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { resetPassword } from '@/lib/api'
import { useRedirectIfLocal } from '@/lib/use-redirect-if-local'
import { AuthError, AuthInput, AuthLabel, AuthPrimary, AuthShell, AUTH_T } from '@/app/_components/AuthShell'

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

    if (!token) { setError('this reset link is invalid'); return }
    if (password.length < 8) { setError('use at least 8 characters'); return }
    if (password !== confirmPassword) { setError('passwords do not match'); return }

    setLoading(true)
    try {
      await resetPassword(token, password)
      setSuccess(true)
    } catch {
      setError('reset link invalid or expired')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      label="reset-password"
      title={success ? <>Password updated.</> : <>Set new password.</>}
      subtitle={
        success
          ? 'You can sign in with the new password now.'
          : 'Reset links are single-use and time-limited. Old password stops working immediately.'
      }
      footer={
        success ? null : (
          <span>
            need a new link?{' '}
            <Link href="/forgot-password" style={{ color: AUTH_T.accent, textDecoration: 'none' }} className="hover:underline">
              $ reset --send
            </Link>
          </span>
        )
      }
    >
      {success ? (
        <div className="space-y-3">
          <Link href="/login">
            <AuthPrimary type="button">$ login</AuthPrimary>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && <AuthError>{error}</AuthError>}
          <div>
            <AuthLabel>NEW PASSWORD</AuthLabel>
            <AuthInput
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="at least 8 chars"
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <AuthLabel>CONFIRM</AuthLabel>
            <AuthInput
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="re-enter"
              required
              autoComplete="new-password"
            />
          </div>
          <AuthPrimary type="submit" disabled={loading}>
            {loading ? '$ reset --applying' : '$ reset --apply'}
          </AuthPrimary>
        </form>
      )}
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}

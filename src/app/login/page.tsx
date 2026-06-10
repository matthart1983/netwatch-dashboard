'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login as apiLogin } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useRedirectIfLocal } from '@/lib/use-redirect-if-local'
import { AuthError, AuthInput, AuthLabel, AuthPrimary, AuthShell, AUTH_T } from '@/app/_components/AuthShell'

export default function LoginPage() {
  const redirecting = useRedirectIfLocal()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuth()

  if (redirecting) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiLogin(email, password)
      login(data.access_token, data.account_id)
      router.push('/')
    } catch {
      setError('invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      label="login"
      title={<>Sign in.</>}
      subtitle="Pick up where your fleet left off."
      footer={
        <span>
          no account yet?{' '}
          <Link href="/register" style={{ color: AUTH_T.accent, textDecoration: 'none' }} className="hover:underline">
            $ signup --free
          </Link>
        </span>
      }
    >
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
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <AuthLabel>PASSWORD</AuthLabel>
            <Link
              href="/forgot-password"
              style={{ color: AUTH_T.textDim, textDecoration: 'none', fontSize: 11 }}
              className="hover:!text-[var(--nw-text-muted)] transition-colors"
            >
              forgot?
            </Link>
          </div>
          <AuthInput
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>
        <AuthPrimary type="submit" disabled={loading}>
          {loading ? '$ login --pending' : '$ login'}
        </AuthPrimary>
      </form>
    </AuthShell>
  )
}

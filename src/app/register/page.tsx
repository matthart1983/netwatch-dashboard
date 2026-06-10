'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { register as apiRegister } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useRedirectIfLocal } from '@/lib/use-redirect-if-local'
import { AuthError, AuthInput, AuthLabel, AuthPrimary, AuthShell, AUTH_T } from '@/app/_components/AuthShell'

export default function RegisterPage() {
  const redirecting = useRedirectIfLocal()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)
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
      setError('registration failed — email may already be in use')
    } finally {
      setLoading(false)
    }
  }

  const installCmd = `curl -sSL get.netwatch.cloud | sh -s -- --api-key ${apiKey}`

  if (apiKey) {
    return (
      <AuthShell
        label="register"
        title={<>Workspace ready.</>}
        subtitle="Copy the API key and run the agent on your first host. Both will scroll past on first install."
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-mono uppercase" style={{ fontSize: 10, color: AUTH_T.textDim, letterSpacing: '0.08em' }}>
                API KEY
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(apiKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 1500) }}
                className="font-mono transition-colors hover:!text-[var(--nw-text)]"
                style={{ background: 'transparent', border: 'none', color: AUTH_T.textDim, fontSize: 11, cursor: 'pointer', padding: 0 }}
              >
                {copiedKey ? '✓ copied' : 'copy'}
              </button>
            </div>
            <div
              className="font-mono break-all"
              style={{ background: AUTH_T.bg, border: `1px solid ${AUTH_T.line}`, borderRadius: 5, padding: '10px 12px', fontSize: 12, color: AUTH_T.accent }}
            >
              {apiKey}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-mono uppercase" style={{ fontSize: 10, color: AUTH_T.textDim, letterSpacing: '0.08em' }}>
                INSTALL ON FIRST HOST
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(installCmd); setCopiedCmd(true); setTimeout(() => setCopiedCmd(false), 1500) }}
                className="font-mono transition-colors hover:!text-[var(--nw-text)]"
                style={{ background: 'transparent', border: 'none', color: AUTH_T.textDim, fontSize: 11, cursor: 'pointer', padding: 0 }}
              >
                {copiedCmd ? '✓ copied' : 'copy'}
              </button>
            </div>
            <div
              className="font-mono break-all"
              style={{ background: AUTH_T.bg, border: `1px solid ${AUTH_T.line}`, borderRadius: 5, padding: '10px 12px', fontSize: 12, color: AUTH_T.text, lineHeight: 1.6 }}
            >
              <span style={{ color: AUTH_T.accent }}>$</span> {installCmd}
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full font-semibold transition hover:opacity-90"
            style={{
              background: AUTH_T.accent, color: AUTH_T.bg, border: 'none',
              borderRadius: 5, padding: '11px 16px',
              fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer',
            }}
          >
            $ open dashboard →
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      label="register"
      title={<>Create account.</>}
      subtitle="Free while we grow. We&rsquo;ll generate an API key and drop you into the dashboard."
      footer={
        <span>
          already running netwatch?{' '}
          <Link href="/login" style={{ color: AUTH_T.accent, textDecoration: 'none' }} className="hover:underline">
            $ login
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
          <AuthLabel>PASSWORD</AuthLabel>
          <AuthInput
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={8}
            placeholder="at least 8 chars"
            required
            autoComplete="new-password"
          />
        </div>
        <AuthPrimary type="submit" disabled={loading}>
          {loading ? '$ signup --pending' : '$ signup --free'}
        </AuthPrimary>
      </form>
    </AuthShell>
  )
}

'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { PulseLogo } from './PulseLogo'

const T = {
  bg: 'var(--nw-bg)',
  surface: 'var(--nw-bg-elevated)',
  line: 'var(--nw-border)',
  lineSoft: 'var(--nw-line-soft)',
  text: 'var(--nw-text)',
  textMuted: 'var(--nw-text-muted)',
  textDim: 'var(--nw-text-soft)',
  accent: 'var(--nw-accent)',
}

export function AuthShell({
  label,
  title,
  subtitle,
  children,
  footer,
}: {
  label: string
  title: ReactNode
  subtitle: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div
      className="-mx-4 -mt-8 font-mono sm:-mx-6 lg:-mx-8 flex min-h-screen flex-col"
      style={{ background: '#000', color: T.text }}
    >
      <div
        className="flex flex-col overflow-hidden flex-1"
        style={{
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          margin: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* terminal title bar */}
        <div
          className="flex items-center gap-3"
          style={{ padding: '10px 16px', borderBottom: `1px solid ${T.line}`, background: T.bg }}
        >
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3a3a3a' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3a3a3a' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3a3a3a' }} />
          </div>
          <div className="ml-1.5 text-[11px]" style={{ color: T.textDim }}>
            netwatch ~ <span style={{ color: T.textMuted }}>~/{label}.tsx</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-[11px]" style={{ color: T.textDim }}>
            <span>main</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5" style={{ color: T.accent }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: T.accent }} />
              auth
            </span>
          </div>
        </div>

        {/* header */}
        <header
          className="flex items-center justify-between"
          style={{ padding: '14px 28px', borderBottom: `1px solid ${T.line}`, background: T.bg }}
        >
          <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
            <PulseLogo size={26} accent={T.accent} fg={T.text} />
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold tracking-[-0.01em]" style={{ color: T.text, fontSize: 14 }}>
                netwatch
              </span>
              <span style={{ color: T.textDim, fontSize: 11, letterSpacing: '0.02em' }}>cloud</span>
            </div>
          </Link>
          <div className="flex items-center gap-4 text-[12px]">
            <Link href="/" style={{ color: T.textMuted, textDecoration: 'none' }} className="hover:!text-[var(--nw-text)] transition-colors">
              <span style={{ color: T.textDim }}>cd</span> ~/
            </Link>
          </div>
        </header>

        {/* body */}
        <main
          className="flex flex-1 items-center justify-center"
          style={{ background: T.bg, padding: '40px 28px' }}
        >
          <div className="w-full" style={{ maxWidth: 460 }}>
            <div className="mb-[18px] text-[11px]" style={{ color: T.textDim }}>
              {label === 'login' ? '// 01 · sign in' :
               label === 'register' ? '// 01 · create account' :
               label === 'forgot-password' ? '// 01 · request reset' :
               label === 'reset-password' ? '// 01 · apply reset' : '// 01'}
            </div>
            <h1
              className="m-0 font-medium"
              style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.025em', color: T.text }}
            >
              {title}
            </h1>
            <p className="mt-3 font-sans" style={{ fontSize: 14, lineHeight: 1.6, color: T.textMuted }}>
              {subtitle}
            </p>

            <div
              className="mt-7 overflow-hidden"
              style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 22 }}
            >
              {children}
            </div>

            {footer && <div className="mt-4 text-[12px]" style={{ color: T.textMuted }}>{footer}</div>}
          </div>
        </main>

        {/* footer */}
        <footer
          className="flex flex-col items-center justify-between gap-2 text-[11px] md:flex-row"
          style={{ padding: '20px 28px', borderTop: `1px solid ${T.line}`, color: T.textDim, background: T.bg }}
        >
          <span>netwatch labs · 2026</span>
          <span>auth · v1</span>
          <span>main</span>
        </footer>
      </div>
    </div>
  )
}

const FIELD_STYLE: React.CSSProperties = {
  width: '100%',
  background: T.bg,
  border: `1px solid ${T.line}`,
  borderRadius: 5,
  padding: '10px 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  color: T.text,
  outline: 'none',
}

export function AuthLabel({ children }: { children: ReactNode }) {
  return (
    <label
      className="mb-1.5 block uppercase"
      style={{ fontSize: 10, color: T.textDim, letterSpacing: '0.08em' }}
    >
      {children}
    </label>
  )
}

export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...FIELD_STYLE, ...props.style }} />
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-mono"
      style={{
        background: 'color-mix(in srgb, var(--nw-danger) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--nw-danger) 30%, transparent)',
        color: 'var(--nw-danger)',
        borderRadius: 5,
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      ✗ {children}
    </div>
  )
}

export function AuthPrimary({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className="w-full font-semibold transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: T.accent,
        color: T.bg,
        border: 'none',
        borderRadius: 5,
        padding: '11px 16px',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        ...props.style,
      }}
    >
      {children}
    </button>
  )
}

export const AUTH_T = T

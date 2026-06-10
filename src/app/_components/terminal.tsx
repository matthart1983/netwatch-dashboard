// Shared "terminal" UI primitives — the design language used on the homepage,
// now reusable so the app pages (admin/settings/alerts) match it instead of the
// older soft nw-card look. All colors come from the --nw-* CSS variables.
import type { ReactNode } from 'react'

/** `// 01 · LABEL` eyebrow used above every section. */
export function Eyebrow({ num, label, right }: { num?: string; label: string; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between font-mono">
      <div className="text-[11px]" style={{ color: 'var(--nw-text-soft)', letterSpacing: '0.18em' }}>
        {num ? `// ${num} · ` : '// '}<span style={{ color: 'var(--nw-text-muted)' }}>{label}</span>
      </div>
      {right ? <div className="text-[11px]" style={{ color: 'var(--nw-text-soft)' }}>{right}</div> : null}
    </div>
  )
}

/** Page header — the terminal eyebrow + title + optional subtitle. */
export function TermHeader({ num, kicker, title, sub }: { num?: string; kicker: string; title: string; sub?: ReactNode }) {
  return (
    <div className="font-mono">
      <Eyebrow num={num} label={kicker} />
      <h1
        className="m-0 mt-3 font-semibold"
        style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(26px, 4vw, 36px)', letterSpacing: '-0.025em', lineHeight: 1.1, color: 'var(--nw-text)' }}
      >
        {title}
      </h1>
      {sub ? (
        <p className="font-sans m-0 mt-3" style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--nw-text-muted)', maxWidth: '60ch' }}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}

/** A sharp-bordered terminal panel. Pass `title` for a bordered header bar. */
export function TermPanel({ title, right, children, padded = true }: { title?: string; right?: ReactNode; children: ReactNode; padded?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--nw-border)', background: 'var(--nw-bg-elevated)' }}>
      {title ? (
        <div className="flex items-center justify-between font-mono" style={{ padding: '11px 16px', borderBottom: '1px solid var(--nw-border)', background: 'var(--nw-bg)' }}>
          <span className="text-[11px] uppercase" style={{ color: 'var(--nw-text)', letterSpacing: '0.12em' }}>{title}</span>
          {right ? <span className="text-[11px]" style={{ color: 'var(--nw-text-soft)' }}>{right}</span> : null}
        </div>
      ) : null}
      <div style={padded ? { padding: 18 } : undefined}>{children}</div>
    </div>
  )
}

/** A sharp-bordered stat tile, mono. */
export function TermStat({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="font-mono" style={{ border: '1px solid var(--nw-border)', background: 'var(--nw-bg)', padding: '14px 16px' }}>
      <div className="text-[10px] uppercase" style={{ color: 'var(--nw-text-soft)', letterSpacing: '0.14em' }}>{label}</div>
      <div className="mt-2 text-2xl font-semibold" style={{ color: accent ? 'var(--nw-accent)' : 'var(--nw-text)' }}>{value}</div>
    </div>
  )
}

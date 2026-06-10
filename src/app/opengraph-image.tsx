import { ImageResponse } from 'next/og'

// Real 1200×630 PNG for social unfurls (Slack / X / LinkedIn / Discord / iMessage).
// Replaces the old /og.svg, which most unfurlers refuse to render. This file is a
// Next.js metadata convention: it auto-populates og:image AND twitter:image.
// Uses the default Node.js runtime (no `runtime = 'edge'`) so it renders reliably
// under `next start` / a Node server.
//
// NOTE: this is rendered by Satori, not a browser. Satori requires every <div>
// with more than one child to set an explicit `display` (flex/contents/none).
// Keep that invariant when editing or the production build will fail to prerender.
export const alt = 'NetWatch Labs — open-source diagnostics for Linux operators'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = '#08111a'
const ELEV = '#0c1620'
const LINE = 'rgba(255,255,255,0.08)'
const TEXT = '#e8f0ec'
const MUTED = '#9fb3ab'
const ACCENT = '#9fe8b4'

const TOOLS: Array<[string, string]> = [
  ['netwatch', 'network'],
  ['syswatch', 'system'],
  ['diskwatch', 'storage'],
  ['essh', 'ssh'],
]

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BG,
          padding: 72,
          fontFamily: 'monospace',
          color: TEXT,
        }}
      >
        {/* top: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 16,
              border: `1px solid ${ACCENT}`,
              background: 'rgba(159,232,180,0.12)',
              color: TEXT,
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            NW
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
              NetWatch Labs
            </div>
            <div style={{ fontSize: 18, color: MUTED, letterSpacing: 2 }}>
              OPEN-SOURCE LINUX DIAGNOSTICS · MIT
            </div>
          </div>
        </div>

        {/* middle: headline (one flex-column, one div per line) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 64, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1 }}>
            <div style={{ display: 'flex' }}>Tools for engineers who</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span>live in the</span>
              <span style={{ color: ACCENT }}>terminal.</span>
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: MUTED, maxWidth: 880, lineHeight: 1.5 }}>
            One static Rust binary per tool. No daemon, no telemetry, no SaaS lock-in.
          </div>
        </div>

        {/* bottom: tool chips */}
        <div style={{ display: 'flex', gap: 16 }}>
          {TOOLS.map(([name, kind]) => (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '16px 22px',
                borderRadius: 10,
                border: `1px solid ${LINE}`,
                background: ELEV,
              }}
            >
              <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: TEXT }}>{name}</div>
              <div style={{ display: 'flex', fontSize: 16, color: ACCENT }}>{`# ${kind}`}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}

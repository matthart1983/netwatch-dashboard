'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { LiveStarsTotal } from './_components/LiveStarsTotal'
import { useInView, useCountUp, useTypewriter } from './_components/labs-anim'
import { DashboardChrome } from './_components/DashboardChrome'
import { FleetView } from './_components/dashboard/FleetView'
import type { TimePoint } from './_components/dashboard/primitives'
import { SOURCE_KIND } from '@/lib/source'
import { getHosts, getMetrics, getAlertHistory, deleteHost, Host, MetricPoint, type AlertEvent } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PulseLogo } from './_components/PulseLogo'
import {
  Activity, Radar, Bell, BarChart3, Monitor, RefreshCw,
  Shield, Lock, Unlock, Eye, ChevronRight, ChevronUp, ChevronDown, Zap, X, Check,
  GripVertical, Maximize2, Minimize2, RotateCcw,
} from 'lucide-react'

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export function Landing() {
  const t = {
    bg: 'var(--nw-bg)',
    bg2: 'var(--nw-bg-elevated)',
    panel: 'var(--nw-bg-elevated)',
    line: 'var(--nw-border)',
    lineSoft: 'var(--nw-line-soft)',
    text: 'var(--nw-text)',
    textMuted: 'var(--nw-text-muted)',
    textDim: 'var(--nw-text-soft)',
    accent: 'var(--nw-accent)',
    warn: 'var(--nw-warm)',
    err: 'var(--nw-danger)',
  }

  const projects: Array<{
    id: string
    name: string
    version: string
    starsFallback: number
    repo: string
    repoUrl: string
    tagline: string
    desc: string
    badges: string[]
    install: string
    gif: string
    status: 'stable' | 'beta' | 'preview'
    statusCol: string
  }> = [
    {
      id: 'netwatch',
      name: 'netwatch',
      version: 'v0.14.1',
      starsFallback: 1597,
      repo: 'matthart1983/netwatch',
      repoUrl: 'https://github.com/matthart1983/netwatch',
      tagline: 'Real-time network diagnostics in your terminal.',
      desc: 'Zero-config TUI for Linux. Interface bandwidth, gateway latency, packet loss, DNS latency, connections — one binary, no root, instant visibility.',
      badges: ['TUI', 'Linux', 'MIT'],
      install: 'brew install matthart1983/tap/netwatch',
      gif: '/netwatch-tui-demo.gif',
      status: 'stable',
      statusCol: t.accent,
    },
    {
      id: 'syswatch',
      name: 'syswatch',
      version: 'v0.1.1',
      starsFallback: 284,
      repo: 'matthart1983/syswatch',
      repoUrl: 'https://github.com/matthart1983/syswatch',
      tagline: 'Single-host system diagnostics TUI.',
      desc: '12 tabs covering CPU, memory, disks, processes, GPU, power, services, network — plus a Timeline scrubber and an Insights anomaly engine. Sibling to netwatch.',
      badges: ['TUI', 'Linux', 'MIT'],
      install: 'cargo install syswatch',
      gif: '/syswatch-tui-demo.gif',
      status: 'preview',
      statusCol: t.textDim,
    },
    {
      id: 'diskwatch',
      name: 'diskwatch',
      version: 'v0.1.1',
      starsFallback: 0,
      repo: 'matthart1983/diskwatch',
      repoUrl: 'https://github.com/matthart1983/diskwatch',
      tagline: 'Single-host disk diagnostics in your terminal.',
      desc: 'Eight tabs across devices, volumes, filesystems, IO, SMART, hot files, and insights — capacity trends, throughput, p99 latency, and the files being written right now. Read-only, no daemon. Sibling to netwatch and syswatch.',
      badges: ['TUI', 'Linux', 'MIT'],
      install: 'cargo install diskwatch',
      gif: '/diskwatch-tui-demo.gif',
      status: 'preview',
      statusCol: t.textDim,
    },
    {
      id: 'essh',
      name: 'essh',
      version: 'v0.2.7',
      starsFallback: 57,
      repo: 'matthart1983/essh',
      repoUrl: 'https://github.com/matthart1983/essh',
      tagline: 'Enhanced SSH client for server fleets.',
      desc: 'TUI SSH client with concurrent sessions, per-connection host diagnostics, file transfer, port forwarding, and fleet management — built with russh in pure Rust.',
      badges: ['TUI', 'SSH', 'MIT'],
      install: 'cargo install essh',
      gif: '/essh-tui-demo.gif',
      status: 'beta',
      statusCol: t.warn,
    },
  ]

  const installTabs: Array<{ id: string; label: string; cmd: string; note: string }> = [
    {
      id: 'brew',
      label: 'macOS · Homebrew',
      cmd: 'brew install matthart1983/tap/netwatch',
      note: 'Tap currently ships netwatch; syswatch / diskwatch / essh land via Homebrew next.',
    },
    {
      id: 'cargo',
      label: 'From source · Cargo',
      cmd: 'cargo install netwatch-tui syswatch diskwatch essh --locked',
      note: 'Builds all four from crates.io. Requires Rust 1.78+.',
    },
    {
      id: 'git',
      label: 'Git clone',
      cmd: 'git clone https://github.com/matthart1983/netwatch && cd netwatch && cargo build --release',
      note: 'For development. Substitute repo name for syswatch / diskwatch / essh.',
    },
  ]

  const manifesto: Array<[string, string, string]> = [
    ['01', 'Read-only by default', 'These are diagnostic tools. They observe; they do not mutate. Mutation is a flag, not a default.'],
    ['02', 'Single static binary', 'No runtime, no daemon, no agent that needs an agent. One file, drop on any Linux box, run.'],
    ['03', 'No telemetry', 'Your machine is yours. We don’t know you exist unless you star us on GitHub.'],
    ['04', 'TUI-first', 'Terminals are universal. Designed for tmux over mosh on a 110-column window, not for marketing screenshots.'],
    ['05', 'MIT-licensed', 'Fork it, ship it, embed it. No CLA, no rug-pull, no “source available” games.'],
    ['06', 'Solo-built, on purpose', 'Small surface, fast iteration, no committee. Cloud is a side project for remote monitoring.'],
  ]

  return (
    <div className="-mx-4 -mt-8 font-mono sm:-mx-6 lg:-mx-8" style={{ background: '#000', color: t.text }}>
      <div
        className="overflow-hidden"
        style={{
          background: t.bg2,
          border: `1px solid ${t.line}`,
          borderRadius: 12,
          margin: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Outer terminal title bar */}
        <div
          className="flex items-center gap-3"
          style={{ padding: '10px 16px', borderBottom: `1px solid ${t.line}`, background: t.bg }}
        >
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3a3a3a' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3a3a3a' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3a3a3a' }} />
          </div>
          <div className="ml-1.5 text-[11px]" style={{ color: t.textDim }}>
            netwatch ~ <span style={{ color: t.textMuted }}>~/labs.tsx</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-[11px]" style={{ color: t.textDim }}>
            <span>main</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5" style={{ color: t.accent }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: t.accent }} />
              labs
            </span>
          </div>
        </div>

        <div style={{ background: t.bg }}>
          {/* HEADER */}
          <header
            className="flex items-center justify-between"
            style={{ padding: '14px 28px', borderBottom: `1px solid ${t.line}` }}
          >
            <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
              <PulseLogo size={28} accent={t.accent} fg={t.text} />
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold tracking-[-0.01em]" style={{ color: t.text, fontSize: 14 }}>
                  netwatch
                </span>
                <span style={{ color: t.accent, fontSize: 11, letterSpacing: '0.02em' }}>labs</span>
              </div>
            </Link>
            <nav className="hidden items-center gap-6 md:flex" style={{ color: t.textMuted, fontSize: 12 }}>
              {[
                ['~/projects', '#projects'],
                ['~/install', '#install'],
                ['~/manifesto', '#manifesto'],
                ['~/changelog', '#changelog'],
                ['~/labs', '/labs'],
                ['~/cloud', '/cloud'],
              ].map(([label, href]) => (
                href.startsWith('/') ? (
                  <Link key={label} href={href} className="inline-flex gap-1.5 hover:!text-[var(--nw-text)] transition-colors">
                    <span style={{ color: t.textDim }}>cd</span>
                    <span>{label}</span>
                  </Link>
                ) : (
                  <a key={label} href={href} className="inline-flex gap-1.5 hover:!text-[var(--nw-text)] transition-colors">
                    <span style={{ color: t.textDim }}>cd</span>
                    <span>{label}</span>
                  </a>
                )
              ))}
            </nav>
            <a
              href="https://github.com/matthart1983/netwatch"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition-colors hover:!border-[var(--nw-text-muted)]"
              style={{
                background: 'transparent',
                color: t.text,
                border: `1px solid ${t.line}`,
                borderRadius: 5,
                padding: '7px 13px',
                fontSize: 12,
              }}
            >
              ★ <LiveStarsTotal />
            </a>
          </header>

          {/* HERO */}
          <section style={{ padding: '56px 28px 36px', borderBottom: `1px solid ${t.line}` }}>
            <div className="grid items-stretch gap-8 lg:grid-cols-[1.05fr_1fr]">
              <div style={{ padding: '12px 4px' }}>
                <div className="mb-[18px] text-[11px]" style={{ color: t.textDim, letterSpacing: '0.18em' }}>
                  {'// OPEN-SOURCE NETWORK & SYS DIAGNOSTICS · MIT'}
                </div>
                <h1
                  className="m-0 font-semibold"
                  style={{ fontSize: 'clamp(36px, 6.4vw, 60px)', lineHeight: 1.04, letterSpacing: '-0.035em', color: t.text }}
                >
                  Tools for engineers
                  <br />
                  who live in the
                  <br />
                  <span style={{ color: t.accent }}>terminal<span style={{ color: t.textMuted }}>.</span></span>
                </h1>
                <p
                  className="font-sans"
                  style={{ marginTop: 28, fontSize: 17, lineHeight: 1.6, color: t.textMuted, maxWidth: 480 }}
                >
                  Four open-source diagnostics tools for Linux operators. Single static Rust binary,
                  no telemetry, no daemon, MIT-licensed. Ship one file, run anywhere.
                </p>
                <div className="mt-8 flex flex-wrap gap-2.5">
                  <a
                    href="#projects"
                    className="font-semibold transition hover:opacity-90"
                    style={{
                      background: t.accent,
                      color: t.bg,
                      borderRadius: 5,
                      padding: '11px 16px',
                      fontSize: 13,
                    }}
                  >
                    $ explore projects →
                  </a>
                  <a
                    href="https://github.com/matthart1983"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-medium transition-colors hover:!border-[var(--nw-text-muted)]"
                    style={{
                      background: 'transparent',
                      color: t.text,
                      border: `1px solid ${t.line}`,
                      borderRadius: 5,
                      padding: '11px 16px',
                      fontSize: 13,
                    }}
                  >
                    ★ <LiveStarsTotal /> on github
                  </a>
                </div>
                <HeroStats projectCount={projects.length} t={t} />
              </div>

              {/* Hero terminal — TEST: swapped to video. Original `HeroTerminal` (typewriter + cargo search) is preserved below; revert by changing this back. */}
              <HeroTerminalVideo t={t} />
            </div>
          </section>

          {/* PROJECTS */}
          <section id="projects" style={{ padding: '64px 28px', borderBottom: `1px solid ${t.line}` }}>
            <SectionHeader num="00" kicker="PROJECTS" title="Built in the open."
              sub="Each project is a single static Rust binary — MIT-licensed, no daemon, no telemetry. Stars and versions are live from GitHub."
              t={t}
            />
            <div className="mt-9 grid gap-0 md:grid-cols-2" style={{ border: `1px solid ${t.line}` }}>
              {projects.map((p, i) => (
                <ProjectCard key={p.id} p={p} index={i} total={projects.length} t={t} />
              ))}
            </div>
          </section>

          {/* WALKTHROUGH */}
          <Walkthrough t={t} />

          {/* INSTALL */}
          <InstallSection tabs={installTabs} t={t} />

          {/* MANIFESTO */}
          <section id="manifesto" style={{ padding: '64px 28px', borderBottom: `1px solid ${t.line}`, background: t.bg2 }}>
            <SectionHeader num="03" kicker="MANIFESTO" title="Six rules we don’t break."
              sub="If a feature contradicts one of these, it doesn’t ship." t={t}
            />
            <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ border: `1px solid ${t.line}` }}>
              {manifesto.map(([n, h, d], i) => (
                <div
                  key={n}
                  style={{
                    padding: 22,
                    borderRight: (i % 3 !== 2) ? `1px solid ${t.line}` : 'none',
                    borderBottom: i < 3 ? `1px solid ${t.line}` : 'none',
                    background: t.bg,
                  }}
                >
                  <div className="text-[11px]" style={{ color: t.accent, letterSpacing: '0.2em' }}>{n}</div>
                  <div className="mt-2 font-medium" style={{ fontFamily: 'var(--font-sans)', fontSize: 17, color: t.text, letterSpacing: '-0.01em' }}>
                    {h}
                  </div>
                  <div className="mt-2 font-sans" style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
                    {d}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-9" style={{ background: t.bg2, border: `1px solid ${t.line}` }}>
              <div
                className="flex items-center justify-between text-[11px]"
                style={{ padding: '10px 16px', borderBottom: `1px solid ${t.line}`, color: t.textDim }}
              >
                <div className="flex items-center gap-2.5">
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
                  <span className="ml-3.5">{'~/netwatch-labs · manifesto'}</span>
                </div>
                <span>
                  <span style={{ color: t.accent }}>●</span> REC
                </span>
              </div>
              <div style={{ position: 'relative', background: '#000', aspectRatio: '16 / 9' }}>
                <video
                  muted
                  playsInline
                  loop
                  autoPlay
                  preload="metadata"
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                >
                  <source src="/manifesto.mp4" type="video/mp4" />
                </video>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 3px)',
                    mixBlendMode: 'overlay',
                  }}
                />
              </div>
              <div
                className="flex items-center gap-4 text-[11px]"
                style={{ padding: '10px 16px', borderTop: `1px solid ${t.line}`, color: t.textDim }}
              >
                <span style={{ color: t.accent }}>{'// 03'}</span>
                <span>{'open-source · no audio · loops'}</span>
              </div>
            </div>
          </section>

          {/* CHANGELOG */}
          <section id="changelog" style={{ padding: '56px 28px', borderBottom: `1px solid ${t.line}` }}>
            <SectionHeader num="04" kicker="CHANGELOG" title="Last six releases."
              sub="Pulled live from GitHub Releases across all four repos. Every release is signed."
              t={t}
            />
            <ChangelogList t={t} />
            <div className="mt-4 text-[12px]" style={{ color: t.textDim }}>
              <a href="https://github.com/matthart1983?tab=repositories" target="_blank" rel="noopener noreferrer" style={{ color: t.accent, textDecoration: 'none' }}>
                full release history on github →
              </a>
            </div>
          </section>

          {/* CLOUD — small, demoted */}
          <section id="cloud" style={{ padding: '56px 28px', borderBottom: `1px solid ${t.line}`, background: t.bg2 }}>
            <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <SectionHeader num="05" kicker="OPTIONAL" title="netwatch cloud" sub={null} compact t={t} />
                <p className="mt-4 font-sans" style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6, maxWidth: 420 }}>
                  A hosted, multi-host fleet view built on the OSS agent. Free tier today; paid tiers may arrive
                  later for higher-volume use. The OSS tools work without it — that’s a guarantee, not a promise.
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link
                    href="/cloud"
                    className="font-medium transition-colors hover:!border-[var(--nw-text-muted)]"
                    style={{
                      color: t.text, border: `1px solid ${t.line}`, borderRadius: 5,
                      padding: '10px 16px', fontSize: 12, textDecoration: 'none',
                    }}
                  >
                    learn more →
                  </Link>
                  <Link
                    href="/register"
                    className="font-semibold transition hover:opacity-90"
                    style={{
                      background: t.accent, color: t.bg, borderRadius: 5,
                      padding: '10px 16px', fontSize: 12, textDecoration: 'none',
                    }}
                  >
                    $ signup --free
                  </Link>
                </div>
              </div>
              <div
                className="overflow-hidden"
                style={{ background: t.bg, border: `1px solid ${t.line}` }}
              >
                <div
                  className="flex items-center gap-2.5"
                  style={{ padding: '10px 14px', borderBottom: `1px solid ${t.line}`, background: t.bg2 }}
                >
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: '#3a3a3a' }} />
                    <span className="h-2 w-2 rounded-full" style={{ background: '#3a3a3a' }} />
                    <span className="h-2 w-2 rounded-full" style={{ background: '#3a3a3a' }} />
                  </div>
                  <span className="ml-1.5 text-[11px]" style={{ color: t.textDim }}>
                    app.netwatchlabs.com/fleet
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[10px]" style={{ color: t.accent }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: t.accent }} />
                    sample fleet
                  </span>
                </div>
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  poster="/demo-poster.png"
                  className="block h-auto w-full"
                  aria-label="netwatch cloud fleet demo"
                  style={{ background: t.bg }}
                >
                  <source src="/demo.webm" type="video/webm" />
                  <source src="/demo.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer
            className="grid items-center gap-2 px-5 py-6 text-center text-[11px] md:grid-cols-3 md:px-7 md:py-5 md:text-left"
            style={{ color: t.textDim }}
          >
            <span>netwatch labs · 2026 · MIT</span>
            <span className="md:text-center">rust + ratatui · made in tmux</span>
            <span className="flex flex-wrap justify-center gap-x-2 md:justify-end">
              <a href="https://github.com/matthart1983" target="_blank" rel="noopener noreferrer" style={{ color: t.textDim, textDecoration: 'none' }}>github</a>
              <span aria-hidden>·</span>
              <Link href="/cloud" style={{ color: t.textDim, textDecoration: 'none' }}>cloud</Link>
              <span aria-hidden>·</span>
              <Link href="/labs" style={{ color: t.textDim, textDecoration: 'none' }}>labs</Link>
              <span aria-hidden>·</span>
              <Link href="/labs#writing" style={{ color: t.textDim, textDecoration: 'none' }}>writing</Link>
            </span>
          </footer>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ num, kicker, title, sub, compact = false, t }: {
  num: string; kicker: string; title: string; sub: string | null; compact?: boolean
  t: { textDim: string; text: string; textMuted: string }
}) {
  return (
    <div>
      <div className="text-[11px]" style={{ color: t.textDim, letterSpacing: '0.22em' }}>
        {`// ${num} · ${kicker}`}
      </div>
      <h2
        className="m-0 font-semibold"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: compact ? 26 : 'clamp(28px, 4.4vw, 38px)',
          marginTop: 8,
          letterSpacing: '-0.025em',
          color: t.text,
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
      {sub && (
        <p className="mt-2.5 font-sans" style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6, maxWidth: 600 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function InstallSection({ tabs, t }: {
  tabs: Array<{ id: string; label: string; cmd: string; note: string }>
  t: { bg: string; bg2: string; line: string; lineSoft: string; text: string; textMuted: string; textDim: string; accent: string }
}) {
  const [active, setActive] = useState(tabs[0].id)
  const cur = tabs.find(x => x.id === active) ?? tabs[0]
  return (
    <section id="install" style={{ padding: '56px 28px', borderBottom: `1px solid ${t.line}` }}>
      <SectionHeader
        num="02"
        kicker="INSTALL"
        title="Three install paths. One philosophy."
        sub="Pick what your machine already has. The binaries are static — they'll run on any Linux from 2018 onwards."
        t={t}
      />
      <div className="mt-8 flex flex-wrap text-[12px]">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className="transition-colors"
            style={{
              padding: '10px 16px',
              background: tab.id === active ? t.bg2 : 'transparent',
              color: tab.id === active ? t.text : t.textDim,
              border: `1px solid ${t.line}`,
              borderRight: i === tabs.length - 1 ? `1px solid ${t.line}` : 'none',
              borderBottom: tab.id === active ? `1px solid ${t.bg2}` : `1px solid ${t.line}`,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
        <div className="hidden flex-1 sm:block" style={{ borderBottom: `1px solid ${t.line}` }} />
      </div>
      <div
        style={{
          background: t.bg2,
          border: `1px solid ${t.line}`,
          borderTop: 'none',
          padding: '20px 22px',
          fontSize: 13,
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: t.accent }}>$</span>
          <span style={{ color: t.text, flex: 1, wordBreak: 'break-all' }}>{cur.cmd}</span>
        </div>
        <div className="mt-3 text-[12px]" style={{ color: t.textDim }}>{cur.note}</div>
      </div>
    </section>
  )
}

interface ReleaseEntry { project: string; version: string; date: string; url: string; prerelease: boolean }

function ChangelogList({ t }: {
  t: { line: string; lineSoft: string; bg: string; text: string; textMuted: string; textDim: string; accent: string; warn: string }
}) {
  const [releases, setReleases] = useState<ReleaseEntry[] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/releases')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data && Array.isArray(data.releases)) setReleases(data.releases)
      })
      .catch(() => { if (!cancelled) setReleases([]) })
    return () => { cancelled = true }
  }, [])

  if (releases === null) {
    return (
      <div className="mt-7 text-[12px]" style={{ color: t.textDim, border: `1px solid ${t.line}`, padding: '14px 18px' }}>
        loading releases…
      </div>
    )
  }
  if (releases.length === 0) {
    return (
      <div className="mt-7 text-[12px]" style={{ color: t.textDim, border: `1px solid ${t.line}`, padding: '14px 18px' }}>
        could not load releases — check{' '}
        <a href="https://github.com/matthart1983" target="_blank" rel="noopener noreferrer" style={{ color: t.accent }}>github</a>
      </div>
    )
  }
  return (
    <div className="mt-7" style={{ border: `1px solid ${t.line}`, fontSize: 12.5 }}>
      {releases.map((r, i) => (
        <div
          key={`${r.project}-${r.version}`}
          className="grid items-center gap-3"
          style={{
            padding: '11px 18px',
            gridTemplateColumns: '90px 110px 80px 1fr 60px',
            borderBottom: i < releases.length - 1 ? `1px solid ${t.lineSoft}` : 'none',
          }}
        >
          <span style={{ color: t.textDim }}>{r.date.slice(5)}</span>
          <span style={{ color: t.text, fontWeight: 600 }}>{r.project}</span>
          <span style={{ color: t.textDim }}>{r.version}</span>
          <span style={{ color: t.textMuted }}>release</span>
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: t.textDim, textDecoration: 'none', textAlign: 'right' }}
          >
            view →
          </a>
        </div>
      ))}
    </div>
  )
}

type LandingTokens = {
  bg: string; bg2: string; line: string; lineSoft: string;
  text: string; textMuted: string; textDim: string; accent: string;
  warn: string; err: string;
}

interface LandingProject {
  id: string
  name: string
  version: string
  starsFallback: number
  repo: string
  repoUrl: string
  tagline: string
  desc: string
  badges: string[]
  install: string
  gif: string
  status: 'stable' | 'beta' | 'preview'
  statusCol: string
}

function HeroTerminal({ projects, t }: { projects: LandingProject[]; t: LandingTokens }) {
  const cmd = 'cargo search netwatch syswatch diskwatch essh --limit 4'
  const typed = useTypewriter(cmd, { speed: 35, startDelay: 600, loop: true, pauseAfter: 7000 })
  const ready = typed.length === cmd.length
  const colour = (s: LandingProject['status']) =>
    s === 'stable' ? t.accent : s === 'beta' ? t.warn : t.textDim
  return (
    <div className="flex min-w-0 flex-col justify-center gap-3 self-stretch">
      <div className="min-w-0 overflow-hidden" style={{ background: t.bg2, border: `1px solid ${t.line}` }}>
        <div
          className="flex items-center justify-between gap-2 text-[11px]"
          style={{ padding: '10px 14px', borderBottom: `1px solid ${t.line}`, background: t.bg, color: t.textDim }}
        >
          <span className="truncate">{'~/netwatch-labs · zsh'}</span>
          <span className="hidden sm:inline">96×24</span>
        </div>
        <div className="px-3 py-4 text-[12px] sm:px-6 sm:py-5 sm:text-[13px]" style={{ minHeight: 320 }}>
          <div style={{ wordBreak: 'break-word' }}>
            <span style={{ color: t.accent }}>operator@netwatch</span>
            <span style={{ color: t.textDim }}>:</span>
            <span style={{ color: t.text }}>~</span>
            <span style={{ color: t.textDim }}>{' $ '}</span>
            <span style={{ color: t.text }}>{typed}</span>
            {!ready && (
              <span
                style={{
                  display: 'inline-block',
                  width: '0.55em',
                  height: '0.95em',
                  background: t.accent,
                  verticalAlign: '-0.1em',
                  marginLeft: 1,
                  animation: 'caretBlink 1s steps(1) infinite',
                }}
              />
            )}
          </div>
          {ready && (
            <div className="mt-4 text-[11.5px] sm:text-[12.5px]">
              {projects.map((p, i) => (
                <HeroTerminalRow key={p.id} project={p} delay={i * 140} t={t} colour={colour(p.status)} />
              ))}
              <div className="mt-3" style={{ color: t.textDim, wordBreak: 'break-word' }}>
                {'4 crates · '}
                <span style={{ color: t.accent }}>cargo install &lt;name&gt;</span>
                {' to fetch'}
              </div>
              <div className="mt-1.5" style={{ wordBreak: 'break-word' }}>
                <span style={{ color: t.accent }}>operator@netwatch</span>
                <span style={{ color: t.textDim }}>:</span>
                <span style={{ color: t.text }}>~</span>
                <span style={{ color: t.textDim }}>{' $ '}</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '0.55em',
                    height: '0.95em',
                    background: t.accent,
                    verticalAlign: '-0.1em',
                    marginLeft: 1,
                    animation: 'caretBlink 1s steps(1) infinite',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between text-[11px]" style={{ color: t.textDim, padding: '0 4px' }}>
        <span>{'// crates.io · live versions'}</span>
        <span style={{ color: t.accent }}>▶ typing</span>
      </div>
    </div>
  )
}

// TEST variant of HeroTerminal — wraps a looping video inside the same
// terminal-window chrome so it slots into the hero grid identically.
// Revert by switching the call site back to <HeroTerminal />.
function HeroTerminalVideo({ t }: { t: LandingTokens }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-3 self-stretch">
      <div className="min-w-0 overflow-hidden" style={{ background: t.bg2, border: `1px solid ${t.line}` }}>
        <div
          className="flex items-center justify-between gap-2 text-[11px]"
          style={{ padding: '10px 14px', borderBottom: `1px solid ${t.line}`, background: t.bg, color: t.textDim }}
        >
          <span className="truncate">{'~/netwatch-labs · zsh'}</span>
          <span className="hidden sm:inline">96×24</span>
        </div>
        <div style={{ position: 'relative', background: '#000', aspectRatio: '16 / 9' }}>
          <video
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          >
            <source src="/hero-terminal.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
      <div className="flex justify-between text-[11px]" style={{ color: t.textDim, padding: '0 4px' }}>
        <span>{'// netwatch · demo loop'}</span>
        <span style={{ color: t.accent }}>▶ playing</span>
      </div>
    </div>
  )
}

function HeroTerminalRow({ project, delay, t, colour }: {
  project: LandingProject; delay: number; t: LandingTokens; colour: string
}) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), delay)
    return () => window.clearTimeout(id)
  }, [delay])
  if (!show) return null
  return (
    <div
      className="mb-1 grid items-baseline gap-x-2 gap-y-0.5 [grid-template-columns:auto_auto_auto] sm:[grid-template-columns:90px_90px_60px_minmax(0,1fr)]"
    >
      <span style={{ color: t.text, fontWeight: 600 }}>{project.name}</span>
      <span style={{ color: t.textDim }}>{`= "${project.version.replace(/^v/, '')}"`}</span>
      <span style={{ color: colour }}>{project.status}</span>
      <span
        className="col-span-3 truncate sm:col-span-1"
        style={{ color: t.textDim }}
      >
        {'# ' + project.tagline}
      </span>
    </div>
  )
}

function fmtTime(s: number): string {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function Walkthrough({ t }: { t: LandingTokens }) {
  const [ref, seen] = useInView<HTMLDivElement>({ threshold: 0.25 })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (seen) v.play().catch(() => {})
    else v.pause()
  }, [seen])
  return (
    <section style={{ padding: '64px 28px 72px', borderBottom: `1px solid ${t.line}` }}>
      <SectionHeader
        num="01"
        kicker="WALKTHROUGH"
        title="A quiet, read-only window into your stack."
        sub="One static Rust binary per tool. Reads everything, mutates nothing. No daemon, no telemetry, no SaaS lock-in."
        t={t}
      />
      <div
        ref={ref}
        className="mt-9"
        style={{ background: t.bg2, border: `1px solid ${t.line}` }}
      >
        <div
          className="flex items-center justify-between text-[11px]"
          style={{ padding: '10px 16px', borderBottom: `1px solid ${t.line}`, color: t.textDim }}
        >
          <div className="flex items-center gap-2.5">
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
            <span className="ml-3.5">{'~/netwatch-labs · demo · netwatch'}</span>
          </div>
          <div className="flex gap-4">
            <span>
              <span style={{ color: t.accent }}>●</span> REC
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {fmtTime(time)} / {fmtTime(duration)}
            </span>
          </div>
        </div>
        <div style={{ position: 'relative', background: '#000', aspectRatio: '16 / 9' }}>
          <video
            ref={videoRef}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          >
            <source src="/hero.mp4" type="video/mp4" />
          </video>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 3px)',
              mixBlendMode: 'overlay',
            }}
          />
        </div>
        <div
          className="flex items-center gap-4 text-[11px]"
          style={{ padding: '10px 16px', borderTop: `1px solid ${t.line}`, color: t.textDim }}
        >
          <span style={{ color: t.accent }}>{'// 00'}</span>
          <span>{'open-source · no audio · loops'}</span>
          <div className="flex-1" style={{ height: 2, background: t.lineSoft, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: duration ? `${(time / duration) * 100}%` : '0%',
                background: t.accent,
                transition: 'width 120ms linear',
              }}
            />
          </div>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {duration ? `${Math.round((time / duration) * 100)}%` : '0%'}
          </span>
        </div>
      </div>
    </section>
  )
}

function HeroStats({ projectCount, t }: { projectCount: number; t: LandingTokens }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.1 })
  const [target, setTarget] = useState(1741)
  useEffect(() => {
    let cancelled = false
    fetch('/api/stars')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d && typeof d.total === 'number') setTarget(d.total) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  const projects = useCountUp(projectCount, { active: inView, durationMs: 900 })
  const stars = useCountUp(target, {
    active: inView,
    durationMs: 1600,
    format: n => (n >= 1000 ? `${(n / 1000).toFixed(1)}k+` : `${Math.round(n)}`),
  })
  const tracking = useCountUp(0, { active: inView, durationMs: 600, format: () => '0' })
  return (
    <div
      ref={ref}
      className="mt-10 grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4"
      style={{ borderTop: `1px solid ${t.lineSoft}` }}
    >
      <HeroStat k="projects" v={projects} t={t} />
      <HeroStat k="github_stars" v={stars} t={t} />
      <HeroStat k="license" v="MIT" t={t} />
      <HeroStat k="telemetry" v={tracking} t={t} />
    </div>
  )
}

function HeroStat({ k, v, t }: { k: string; v: string; t: LandingTokens }) {
  return (
    <div>
      <div className="font-medium" style={{ fontSize: 18, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
        {v}
      </div>
      <div className="mt-1 text-[11px]" style={{ color: t.textDim }}>{k}</div>
    </div>
  )
}

function ProjectCard({ p, index, total, t }: { p: LandingProject; index: number; total: number; t: LandingTokens }) {
  const right = index % 2 === 1
  const bottom = index >= total - 2
  const [hover, setHover] = useState(false)
  // Live version from the same /api/releases feed that powers the changelog,
  // so cards never show a stale hardcoded version. Falls back to p.version.
  const [liveVersion, setLiveVersion] = useState(p.version)
  useEffect(() => {
    let cancelled = false
    fetch('/api/releases')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data || !Array.isArray(data.releases)) return
        const mine = (data.releases as { project: string; version: string }[]).find(r => r.project === p.id)
        if (mine?.version) setLiveVersion(mine.version)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [p.id])
  // Demo GIFs aren't published for every tool yet (e.g. diskwatch). Fall back to
  // a styled placeholder instead of a broken image if the asset 404s.
  const [gifBroken, setGifBroken] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex flex-col gap-4"
      style={{
        padding: 24,
        minHeight: 360,
        borderRight: !right ? `1px solid ${t.line}` : 'none',
        borderBottom: !bottom ? `1px solid ${t.line}` : 'none',
        background: hover ? '#0c1316' : t.bg,
        transition: 'background 200ms',
        cursor: 'default',
      }}
    >
      <div className="flex items-center justify-between text-[11px]" style={{ color: t.textDim }}>
        <span style={{ letterSpacing: '0.1em' }}>{`// 0${index + 1}`}</span>
        <span
          style={{
            color: p.statusCol,
            border: `1px solid ${p.statusCol}`,
            padding: '2px 8px',
            letterSpacing: '0.1em',
            fontSize: 10,
          }}
        >
          {p.status.toUpperCase()}
        </span>
      </div>
      <div className="flex items-baseline gap-3">
        <Link
          href={`/labs/${p.id}`}
          className="transition-colors hover:!text-[var(--nw-accent)]"
          title={`${p.name} — how to use`}
          style={{ fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em', color: t.text, textDecoration: 'none' }}
        >
          {p.name}
        </Link>
        <span className="text-[11px]" style={{ color: t.textDim }}>{liveVersion}</span>
      </div>
      <div style={{ color: t.accent, fontSize: 13, marginTop: -8 }}>{p.tagline}</div>
      <p className="font-sans m-0" style={{ fontSize: 13.5, color: t.textMuted, lineHeight: 1.6 }}>
        {p.desc}
      </p>
      <Link
        href={`/labs/${p.id}`}
        className="-mt-1 inline-flex items-center gap-1.5 transition-colors hover:!text-[var(--nw-text)]"
        style={{ color: t.accent, fontSize: 12, textDecoration: 'none' }}
      >
        $ man {p.name} <span style={{ color: t.textDim }}>— how to use →</span>
      </Link>
      <div
        className="overflow-hidden"
        style={{
          background: t.bg2,
          border: `1px solid ${hover ? '#2e6b46' : t.line}`,
          transition: 'border-color 200ms',
        }}
      >
        {gifBroken ? (
          <div
            className="flex items-center justify-center"
            style={{ aspectRatio: '16 / 9', background: t.bg, color: t.textDim, fontSize: 12 }}
          >
            {`// ${p.name} demo coming soon`}
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={p.gif}
            alt={`${p.name} TUI demo`}
            loading="lazy"
            onError={() => setGifBroken(true)}
            className="block h-auto w-full"
            style={{ background: t.bg }}
          />
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px]" style={{ color: t.textDim, borderTop: `1px solid ${t.lineSoft}` }}>
        <div className="flex flex-wrap gap-1.5">
          {p.badges.map(b => (
            <span key={b} style={{ border: `1px solid ${t.line}`, borderRadius: 3, padding: '2px 8px' }}>
              {b}
            </span>
          ))}
        </div>
        <a
          href={p.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 transition-colors hover:!text-[var(--nw-text)]"
          style={{ color: t.textMuted }}
        >
          {p.repo} <span style={{ color: t.textDim }}>↗</span>
        </a>
      </div>
    </div>
  )
}

interface HostMetrics {
  cpu: number | null
  memPct: number | null
  disk: number | null
  load1m: number | null
  latency: number | null
  loss: number | null
  connections: number | null
  cpuHistory: number[]
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function DenseHostTable({ hosts, hostMetrics, firingPerHost }: {
  hosts: Host[]
  hostMetrics: Record<string, HostMetrics>
  firingPerHost: Record<string, number>
}) {
  const col = (value: number | null, warn: number, crit: number) => {
    if (value == null) return 'nw-muted'
    if (value > crit) return 'text-red-400'
    if (value > warn) return 'text-yellow-400'
    return 'text-zinc-200'
  }
  const Bar = ({ value, warn, crit }: { value: number | null; warn: number; crit: number }) => {
    if (value == null) return <div className="w-12 h-1.5 bg-white/5 rounded" />
    const pct = Math.min(100, Math.max(0, value))
    const color = value > crit ? 'bg-red-400/70' : value > warn ? 'bg-yellow-400/70' : 'bg-emerald-400/60'
    return (
      <div className="w-12 h-1.5 bg-white/5 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    )
  }
  return (
    <div className="nw-card rounded-[1rem] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider nw-subtle">
            <tr className="border-b border-white/6">
              <th className="text-left py-1.5 px-2"></th>
              <th className="text-left py-1.5 px-2">Host</th>
              <th className="text-left py-1.5 px-2 hidden md:table-cell">OS</th>
              <th className="text-right py-1.5 px-2">CPU</th>
              <th className="text-right py-1.5 px-2">MEM</th>
              <th className="text-right py-1.5 px-2">LOAD</th>
              <th className="text-right py-1.5 px-2">DISK</th>
              <th className="text-right py-1.5 px-2 hidden lg:table-cell">NET RX/TX</th>
              <th className="text-right py-1.5 px-2">RTT</th>
              <th className="text-right py-1.5 px-2">⚠</th>
              <th className="py-1.5 px-2 hidden xl:table-cell">Trend</th>
              <th className="py-1.5 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {hosts.map(host => {
              const m = hostMetrics[host.id] || {} as HostMetrics
              const firing = firingPerHost[host.id] ?? 0
              const netRx = m.cpuHistory && m.cpuHistory.length > 0
                ? undefined // rx not in HostMetrics today — leave dash
                : undefined
              void netRx
              return (
                <tr key={host.id} className="border-b border-white/6 last:border-b-0 hover:bg-white/3 transition-colors">
                  <td className="py-1 px-2">
                    <span className={`w-2 h-2 rounded-full inline-block ${host.is_online ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  </td>
                  <td className="py-1 px-2 font-medium text-zinc-200 truncate max-w-[200px]">
                    <Link href={`/hosts/${host.id}`} className="hover:text-[var(--nw-accent)]">{host.hostname}</Link>
                  </td>
                  <td className="py-1 px-2 text-xs nw-muted truncate max-w-[140px] hidden md:table-cell">{host.os ?? '—'}</td>
                  <td className="py-1 px-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Bar value={m.cpu ?? null} warn={80} crit={95} />
                      <span className={`tabular-nums w-9 text-right ${col(m.cpu ?? null, 80, 95)}`}>{m.cpu != null ? `${m.cpu.toFixed(0)}%` : '—'}</span>
                    </div>
                  </td>
                  <td className="py-1 px-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Bar value={m.memPct ?? null} warn={85} crit={95} />
                      <span className={`tabular-nums w-9 text-right ${col(m.memPct ?? null, 85, 95)}`}>{m.memPct != null ? `${m.memPct.toFixed(0)}%` : '—'}</span>
                    </div>
                  </td>
                  <td className={`py-1 px-2 text-right tabular-nums ${col(m.load1m ?? null, host.cpu_cores ?? 99, (host.cpu_cores ?? 99) * 2)}`}>
                    {m.load1m != null ? m.load1m.toFixed(2) : '—'}
                  </td>
                  <td className="py-1 px-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Bar value={m.disk ?? null} warn={85} crit={95} />
                      <span className={`tabular-nums w-9 text-right ${col(m.disk ?? null, 85, 95)}`}>{m.disk != null ? `${m.disk.toFixed(0)}%` : '—'}</span>
                    </div>
                  </td>
                  <td className="py-1 px-2 text-right text-xs tabular-nums nw-muted hidden lg:table-cell">—</td>
                  <td className={`py-1 px-2 text-right tabular-nums ${col(m.latency ?? null, 100, 250)}`}>
                    {m.latency != null ? `${m.latency.toFixed(0)}ms` : '—'}
                  </td>
                  <td className="py-1 px-2 text-right">
                    {firing > 0 ? (
                      <span className="inline-block rounded-full bg-red-500/20 text-red-400 px-1.5 text-xs font-semibold tabular-nums">{firing}</span>
                    ) : <span className="nw-subtle">—</span>}
                  </td>
                  <td className="py-1 px-2 hidden xl:table-cell">
                    {m.cpuHistory && m.cpuHistory.length > 1
                      ? <MiniSparkline data={m.cpuHistory} color="#fbbf24" height={14} />
                      : <span className="nw-subtle text-xs">—</span>}
                  </td>
                  <td className="py-1 px-2 text-right">
                    <Link href={`/hosts/${host.id}`} className="nw-muted hover:text-zinc-200">
                      <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatRateKBps(kbps: number): string {
  if (kbps >= 1024 * 1024) return `${(kbps / 1024 / 1024).toFixed(1)} GB/s`
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`
  return `${kbps.toFixed(0)} KB/s`
}

function FleetSpark({ title, data, series, footer }: {
  title: string
  data: Array<Record<string, unknown>>
  series: Array<{ key: string; stroke: string; label: string; format: (v: number) => string }>
  footer: string
}) {
  const latest = data[data.length - 1]
  return (
    <div className="nw-card rounded-[1rem] px-3 py-2">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs uppercase tracking-wider nw-subtle">{title}</span>
        <span className="text-xs nw-subtle tabular-nums">{footer}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5 text-xs tabular-nums shrink-0 min-w-[90px]">
          {series.map(s => {
            const v = latest?.[s.key] as number | undefined
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.stroke }} />
                <span className="nw-muted truncate">{s.label}</span>
                <span style={{ color: s.stroke }}>{v != null ? s.format(v) : '—'}</span>
              </div>
            )
          })}
        </div>
        <div className="flex-1 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              {series.map(s => (
                <Line key={s.key} dataKey={s.key} stroke={s.stroke} dot={false} connectNulls strokeWidth={1.5} isAnimationActive={false} />
              ))}
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function PulseCount({ value, label, tone = 'neutral' }: {
  value: number; label: string; tone?: 'good' | 'bad' | 'warn' | 'muted' | 'neutral'
}) {
  const color = tone === 'good' ? 'text-emerald-400'
    : tone === 'bad' ? 'text-red-400'
    : tone === 'warn' ? 'text-yellow-400'
    : tone === 'muted' ? 'text-zinc-300'
    : 'text-zinc-200'
  return (
    <span className="flex items-baseline gap-1">
      <span className={`text-base font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs uppercase tracking-wider nw-subtle">{label}</span>
    </span>
  )
}

function PulsePeak({ label, value, host, threshold }: {
  label: string; value: string; host: Host; threshold: 'ok' | 'warn' | 'crit'
}) {
  const valueColor = threshold === 'crit' ? 'text-red-400'
    : threshold === 'warn' ? 'text-yellow-400'
    : 'text-zinc-200'
  return (
    <Link href={`/hosts/${host.id}`} className="flex items-baseline gap-1 hover:brightness-125" title={`Peak ${label} on ${host.hostname}`}>
      <span className="text-[10px] uppercase tracking-wider nw-subtle">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${valueColor}`}>{value}</span>
      <span className="text-xs nw-muted truncate max-w-[120px]">{host.hostname}</span>
    </Link>
  )
}

function MiniSparkline({ data, color, height = 24 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 80
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function extractMetrics(points: MetricPoint[]): HostMetrics {
  const latest = points.length > 0 ? points[points.length - 1] : null
  const cpuHistory = points.slice(-20).map(p => p.cpu_usage_pct ?? 0)
  const memTotal = latest && latest.memory_used_bytes != null && latest.memory_available_bytes != null
    ? latest.memory_used_bytes + latest.memory_available_bytes : null
  const memPct = memTotal && latest?.memory_used_bytes != null ? (latest.memory_used_bytes / memTotal) * 100 : null
  return {
    cpu: latest?.cpu_usage_pct ?? null,
    memPct,
    disk: latest?.disk_usage_pct ?? null,
    load1m: latest?.load_avg_1m ?? null,
    latency: latest?.gateway_rtt_ms ?? null,
    loss: latest?.gateway_loss_pct ?? null,
    connections: latest?.connection_count ?? null,
    cpuHistory,
  }
}

function metricColor(value: number | null, warn: number, crit: number): string {
  if (value == null) return 'text-zinc-500'
  if (value >= crit) return 'text-red-400'
  if (value >= warn) return 'text-yellow-400'
  return 'text-emerald-400'
}

type HostSortKey = 'hostname' | 'last_seen' | 'cpu' | 'mem' | 'load'
type HostStatusFilter = 'all' | 'online' | 'offline' | 'warning'

export default function HostsPage() {
  const { token, isLoading: authLoading } = useAuth()
  const [hosts, setHosts] = useState<Host[]>([])
  const [hostMetrics, setHostMetrics] = useState<Record<string, HostMetrics>>({})
  const [hostPoints, setHostPoints] = useState<Record<string, MetricPoint[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<HostStatusFilter>('all')
  const [sortKey, setSortKey] = useState<HostSortKey>('hostname')
  const [sortDesc, setSortDesc] = useState(false)
  const [firingAlerts, setFiringAlerts] = useState(0)
  const [firingPerHost, setFiringPerHost] = useState<Record<string, number>>({})
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list'
    return (localStorage.getItem('nw-fleet-view') as 'list' | 'grid') ?? 'list'
  })
  const searchRef = useRef<HTMLInputElement>(null)

  // Fleet hotkeys: / focus search, g toggle list/grid
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (e.key === 'g') {
        e.preventDefault()
        setViewMode(v => v === 'list' ? 'grid' : 'list')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('nw-fleet-view', viewMode)
  }, [viewMode])

  // Firing alerts counts (fleet total + per-host), polled alongside fleet data.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    const load = async () => {
      try {
        const events = await getAlertHistory()
        if (cancelled) return
        setAlertEvents(events)
        const firing = events.filter(e => e.state === 'firing')
        setFiringAlerts(firing.length)
        const per: Record<string, number> = {}
        for (const e of firing) per[e.host_id] = (per[e.host_id] ?? 0) + 1
        setFiringPerHost(per)
      } catch { /* silent */ }
    }
    void load()
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [token])

  const handleRemoveHost = useCallback(async (host: Host) => {
    if (!window.confirm(`Remove "${host.hostname}" and all of its history? This cannot be undone.`)) return
    try {
      await deleteHost(host.id)
      setHosts(prev => prev.filter(h => h.id !== host.id))
    } catch {
      window.alert('Failed to remove host. Please try again.')
    }
  }, [])

  const fetchAll = useCallback(async () => {
    try {
      const data = await getHosts()
      setHosts(data)
      const from = new Date(Date.now() - 3600 * 1000).toISOString()
      const metricsMap: Record<string, HostMetrics> = {}
      const pointsMap: Record<string, MetricPoint[]> = {}
      await Promise.all(data.map(async (host) => {
        try {
          const m = await getMetrics(host.id, from)
          metricsMap[host.id] = extractMetrics(m.points)
          pointsMap[host.id] = m.points
        } catch {
          metricsMap[host.id] = { cpu: null, memPct: null, disk: null, load1m: null, latency: null, loss: null, connections: null, cpuHistory: [] }
          pointsMap[host.id] = []
        }
      }))
      setHostMetrics(metricsMap)
      setHostPoints(pointsMap)
    } catch {
      // handled by api client redirect
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !token) return

    fetchAll()
    const interval = setInterval(fetchAll, 30_000)
    return () => clearInterval(interval)
  }, [token, authLoading, fetchAll])

  // Aggregate time-series across hosts. Key by minute bucket so snapshots
  // from different hosts line up. MUST be declared before any early return
  // so React sees the same hook order every render.
  const fleetSeries = useMemo(() => {
    type Bucket = { rx: number; tx: number; cpuSum: number; cpuN: number; load: number }
    const buckets = new Map<string, Bucket>()
    for (const points of Object.values(hostPoints)) {
      for (const p of points) {
        const t = new Date(p.time)
        t.setSeconds(0, 0)
        const key = t.toISOString()
        const b = buckets.get(key) ?? { rx: 0, tx: 0, cpuSum: 0, cpuN: 0, load: 0 }
        if (p.net_rx_rate_bps != null) b.rx += p.net_rx_rate_bps
        if (p.net_tx_rate_bps != null) b.tx += p.net_tx_rate_bps
        if (p.cpu_usage_pct != null) { b.cpuSum += p.cpu_usage_pct; b.cpuN += 1 }
        if (p.load_avg_1m != null && p.load_avg_1m > b.load) b.load = p.load_avg_1m
        buckets.set(key, b)
      }
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, b]) => ({
        time: new Date(key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rx: b.rx / 1024,                              // KB/s
        tx: b.tx / 1024,                              // KB/s
        cpu: b.cpuN > 0 ? b.cpuSum / b.cpuN : null,   // avg % across fleet
        load: b.load,                                 // peak load in bucket
      }))
  }, [hostPoints])

  // Active-alert count over time, reconstructed by replaying firing/resolved
  // events in order and sampling the live count at each event.
  const alertSeries = useMemo<TimePoint[]>(() => {
    if (alertEvents.length === 0) return []
    const sorted = [...alertEvents].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const active = new Set<string>()
    const pts: TimePoint[] = []
    for (const e of sorted) {
      const key = `${e.rule_id}:${e.host_id}`
      if (e.state === 'firing') active.add(key)
      else active.delete(key)
      pts.push({ t: new Date(e.created_at).getTime(), v: active.size })
    }
    return pts
  }, [alertEvents])

  // Render the marketing landing during the auth-loading phase as well as when
  // unauthenticated. Auth state lives only in localStorage/window, so the server
  // (and the first client render, before hydration) always sees authLoading=true.
  // Returning <Landing /> here — instead of null — means crawlers, social
  // unfurlers and AI summarizers get the real marketing HTML server-side, with
  // no hydration mismatch. Authenticated users briefly see the landing before
  // the token hydrates and the dashboard takes over.
  if (authLoading || !token) {
    return <Landing />
  }

  if (loading) {
    return <div className="mt-10 nw-muted">Loading fleet...</div>
  }

  if (hosts.length === 0) {
    if (SOURCE_KIND === 'local') {
      const apiKey = typeof window !== 'undefined' ? window.__NETWATCH_TOKEN__ ?? '' : ''
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      return (
        <div className="nw-empty-state mt-10 max-w-3xl">
          <span className="nw-kicker">First host onboarding</span>
          <h1 className="mt-4 text-3xl font-semibold">No hosts connected yet</h1>
          <p className="mb-4 mt-3 text-base leading-7 nw-muted">
            Point a NetWatch agent at this dashboard to start ingesting metrics.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider nw-subtle mb-1">Ingest URL</div>
              <code className="block break-all rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm">{origin}/api/v1/ingest</code>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider nw-subtle mb-1">API key</div>
              <code className="block break-all rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm">{apiKey}</code>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="nw-empty-state mt-10 max-w-3xl">
        <span className="nw-kicker">First host onboarding</span>
        <h1 className="mt-4 text-3xl font-semibold">No hosts connected yet</h1>
        <p className="mb-4 mt-3 text-base leading-7 nw-muted">Install the NetWatch agent on a Linux server to bring the workspace to life.</p>
        <p className="text-sm nw-muted">Go to <Link href="/settings" className="font-medium text-[var(--nw-accent)] hover:text-[#cdf0d7]">Settings</Link> to grab your API key and a ready-to-paste install command.</p>
      </div>
    )
  }

  // FleetView handles its own filter/sort state; we just feed it data.
  const fleetMetrics: Record<string, import('./_components/dashboard/FleetView').HostMetricsSummary> = hostMetrics
  return (
    <DashboardChrome>
      <FleetView
        hosts={hosts}
        hostMetrics={fleetMetrics}
        hostPoints={hostPoints}
        firingPerHost={firingPerHost}
        totalFiring={firingAlerts}
        alertSeries={alertSeries}
        onRemove={handleRemoveHost}
      />
    </DashboardChrome>
  )
}

const HOST_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#fb923c', '#2dd4bf']
const TOOLTIP_STYLE = { background: '#1a1a1a', border: '1px solid #333', fontSize: 12 }

interface FleetChartConfig {
  title: string
  extract: (p: MetricPoint) => number | null
  unit: string
  yDomain?: [number | string, number | string]
  // Multi-series: multiple lines per host (e.g., RX + TX)
  multiExtract?: { suffix: string; extract: (p: MetricPoint) => number | null; dashed?: boolean }[]
}

const FLEET_CHARTS: FleetChartConfig[] = [
  // Matches: Latency & Loss
  { title: 'Gateway Latency (ms)', extract: p => p.gateway_rtt_ms, unit: 'ms' },
  { title: 'Packet Loss (%)', extract: p => p.gateway_loss_pct, unit: '%', yDomain: [0, 'auto'] },
  // Matches: Network & Connections
  { title: 'Network I/O (KB)', extract: () => null, unit: 'KB', multiExtract: [
    { suffix: 'RX', extract: p => p.net_rx_bytes != null ? p.net_rx_bytes / 1024 : null },
    { suffix: 'TX', extract: p => p.net_tx_bytes != null ? p.net_tx_bytes / 1024 : null, dashed: true },
  ]},
  // Matches: CPU & Memory
  { title: 'CPU Usage (%)', extract: p => p.cpu_usage_pct, unit: '%', yDomain: [0, 100] },
  { title: 'Memory Usage (%)', extract: p => {
    if (p.memory_used_bytes == null || p.memory_available_bytes == null) return null
    const total = p.memory_used_bytes + p.memory_available_bytes
    return total > 0 ? (p.memory_used_bytes / total) * 100 : null
  }, unit: '%', yDomain: [0, 100] },
  // Matches: Load & Swap
  { title: 'Load Average (1m)', extract: p => p.load_avg_1m, unit: '' },
  { title: 'Swap Used (MB)', extract: p => p.swap_used_bytes != null ? p.swap_used_bytes / (1024 * 1024) : null, unit: 'MB' },
  // Matches: Disk Utilisation
  { title: 'Disk Usage (%)', extract: p => p.disk_usage_pct, unit: '%', yDomain: [0, 100] },
  // Matches: TCP Connection States
  { title: 'Connections', extract: p => p.connection_count, unit: '' },
]

const FLEET_LS_KEY = 'fleet-dashboard-state-v1'

interface FleetDashState { collapsed: Record<string, boolean>; order: string[] }

function loadFleetDashState(): FleetDashState {
  if (typeof window === 'undefined') return { collapsed: {}, order: [] }
  try {
    const raw = localStorage.getItem(FLEET_LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { collapsed: parsed.collapsed || {}, order: parsed.order || [] }
    }
  } catch {}
  return { collapsed: {}, order: [] }
}

function saveFleetDashState(state: FleetDashState) {
  try { localStorage.setItem(FLEET_LS_KEY, JSON.stringify(state)) } catch {}
}

function buildFleetChartData(cfg: FleetChartConfig, hosts: Host[], hostPoints: Record<string, MetricPoint[]>) {
  const isMulti = !!cfg.multiExtract
  const timeMap = new Map<string, Record<string, unknown>>()

  hosts.forEach((host, hostIdx) => {
    const points = hostPoints[host.id] || []
    for (const p of points) {
      const t = new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      if (!timeMap.has(t)) timeMap.set(t, { time: t } as Record<string, unknown>)
      const row = timeMap.get(t)!
      if (isMulti) {
        for (const series of cfg.multiExtract!) {
          const val = series.extract(p)
          if (val != null) row[`h${hostIdx}_${series.suffix}`] = Math.round(val * 100) / 100
        }
      } else {
        const val = cfg.extract(p)
        if (val != null) row[`h${hostIdx}`] = Math.round(val * 100) / 100
      }
    }
  })

  const data = Array.from(timeMap.values()).sort((a, b) =>
    String(a.time).localeCompare(String(b.time))
  )

  const lines: { key: string; stroke: string; name: string; dashed?: boolean }[] = []
  if (isMulti) {
    hosts.forEach((host, i) => {
      for (const series of cfg.multiExtract!) {
        lines.push({
          key: `h${i}_${series.suffix}`,
          stroke: HOST_COLORS[i % HOST_COLORS.length],
          name: `${host.hostname} ${series.suffix}`,
          dashed: series.dashed,
        })
      }
    })
  } else {
    hosts.forEach((host, i) => {
      lines.push({ key: `h${i}`, stroke: HOST_COLORS[i % HOST_COLORS.length], name: host.hostname })
    })
  }

  return { data, lines }
}

function FleetChartPanel({ cfg, hosts, hostPoints, isCollapsed, isLocked, onToggleCollapse, onMaximize }: {
  cfg: FleetChartConfig
  hosts: Host[]
  hostPoints: Record<string, MetricPoint[]>
  isCollapsed: boolean
  isLocked: boolean
  onToggleCollapse: () => void
  onMaximize: () => void
}) {
  const { data, lines } = useMemo(() => buildFleetChartData(cfg, hosts, hostPoints), [cfg, hosts, hostPoints])
  if (data.length === 0) return null

  return (
    <div className="nw-card rounded-[1.25rem] h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 shrink-0">
        {!isLocked && (
          <GripVertical size={14} className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0" />
        )}
        <h3 className="text-sm font-medium text-zinc-300 truncate">{cfg.title}</h3>
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button onClick={onMaximize} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title="Maximize">
            <Maximize2 size={13} />
          </button>
          <button onClick={onToggleCollapse} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title={isCollapsed ? 'Expand' : 'Collapse'}>
            {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex-1 min-h-0 p-2" style={{ minHeight: 140 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={120}>
            <LineChart data={data} syncId="fleet-dashboard">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" stroke="#666" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis stroke="#666" tick={{ fontSize: 10 }} domain={cfg.yDomain} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {lines.map(line => (
                <Line
                  key={line.key}
                  dataKey={line.key}
                  stroke={line.stroke}
                  dot={false}
                  connectNulls
                  strokeWidth={1.5}
                  strokeDasharray={line.dashed ? '5 3' : undefined}
                  name={line.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function FleetMaximizedOverlay({ cfg, hosts, hostPoints, onClose }: {
  cfg: FleetChartConfig; hosts: Host[]; hostPoints: Record<string, MetricPoint[]>; onClose: () => void
}) {
  const { data, lines } = useMemo(() => buildFleetChartData(cfg, hosts, hostPoints), [cfg, hosts, hostPoints])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 bg-zinc-950/98 flex flex-col" onClick={onClose}>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-zinc-200">{cfg.title}</h2>
        <div className="flex items-center gap-3 ml-4 flex-wrap">
          {hosts.map((host, i) => (
            <span key={host.id} className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="w-3 h-0.5 rounded" style={{ background: HOST_COLORS[i % HOST_COLORS.length] }} />
              {host.hostname}
            </span>
          ))}
        </div>
        <button onClick={onClose} className="ml-auto p-2 text-zinc-400 hover:text-zinc-100 transition-colors" title="Close (Escape)">
          <Minimize2 size={18} />
        </button>
      </div>
      <div className="flex-1 p-6" onClick={e => e.stopPropagation()}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} syncId="fleet-dashboard">
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="time" stroke="#666" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis stroke="#666" tick={{ fontSize: 12 }} domain={cfg.yDomain} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {lines.map(line => (
              <Line
                key={line.key}
                dataKey={line.key}
                stroke={line.stroke}
                dot={false}
                connectNulls
                strokeWidth={2}
                strokeDasharray={line.dashed ? '5 3' : undefined}
                name={line.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function FleetCharts({ hosts, hostPoints }: { hosts: Host[]; hostPoints: Record<string, MetricPoint[]> }) {
  const [dashState, setDashState] = useState<FleetDashState>(() => loadFleetDashState())
  const [locked, setLocked] = useState(false)
  const [maximizedIdx, setMaximizedIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const dragItem = useRef<string | null>(null)

  const defaultOrder = FLEET_CHARTS.map((_, i) => String(i))
  const panelOrder = useMemo(() => {
    if (dashState.order.length === 0) return defaultOrder
    const ordered = dashState.order.filter(id => defaultOrder.includes(id))
    for (const id of defaultOrder) {
      if (!ordered.includes(id)) ordered.push(id)
    }
    return ordered
  }, [dashState.order, defaultOrder])

  const updateDashState = useCallback((updater: (prev: FleetDashState) => FleetDashState) => {
    setDashState(prev => {
      const next = updater(prev)
      saveFleetDashState(next)
      return next
    })
  }, [])

  const toggleCollapse = useCallback((id: string) => {
    updateDashState(prev => ({
      ...prev,
      collapsed: { ...prev.collapsed, [id]: !prev.collapsed[id] },
    }))
  }, [updateDashState])

  const resetLayout = useCallback(() => {
    setLocked(false)
    updateDashState(() => ({ collapsed: {}, order: [] }))
  }, [updateDashState])

  const handleDragStart = useCallback((id: string) => { dragItem.current = id }, [])
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (dragItem.current && dragItem.current !== id) setDragOver(id)
  }, [])
  const handleDrop = useCallback((id: string) => {
    const from = dragItem.current
    if (!from || from === id) { setDragOver(null); return }
    updateDashState(prev => {
      const order = [...(prev.order.length > 0 ? prev.order : defaultOrder)]
      const fromIdx = order.indexOf(from)
      const toIdx = order.indexOf(id)
      if (fromIdx === -1 || toIdx === -1) return prev
      order.splice(fromIdx, 1)
      order.splice(toIdx, 0, from)
      return { ...prev, order }
    })
    dragItem.current = null
    setDragOver(null)
  }, [updateDashState, defaultOrder])
  const handleDragEnd = useCallback(() => { dragItem.current = null; setDragOver(null) }, [])

  // Check if any charts have data
  const hasData = FLEET_CHARTS.some(cfg => {
    const { data } = buildFleetChartData(cfg, hosts, hostPoints)
    return data.length > 0
  })
  if (!hasData) return null

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Fleet Metrics</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocked(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              locked ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100 border-zinc-700'
            }`}
            title={locked ? 'Unlock layout' : 'Lock layout'}
          >
            {locked ? <Lock size={12} /> : <Unlock size={12} />}
            {locked ? 'Locked' : 'Unlocked'}
          </button>
          <button
            onClick={resetLayout}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-700 transition-colors"
            title="Reset panel layout and refresh fleet data"
          >
            <RotateCcw size={12} />
            Reset View
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {hosts.map((host, i) => (
          <span key={host.id} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-3 h-0.5 rounded" style={{ background: HOST_COLORS[i % HOST_COLORS.length] }} />
            {host.hostname}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {panelOrder.map(panelId => {
          const idx = parseInt(panelId)
          const cfg = FLEET_CHARTS[idx]
          if (!cfg) return null
          return (
            <div
              key={panelId}
              className={dragOver === panelId ? 'ring-2 ring-emerald-500/50 rounded-lg' : ''}
              style={{ height: dashState.collapsed[panelId] ? 'auto' : 240 }}
              draggable={!locked}
              onDragStart={() => handleDragStart(panelId)}
              onDragOver={(e) => handleDragOver(e, panelId)}
              onDrop={() => handleDrop(panelId)}
              onDragEnd={handleDragEnd}
            >
              <FleetChartPanel
                cfg={cfg}
                hosts={hosts}
                hostPoints={hostPoints}
                isCollapsed={!!dashState.collapsed[panelId]}
                isLocked={locked}
                onToggleCollapse={() => toggleCollapse(panelId)}
                onMaximize={() => setMaximizedIdx(idx)}
              />
            </div>
          )
        })}
      </div>

      {maximizedIdx != null && FLEET_CHARTS[maximizedIdx] && (
        <FleetMaximizedOverlay
          cfg={FLEET_CHARTS[maximizedIdx]}
          hosts={hosts}
          hostPoints={hostPoints}
          onClose={() => setMaximizedIdx(null)}
        />
      )}
    </div>
  )
}

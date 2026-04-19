'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { getHosts, getMetrics, Host, MetricPoint } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
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

const marketingLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#security', label: 'Security' },
  { href: '/labs', label: 'Labs' },
]

function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/6 bg-[#08111a]/78 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 md:h-[4.5rem] md:flex-row md:items-center md:justify-between md:gap-6 md:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(61,214,198,0.25)] bg-[rgba(61,214,198,0.12)] text-sm font-semibold text-[var(--nw-text)] shadow-[0_10px_30px_rgba(61,214,198,0.18)]">
            NW
          </div>
          <div className="min-w-0">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--nw-text-soft)]">NetWatch Cloud</div>
            <div className="hidden truncate text-sm font-semibold text-[var(--nw-text)] sm:block">Fleet intelligence for Linux infrastructure</div>
            <div className="truncate text-sm font-semibold text-[var(--nw-text)] sm:hidden">Fleet intelligence</div>
          </div>
        </div>
        <div className="hidden items-center justify-center gap-6 md:flex md:flex-1">
          {marketingLinks.map(link =>
            link.href.startsWith('/') ? (
              <Link key={link.href} href={link.href} className="text-sm nw-muted hover:text-[var(--nw-text)]">
                {link.label}
              </Link>
            ) : (
              <a key={link.href} href={link.href} className="text-sm nw-muted hover:text-[var(--nw-text)]">
                {link.label}
              </a>
            )
          )}
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:justify-end sm:gap-3 md:w-auto">
          <Link href="/login" className="text-sm font-medium nw-muted hover:text-[var(--nw-text)]">
            Log in
          </Link>
          <Link href="/register" className="nw-button-primary px-4 py-2 text-sm">
            Sign up free
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
          {marketingLinks.map(link =>
            link.href.startsWith('/') ? (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-full border border-white/8 bg-white/4 px-3 py-2 text-sm nw-muted hover:text-[var(--nw-text)]"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-full border border-white/8 bg-white/4 px-3 py-2 text-sm nw-muted hover:text-[var(--nw-text)]"
              >
                {link.label}
              </a>
            )
          )}
        </div>
      </div>
    </nav>
  )
}

function DashboardMockup() {
  const mockHosts = [
    { name: 'web-prod-1', os: 'Ubuntu 24.04', online: true, cpu: 23, mem: '7.2 GB', cores: 4 },
    { name: 'api-prod-1', os: 'Debian 12', online: true, cpu: 45, mem: '15.8 GB', cores: 8 },
    { name: 'db-replica-2', os: 'Ubuntu 22.04', online: false, cpu: 0, mem: '31.4 GB', cores: 16 },
  ]

  return (
    <div className="nw-card rounded-[1.6rem] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/6 bg-white/[0.02] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
        </div>
        <span className="ml-2 text-xs nw-subtle">netwatch cloud • fleet overview</span>
      </div>
      <div className="p-4">
        <div className="text-sm font-semibold mb-3 text-zinc-300">Hosts</div>
        <div className="grid gap-2">
          {mockHosts.map(host => (
            <div key={host.name} className="flex flex-col gap-3 rounded-[1rem] border border-white/6 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${host.online ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <div>
                  <div className="text-sm font-medium text-zinc-200">{host.name}</div>
                  <div className="text-xs text-zinc-500">{host.os}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                {host.online && <span>CPU {host.cpu}%</span>}
                <span>{host.cores} cores</span>
                <span>{host.mem} RAM</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChartMockup() {
  const points = [2.1, 1.8, 2.4, 1.5, 3.2, 8.7, 12.4, 9.1, 3.8, 2.2, 1.9, 2.0, 1.7, 2.3, 1.8]
  const max = Math.max(...points)
  const width = 400
  const height = 120
  const padding = 20

  const pathData = points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * (width - padding * 2)
      const y = height - padding - (p / max) * (height - padding * 2)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <div className="nw-card rounded-[1.6rem] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/6 bg-white/[0.02] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
        </div>
        <span className="ml-2 text-xs nw-subtle">host detail • latency timeline</span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-zinc-300">Gateway Latency (ms)</span>
          <div className="flex gap-1">
            {['1h', '6h', '24h', '72h'].map(r => (
              <span key={r} className={`text-xs px-2 py-0.5 rounded ${r === '24h' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>{r}</span>
            ))}
          </div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <path d={pathData} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />
          <circle cx={padding + (6 / (points.length - 1)) * (width - padding * 2)} cy={height - padding - (12.4 / max) * (height - padding * 2)} r="4" fill="#34d399" />
          <rect x={padding + (6 / (points.length - 1)) * (width - padding * 2) - 30} y={height - padding - (12.4 / max) * (height - padding * 2) - 24} width="60" height="18" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
          <text x={padding + (6 / (points.length - 1)) * (width - padding * 2)} y={height - padding - (12.4 / max) * (height - padding * 2) - 12} textAnchor="middle" fill="#a1a1aa" fontSize="10">12.4 ms</text>
        </svg>
      </div>
    </div>
  )
}

function AlertMockup() {
  const events = [
    { state: 'firing', message: 'CRITICAL: Host offline on db-replica-2', time: '2 min ago' },
    { state: 'resolved', message: 'RESOLVED: Gateway latency on web-prod-1', time: '14 min ago' },
    { state: 'firing', message: 'WARNING: Packet loss > 5% on api-prod-1', time: '23 min ago' },
  ]

  return (
    <div className="nw-card rounded-[1.6rem] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/6 bg-white/[0.02] px-4 py-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
        </div>
        <span className="ml-2 text-xs nw-subtle">alerts • recent event stream</span>
      </div>
      <div className="p-4 space-y-2">
        {events.map((e, i) => (
          <div key={i} className="rounded-[1rem] border border-white/6 bg-white/[0.03] p-3 flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full shrink-0 ${e.state === 'firing' ? 'bg-red-400' : 'bg-emerald-400'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-200 truncate">{e.message}</div>
            </div>
            <span className="text-xs text-zinc-500 shrink-0">{e.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Landing() {
  return (
    <div className="-mx-4 -mt-8 sm:-mx-6 lg:-mx-8">
      <LandingNav />

      {/* Hero */}
      <section className="mx-auto grid max-w-[1320px] gap-10 px-4 pb-12 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="nw-kicker">
              <Zap className="w-3 h-3" />
              Free while we grow
            </div>
            <a
              href="https://terminaltrove.com/netwatch/"
              target="_blank"
              rel="noopener noreferrer"
              title="Tool of The Week on Terminal Trove"
            >
              <img
                src="https://cdn.terminaltrove.com/media/badges/tool_of_the_week/svg/terminal_trove_tool_of_the_week_green_transparent.svg"
                alt="Terminal Trove Tool of The Week"
                height={36}
                style={{ height: 36, width: 'auto' }}
              />
            </a>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-semibold tracking-[-0.06em] text-[var(--nw-text)] sm:text-6xl">
              Network operations that look expensive,
              <span className="block text-[var(--nw-accent)]">without acting expensive.</span>
            </h1>
            <p className="max-w-2xl text-lg leading-8 nw-muted">
              A premium monitoring layer for Linux fleets: tiny Rust agent, real-time health, path-level visibility,
              and alerting that feels designed instead of bolted on.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="nw-button-primary px-6 py-3 text-base">
              Sign up free <ChevronRight className="w-4 h-4" />
            </Link>
            <a href="#how-it-works" className="nw-button-secondary px-6 py-3 text-base">
              See how it works
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Open source proof</div>
              <div className="mt-2 text-2xl font-semibold">1000+</div>
              <div className="mt-1 text-sm nw-muted">GitHub stars across NetWatch Labs</div>
            </div>
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Install path</div>
              <div className="mt-2 text-2xl font-semibold">2 min</div>
              <div className="mt-1 text-sm nw-muted">from account to first host</div>
            </div>
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Agent footprint</div>
              <div className="mt-2 text-2xl font-semibold">~5 MB</div>
              <div className="mt-1 text-sm nw-muted">single binary, zero YAML</div>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:pl-4">
          <DashboardMockup />
          <div className="grid gap-4 md:grid-cols-2">
            <ChartMockup />
            <AlertMockup />
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="nw-card rounded-[1.5rem] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] nw-subtle">Install in one command</p>
              <p className="mt-2 text-sm leading-7 nw-muted">Polished enough for a production team evaluating alternatives.</p>
            </div>
            <div className="rounded-full border border-[rgba(61,214,198,0.18)] bg-[rgba(61,214,198,0.08)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#bffff8]">
              Free · no card required
            </div>
          </div>
          <div className="mt-5 nw-command break-all text-sm">
            curl -sSL https://netwatch-api-production.up.railway.app/install.sh | sh -s -- --api-key YOUR_KEY
          </div>
          <p className="mt-3 text-xs nw-subtle">
            <a href="https://netwatch-api-production.up.railway.app/install.sh" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 underline underline-offset-2">
              View the install script source ↗
            </a>
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="nw-section-title text-center">Everything you need. Nothing that makes finance ask questions.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-7 nw-muted">Purpose-built for Linux infrastructure teams that want premium visibility without inheriting an enterprise observability tax.</p>
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Activity className="w-5 h-5 text-emerald-400" />}
            title="Real-Time Metrics"
            description="CPU, memory, load average, network bandwidth, connection count — collected every 15 seconds."
          />
          <FeatureCard
            icon={<Radar className="w-5 h-5 text-emerald-400" />}
            title="Health Probes"
            description="Gateway and DNS latency with packet loss detection. Know when your network degrades before users complain."
          />
          <FeatureCard
            icon={<Bell className="w-5 h-5 text-emerald-400" />}
            title="Instant Alerts"
            description="Email and Slack notifications when hosts go offline, latency spikes, or packet loss exceeds thresholds."
          />
          <FeatureCard
            icon={<BarChart3 className="w-5 h-5 text-emerald-400" />}
            title="Historical Charts"
            description="72-hour metric history with interactive charts. CPU, memory, latency, packet loss, connections, load average."
          />
          <FeatureCard
            icon={<Monitor className="w-5 h-5 text-emerald-400" />}
            title="Fleet Dashboard"
            description="All your hosts at a glance. Status, OS, CPU, memory, last seen — with automatic offline detection."
          />
          <FeatureCard
            icon={<RefreshCw className="w-5 h-5 text-emerald-400" />}
            title="Self-Updating Agent"
            description="One command to update. Downloads the latest version and restarts automatically. No manual work."
          />
        </div>
      </section>

      {/* Product screenshots */}
      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="nw-section-title text-center">Operational visibility in three clean moves</h2>
        <div className="space-y-8">
          <Step number="1" title="Sign up" description="Create an account and get your API key. Takes 10 seconds." />
          <Step number="2" title="Install the agent" description="Run one curl command on your Linux server. The agent starts collecting metrics immediately — no config needed." />
          <Step number="3" title="Monitor" description="Open the dashboard. See your hosts, metrics, and charts in real time. Set up alerts for packet loss, latency, or host offline." />
        </div>
      </section>

      {/* What we collect */}
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="nw-section-title text-center">What the agent collects</h2>
        <div className="nw-table-shell mt-8 overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left p-3 text-zinc-400 font-medium">Metric</th>
                <th className="text-left p-3 text-zinc-400 font-medium">Source</th>
                <th className="text-left p-3 text-zinc-400 font-medium">Interval</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <MetricRow metric="CPU usage (%)" source="/proc/stat" interval="15s" />
              <MetricRow metric="Memory (total, used, available)" source="/proc/meminfo" interval="15s" />
              <MetricRow metric="Load average (1m, 5m, 15m)" source="/proc/loadavg" interval="15s" />
              <MetricRow metric="Interface status & bandwidth" source="/sys/class/net/" interval="15s" />
              <MetricRow metric="Connection count" source="/proc/net/tcp" interval="15s" />
              <MetricRow metric="Gateway latency & packet loss" source="ping" interval="30s" />
              <MetricRow metric="DNS latency & packet loss" source="ping" interval="30s" />
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500 mt-3 text-center">
          No packet inspection. No connection details. No sensitive data leaves your server.
        </p>
      </section>

      {/* Why NetWatch vs alternatives */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="nw-section-title text-center">Why NetWatch?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-7 nw-muted">You have options. This is the version built for fast-moving infrastructure teams that still care about polish.</p>
        <div className="nw-table-shell mt-8 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left p-3 text-zinc-400 font-medium" />
                <th className="text-left p-3 text-emerald-400 font-semibold">NetWatch</th>
                <th className="text-left p-3 text-zinc-400 font-medium">Datadog</th>
                <th className="text-left p-3 text-zinc-400 font-medium">Uptime Kuma</th>
                <th className="text-left p-3 text-zinc-400 font-medium">PRTG</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-zinc-400">Setup time</td>
                <td className="p-3"><span className="text-emerald-400 font-medium">2 minutes</span></td>
                <td className="p-3">30+ minutes</td>
                <td className="p-3">15+ minutes</td>
                <td className="p-3">1+ hours</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-zinc-400">Agent footprint</td>
                <td className="p-3"><span className="text-emerald-400 font-medium">~5 MB single binary</span></td>
                <td className="p-3">~800 MB</td>
                <td className="p-3">No agent (external)</td>
                <td className="p-3">~200 MB</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-zinc-400">Requires root</td>
                <td className="p-3"><X className="w-4 h-4 text-emerald-400 inline" /> No</td>
                <td className="p-3"><Check className="w-4 h-4 text-zinc-500 inline" /> Yes</td>
                <td className="p-3">N/A</td>
                <td className="p-3"><Check className="w-4 h-4 text-zinc-500 inline" /> Yes</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-zinc-400">Self-hosted required</td>
                <td className="p-3"><X className="w-4 h-4 text-emerald-400 inline" /> No</td>
                <td className="p-3"><X className="w-4 h-4 text-zinc-500 inline" /> No</td>
                <td className="p-3"><Check className="w-4 h-4 text-zinc-500 inline" /> Yes</td>
                <td className="p-3"><Check className="w-4 h-4 text-zinc-500 inline" /> Yes</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="p-3 text-zinc-400">Config files</td>
                <td className="p-3"><span className="text-emerald-400 font-medium">Zero</span></td>
                <td className="p-3">YAML</td>
                <td className="p-3">Web UI</td>
                <td className="p-3">Extensive</td>
              </tr>
              <tr>
                <td className="p-3 text-zinc-400">Starting price</td>
                <td className="p-3"><span className="text-emerald-400 font-medium">Free</span></td>
                <td className="p-3">$15/host/mo+</td>
                <td className="p-3">Free (self-host)</td>
                <td className="p-3">$1,750+/yr</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500 mt-4 text-center max-w-lg mx-auto">
          Uptime Kuma is great if you want to self-host and only need external pings.
          Datadog is great if you need 500+ integrations. NetWatch is for teams that want host-level network
          monitoring that just works, with zero ops overhead.
        </p>
      </section>

      {/* Security */}
      <section id="security" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="nw-section-title text-center">Security & privacy</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-7 nw-muted">Your infrastructure data is sensitive. The product should behave like that from day one.</p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <Lock className="w-5 h-5 text-emerald-400 mb-3" />
            <h3 className="font-semibold mb-1">Encrypted in transit</h3>
            <p className="text-sm text-zinc-400">All agent→API communication uses HTTPS/TLS. API keys are bcrypt-hashed and never stored in plaintext.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <Eye className="w-5 h-5 text-emerald-400 mb-3" />
            <h3 className="font-semibold mb-1">No packet inspection</h3>
            <p className="text-sm text-zinc-400">The agent reads counters from /proc and /sys. It never captures packet contents, connection IPs, or process names.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <Shield className="w-5 h-5 text-emerald-400 mb-3" />
            <h3 className="font-semibold mb-1">No root required</h3>
            <p className="text-sm text-zinc-400">The agent runs as an unprivileged user. All 9 metric sources are readable without elevated permissions on Linux.</p>
          </div>
        </div>
        <div className="mt-6 text-center">
          <a
            href="https://netwatch-api-production.up.railway.app/install.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 hover:text-emerald-400 underline underline-offset-2 transition-colors"
          >
            Audit the install script source code ↗
          </a>
        </div>
      </section>


      {/* Built by */}
      <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
        <div className="nw-card rounded-[1.5rem] p-6">
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-lg font-bold mx-auto mb-3">M</div>
          <p className="text-zinc-300 text-sm mb-1">
            Built by <strong>Matt</strong> — a solo founder who got tired of configuring Nagios and paying $15/host/month for Datadog just to check if his servers can reach the internet.
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            NetWatch is built with Rust (agent + API) and Next.js (dashboard). The agent binary is ~5 MB and uses zero dependencies at runtime.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="mx-auto mb-5 w-fit rounded-full border border-[rgba(61,214,198,0.3)] bg-[rgba(61,214,198,0.1)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#bffff8]">
          Free while we grow
        </div>
        <h2 className="nw-section-title mb-4">Sign up, install, and monitor — all free</h2>
        <p className="mx-auto mb-6 max-w-xl text-base leading-7 nw-muted">
          NetWatch Cloud is free today. Paid tiers may arrive later for higher-volume use; existing features stay free.
        </p>
        <Link href="/register" className="nw-button-primary px-8 py-3 text-lg">
          Create a free account <ChevronRight className="w-5 h-5" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/6 px-4 py-10 text-center">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center gap-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(61,214,198,0.22)] bg-[rgba(61,214,198,0.1)] text-xs font-bold text-[var(--nw-text)]">
              NW
            </div>
            <span className="text-sm font-semibold text-[var(--nw-text-soft)]">NetWatch Labs</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs nw-subtle">
            <a
              href="https://github.com/matthart1983/netwatch"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--nw-text)] transition-colors"
            >
              netwatch ↗
            </a>
            <a
              href="https://github.com/matthart1983/essh"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--nw-text)] transition-colors"
            >
              essh ↗
            </a>
            <Link href="/labs" className="hover:text-[var(--nw-text)] transition-colors">Labs</Link>
            <a href="#features" className="hover:text-[var(--nw-text)] transition-colors">Features</a>
            <a href="mailto:admin@netwatchlabs.com" className="hover:text-[var(--nw-text)] transition-colors">Contact</a>
          </div>
          <p className="text-xs nw-subtle">
            NetWatch Cloud — fleet monitoring built with Rust + Next.js
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="nw-card-hover rounded-[1.35rem] p-5">
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm nw-muted">{description}</p>
    </div>
  )
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="nw-card rounded-[1.35rem] flex gap-4 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(61,214,198,0.14)] text-sm font-bold text-[var(--nw-accent)]">{number}</div>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm nw-muted">{description}</p>
      </div>
    </div>
  )
}

function MetricRow({ metric, source, interval }: { metric: string; source: string; interval: string }) {
  return (
    <tr className="border-b border-zinc-800/50">
      <td className="p-3">{metric}</td>
      <td className="p-3 font-mono text-xs nw-subtle">{source}</td>
      <td className="p-3 nw-subtle">{interval}</td>
    </tr>
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

export default function HostsPage() {
  const { token, isLoading: authLoading } = useAuth()
  const [hosts, setHosts] = useState<Host[]>([])
  const [hostMetrics, setHostMetrics] = useState<Record<string, HostMetrics>>({})
  const [hostPoints, setHostPoints] = useState<Record<string, MetricPoint[]>>({})
  const [loading, setLoading] = useState(true)

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

  if (authLoading) return null

  if (!token) {
    return <Landing />
  }

  if (loading) {
    return <div className="mt-10 nw-muted">Loading fleet...</div>
  }

  if (hosts.length === 0) {
    return (
      <div className="nw-empty-state mt-10 max-w-3xl">
        <span className="nw-kicker">First host onboarding</span>
        <h1 className="mt-4 text-3xl font-semibold">No hosts connected yet</h1>
        <p className="mb-4 mt-3 text-base leading-7 nw-muted">Install the NetWatch agent on a Linux server to bring the workspace to life.</p>
        <p className="text-sm nw-muted">Go to <Link href="/settings" className="font-medium text-[var(--nw-accent)] hover:text-[#a7fff4]">Settings</Link> to grab your API key and a ready-to-paste install command.</p>
      </div>
    )
  }

  const online = hosts.filter(h => h.is_online).length
  const offline = hosts.length - online
  const allMetrics = Object.values(hostMetrics)
  const avgCpu = allMetrics.filter(m => m.cpu != null).reduce((s, m) => s + (m.cpu ?? 0), 0) / (allMetrics.filter(m => m.cpu != null).length || 1)
  const avgMem = allMetrics.filter(m => m.memPct != null).reduce((s, m) => s + (m.memPct ?? 0), 0) / (allMetrics.filter(m => m.memPct != null).length || 1)
  const maxDisk = Math.max(...allMetrics.map(m => m.disk ?? 0), 0)
  const hasWarnings = allMetrics.some(m => (m.cpu ?? 0) > 80 || (m.memPct ?? 0) > 85 || (m.disk ?? 0) > 90)

  return (
    <div className="space-y-6">
      {/* Fleet Health Summary */}
      <section className="nw-card rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="nw-kicker">Live control surface</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">Fleet overview</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 nw-muted">Monitor host health, spot drift, and jump into detail before a noisy issue becomes a real outage.</p>
            <p className="mt-3 text-sm nw-subtle">{hosts.length} {hosts.length === 1 ? 'host' : 'hosts'} monitored</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" /> {online} online
            </span>
            {offline > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-200">
                <span className="h-2 w-2 rounded-full bg-red-300" /> {offline} offline
              </span>
            )}
            {hasWarnings && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                ⚠ warnings present
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Fleet Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="nw-stat-card">
          <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Avg CPU</div>
          <div className={`text-lg font-semibold tabular-nums ${metricColor(avgCpu, 80, 95)}`}>{avgCpu.toFixed(1)}%</div>
        </div>
        <div className="nw-stat-card">
          <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Avg memory</div>
          <div className={`text-lg font-semibold tabular-nums ${metricColor(avgMem, 85, 95)}`}>{avgMem.toFixed(1)}%</div>
        </div>
        <div className="nw-stat-card">
          <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Max disk</div>
          <div className={`text-lg font-semibold tabular-nums ${metricColor(maxDisk, 80, 90)}`}>{maxDisk.toFixed(1)}%</div>
        </div>
        <div className="nw-stat-card">
          <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Fleet health</div>
          <div className={`text-lg font-semibold ${offline > 0 ? 'text-red-400' : hasWarnings ? 'text-yellow-400' : 'text-emerald-400'}`}>
            {offline > 0 ? 'Degraded' : hasWarnings ? 'Warning' : 'Healthy'}
          </div>
        </div>
      </div>

      {/* Host Cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {hosts.map(host => {
          const m = hostMetrics[host.id] || { cpu: null, memPct: null, disk: null, load1m: null, latency: null, loss: null, connections: null, cpuHistory: [] }
          return (
            <Link
              key={host.id}
              href={`/hosts/${host.id}`}
              className="nw-card-hover group rounded-[1.35rem] p-4 sm:p-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${host.is_online ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="font-semibold group-hover:text-emerald-400 transition-colors">{host.hostname}</span>
                </div>
                <div className="flex items-center gap-2">
                  {m.cpuHistory.length > 1 && <MiniSparkline data={m.cpuHistory} color="#fbbf24" />}
                  <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div>
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider">CPU</div>
                  <div className={`text-sm font-medium tabular-nums ${metricColor(m.cpu, 80, 95)}`}>
                    {m.cpu != null ? `${m.cpu.toFixed(0)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider">MEM</div>
                  <div className={`text-sm font-medium tabular-nums ${metricColor(m.memPct, 85, 95)}`}>
                    {m.memPct != null ? `${m.memPct.toFixed(0)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider">DISK</div>
                  <div className={`text-sm font-medium tabular-nums ${metricColor(m.disk, 80, 90)}`}>
                    {m.disk != null ? `${m.disk.toFixed(0)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider">LOAD</div>
                  <div className={`text-sm font-medium tabular-nums ${metricColor(m.load1m, host.cpu_cores ?? 999, (host.cpu_cores ?? 999) * 2)}`}>
                    {m.load1m != null ? m.load1m.toFixed(2) : '—'}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-[11px] nw-subtle">
                <div className="flex items-center gap-3">
                  {host.os && <span>{host.os}</span>}
                  {host.cpu_cores && host.memory_total_bytes && (
                    <span>{host.cpu_cores}c · {formatBytes(host.memory_total_bytes)}</span>
                  )}
                </div>
                <span className="tabular-nums">{timeAgo(host.last_seen_at)}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Fleet Overlay Charts */}
      {hosts.length > 0 && Object.keys(hostPoints).length > 0 && (
        <FleetCharts hosts={hosts} hostPoints={hostPoints} />
      )}
    </div>
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

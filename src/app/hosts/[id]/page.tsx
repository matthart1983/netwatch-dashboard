'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import {
  getHost, getMetrics, getAgentAlerts, getProcesses, getConnections, getDnsAnalytics,
  AgentAlert, Host, MetricPoint, ProcessRow, ConnectionRow, DnsAnalytics,
} from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

import {
  ChevronDown, ChevronRight, ChevronUp, Pause, Circle,
  GripVertical, Maximize2, Minimize2, Lock, Unlock, RotateCcw,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────

type TimeRange = '1h' | '6h' | '24h' | '72h'

const RANGES: { label: string; value: TimeRange; hours: number }[] = [
  { label: '1h', value: '1h', hours: 1 },
  { label: '6h', value: '6h', hours: 6 },
  { label: '24h', value: '24h', hours: 24 },
  { label: '72h', value: '72h', hours: 72 },
]

const TOOLTIP_STYLE = { background: '#1a1a1a', border: '1px solid #333', fontSize: 12 }

type PanelId = 'latency-loss' | 'network-conn' | 'cpu-memory' | 'cpu-per-core' | 'load-swap' | 'disk-util' | 'tcp-states'

const LS_KEY = 'host-dashboard-state-v4'

interface DashState { collapsed: Record<string, boolean>; order: string[] }

function loadDashState(): DashState {
  if (typeof window === 'undefined') return { collapsed: {}, order: [] }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { collapsed: parsed.collapsed || {}, order: parsed.order || [] }
    }
  } catch {}
  return { collapsed: {}, order: [] }
}

function saveDashState(state: DashState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch {}
}

// ─── Panel Config ────────────────────────────────────────────

interface PanelConfig {
  id: PanelId
  title: string
  statKeys: { key: string; label: string }[]
  yDomain?: [number | string, number | string]
  lines: { dataKey: string; stroke: string; name: string }[]
}

const PANEL_CONFIGS: PanelConfig[] = [
  {
    id: 'latency-loss',
    title: 'Latency & Loss',
    statKeys: [{ key: 'gateway_rtt', label: 'Gateway RTT' }, { key: 'loss', label: 'Loss %' }],
    lines: [
      { dataKey: 'gateway_rtt', stroke: '#34d399', name: 'Gateway RTT (ms)' },
      { dataKey: 'dns_rtt', stroke: '#60a5fa', name: 'DNS RTT (ms)' },
      { dataKey: 'loss', stroke: '#f87171', name: 'Loss %' },
    ],
  },
  {
    id: 'network-conn',
    title: 'Network & Connections',
    statKeys: [{ key: 'net_rx_rate', label: 'RX rate (KB/s)' }, { key: 'net_tx_rate', label: 'TX rate (KB/s)' }, { key: 'connections', label: 'Connections' }],
    lines: [
      { dataKey: 'net_rx_rate', stroke: '#34d399', name: 'RX rate (KB/s)' },
      { dataKey: 'net_tx_rate', stroke: '#60a5fa', name: 'TX rate (KB/s)' },
      { dataKey: 'connections', stroke: '#a78bfa', name: 'Connections' },
    ],
  },
  {
    id: 'cpu-memory',
    title: 'CPU & Memory',
    statKeys: [{ key: 'cpu', label: 'CPU %' }, { key: 'mem_used', label: 'Mem Used (GB)' }],
    lines: [
      { dataKey: 'cpu', stroke: '#fbbf24', name: 'CPU %' },
      { dataKey: 'mem_used', stroke: '#f472b6', name: 'Used (GB)' },
      { dataKey: 'mem_avail', stroke: '#38bdf8', name: 'Available (GB)' },
    ],
  },
  {
    id: 'cpu-per-core',
    title: 'CPU per Core',
    statKeys: [],
    yDomain: [0, 100],
    lines: [],  // dynamic — generated at render time
  },
  {
    id: 'load-swap',
    title: 'Load & Swap',
    statKeys: [{ key: 'load_1m', label: 'Load 1m' }, { key: 'swap_used', label: 'Swap (MB)' }],
    lines: [
      { dataKey: 'load_1m', stroke: '#34d399', name: '1m' },
      { dataKey: 'load_5m', stroke: '#fbbf24', name: '5m' },
      { dataKey: 'load_15m', stroke: '#f87171', name: '15m' },
      { dataKey: 'swap_used', stroke: '#f97316', name: 'Swap (MB)' },
    ],
  },
  {
    id: 'disk-util',
    title: 'Disk Utilisation',
    statKeys: [{ key: 'disk_usage', label: 'Disk %' }],
    yDomain: [0, 100],
    lines: [
      { dataKey: 'disk_usage', stroke: '#f97316', name: 'Disk %' },
    ],
  },
  {
    id: 'tcp-states',
    title: 'TCP Connection States',
    statKeys: [{ key: 'time_wait', label: 'TIME_WAIT' }, { key: 'close_wait', label: 'CLOSE_WAIT' }],
    lines: [
      { dataKey: 'time_wait', stroke: '#fbbf24', name: 'TIME_WAIT' },
      { dataKey: 'close_wait', stroke: '#f87171', name: 'CLOSE_WAIT' },
    ],
  },
]

// ─── Utility Functions ───────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatUptime(secs: number): string {
  const days = Math.floor(secs / 86400)
  const hours = Math.floor((secs % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((secs % 3600) / 60)
  return `${hours}h ${mins}m`
}

function formatRate(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB/s`
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB/s`
  return `${kb.toFixed(0)} KB/s`
}

function timeAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
}

function computeStats(data: Record<string, unknown>[], key: string) {
  const vals = data.map(d => d[key]).filter((v): v is number => typeof v === 'number')
  if (vals.length === 0) return { current: null, avg: null, max: null, min: null }
  return {
    current: vals[vals.length - 1],
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    max: Math.max(...vals),
    min: Math.min(...vals),
  }
}

function formatStatVal(v: number | null): string {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return v.toFixed(0)
  if (Math.abs(v) >= 100) return v.toFixed(1)
  return v.toFixed(2)
}

type HealthStatus = 'healthy' | 'warning' | 'critical'

interface HealthResult { status: HealthStatus; issues: string[]; alertCount: number }

function evaluateHealth(latest: MetricPoint | null, cpuCores: number | null): HealthResult {
  if (!latest) return { status: 'healthy', issues: [], alertCount: 0 }
  const issues: string[] = []
  let hasCritical = false
  let hasWarning = false

  if (latest.cpu_usage_pct != null) {
    if (latest.cpu_usage_pct > 95) { hasCritical = true; issues.push(`CPU critical at ${latest.cpu_usage_pct.toFixed(1)}%`) }
    else if (latest.cpu_usage_pct > 80) { hasWarning = true; issues.push(`CPU high at ${latest.cpu_usage_pct.toFixed(1)}%`) }
  }
  if (latest.memory_used_bytes != null && latest.memory_available_bytes != null) {
    const total = latest.memory_used_bytes + latest.memory_available_bytes
    const pct = total > 0 ? (latest.memory_used_bytes / total) * 100 : 0
    if (pct > 85) { hasWarning = true; issues.push(`Memory at ${pct.toFixed(1)}%`) }
  }
  if (latest.disk_usage_pct != null && latest.disk_usage_pct > 90) { hasWarning = true; issues.push(`Disk at ${latest.disk_usage_pct.toFixed(1)}%`) }
  if (latest.load_avg_1m != null && cpuCores != null && cpuCores > 0 && latest.load_avg_1m > cpuCores) {
    hasWarning = true; issues.push(`Load ${latest.load_avg_1m.toFixed(2)} > ${cpuCores} cores`)
  }

  const status: HealthStatus = hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy'
  return { status, issues, alertCount: issues.length }
}

function getDeltaInfo(current: number | null, avg: number | null): { arrow: string; color: string } {
  if (current == null || avg == null || avg === 0) return { arrow: '—', color: 'text-zinc-500' }
  const diff = ((current - avg) / avg) * 100
  if (Math.abs(diff) < 1) return { arrow: '→', color: 'text-zinc-400' }
  if (diff > 0) return { arrow: `▲ ${diff.toFixed(0)}%`, color: 'text-red-400' }
  return { arrow: `▼ ${Math.abs(diff).toFixed(0)}%`, color: 'text-emerald-400' }
}

function getStatColor(value: number | null, warnThreshold: number, critThreshold?: number): string {
  if (value == null) return 'text-zinc-400'
  if (critThreshold != null && value > critThreshold) return 'text-red-400'
  if (value > warnThreshold) return 'text-yellow-400'
  return 'text-emerald-400'
}

// ─── Main Page Component ─────────────────────────────────────

export default function HostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [host, setHost] = useState<Host | null>(null)
  const [points, setPoints] = useState<MetricPoint[]>([])
  const [alerts, setAlerts] = useState<AgentAlert[]>([])
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [connections, setConnections] = useState<ConnectionRow[]>([])
  const [dns, setDns] = useState<DnsAnalytics | null>(null)
  const [alertsOpen, setAlertsOpen] = useState(true)
  const [processesOpen, setProcessesOpen] = useState(true)
  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const [dnsOpen, setDnsOpen] = useState(true)
  const [range, setRange] = useState<TimeRange>('24h')
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [hostInfoOpen, setHostInfoOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Panel state
  const [dashState, setDashState] = useState<DashState>(() => loadDashState())
  const collapsed = dashState.collapsed
  const [locked, setLocked] = useState(false)
  const [maximizedPanel, setMaximizedPanel] = useState<PanelId | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const dragItem = useRef<string | null>(null)

  const panelOrder = useMemo(() => {
    const defaultOrder = PANEL_CONFIGS.map(c => c.id)
    if (dashState.order.length === 0) return defaultOrder
    // Merge: use saved order but include any new panels
    const ordered = dashState.order.filter(id => defaultOrder.includes(id as typeof defaultOrder[number]))
    for (const id of defaultOrder) {
      if (!ordered.includes(id)) ordered.push(id)
    }
    return ordered
  }, [dashState.order])

  const updateDashState = useCallback((updater: (prev: DashState) => DashState) => {
    setDashState(prev => {
      const next = updater(prev)
      saveDashState(next)
      return next
    })
  }, [])

  const toggleCollapse = useCallback((panelId: string) => {
    updateDashState(prev => ({
      ...prev,
      collapsed: { ...prev.collapsed, [panelId]: !prev.collapsed[panelId] },
    }))
  }, [updateDashState])

  const toggleLock = useCallback(() => setLocked(prev => !prev), [])

  const handleDragStart = useCallback((id: string) => {
    dragItem.current = id
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (dragItem.current && dragItem.current !== id) {
      setDragOver(id)
    }
  }, [])

  const handleDrop = useCallback((id: string) => {
    const from = dragItem.current
    if (!from || from === id) { setDragOver(null); return }
    updateDashState(prev => {
      const order = [...(prev.order.length > 0 ? prev.order : PANEL_CONFIGS.map(c => c.id))]
      const fromIdx = order.indexOf(from)
      const toIdx = order.indexOf(id)
      if (fromIdx === -1 || toIdx === -1) return prev
      order.splice(fromIdx, 1)
      order.splice(toIdx, 0, from)
      return { ...prev, order }
    })
    dragItem.current = null
    setDragOver(null)
  }, [updateDashState])

  const handleDragEnd = useCallback(() => {
    dragItem.current = null
    setDragOver(null)
  }, [])

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!token || !id) return
    try {
      const hours = RANGES.find(r => r.value === range)?.hours || 24
      const from = new Date(Date.now() - hours * 3600 * 1000).toISOString()
      const [h, m, a, p, c, d] = await Promise.all([
        getHost(id),
        getMetrics(id, from),
        getAgentAlerts(id, from).catch(() => [] as AgentAlert[]),
        getProcesses(id).catch(() => ({ time: null, processes: [] })),
        getConnections(id).catch(() => ({ time: null, connections: [] })),
        getDnsAnalytics(id).catch(() => null),
      ])
      setHost(h)
      setPoints(m.points)
      setAlerts(a)
      setProcesses(p.processes)
      setConnections(c.connections)
      setDns(d)
      setLastFetch(new Date())
    } catch {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }, [token, id, range, router])

  const resetLayout = useCallback(() => {
    setLocked(false)
    updateDashState(() => ({ collapsed: {}, order: [] }))
    setLoading(true)
    void fetchData()
  }, [updateDashState, fetchData])

  useEffect(() => {
    if (authLoading) return
    if (!token) { router.push('/login'); return }
    fetchData()
  }, [authLoading, token, fetchData, router])

  useEffect(() => {
    if (paused || authLoading || !token) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      return
    }
    intervalRef.current = setInterval(fetchData, 15_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [paused, authLoading, token, fetchData])

  useEffect(() => {
    const tick = setInterval(() => setSecondsAgo(prev => prev + 1), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => { setSecondsAgo(0) }, [lastFetch])

  // Escape key to close maximized panel
  useEffect(() => {
    if (!maximizedPanel) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMaximizedPanel(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [maximizedPanel])

  // Chart data (deduplicated)
  const chartData = useMemo(() => {
    const result: Record<string, unknown>[] = []
    const seen = new Set<string>()
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i]
      const label = new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      if (seen.has(label)) continue
      seen.add(label)
      result.unshift({
        time: label,
        gateway_rtt: p.gateway_rtt_ms ?? undefined,
        dns_rtt: p.dns_rtt_ms ?? undefined,
        loss: p.gateway_loss_pct ?? undefined,
        connections: p.connection_count ?? undefined,
        cpu: p.cpu_usage_pct ?? undefined,
        mem_used: p.memory_used_bytes != null ? p.memory_used_bytes / (1024 * 1024 * 1024) : undefined,
        mem_avail: p.memory_available_bytes != null ? p.memory_available_bytes / (1024 * 1024 * 1024) : undefined,
        load_1m: p.load_avg_1m ?? undefined,
        load_5m: p.load_avg_5m ?? undefined,
        load_15m: p.load_avg_15m ?? undefined,
        swap_used: p.swap_used_bytes != null ? p.swap_used_bytes / (1024 * 1024) : undefined,
        disk_read: p.disk_read_bytes != null ? p.disk_read_bytes / (1024 * 1024) : undefined,
        disk_write: p.disk_write_bytes != null ? p.disk_write_bytes / (1024 * 1024) : undefined,
        disk_usage: p.disk_usage_pct ?? undefined,
        time_wait: p.tcp_time_wait ?? undefined,
        close_wait: p.tcp_close_wait ?? undefined,
        net_rx: p.net_rx_bytes != null ? p.net_rx_bytes / 1024 : undefined,
        net_tx: p.net_tx_bytes != null ? p.net_tx_bytes / 1024 : undefined,
        net_rx_rate: p.net_rx_rate_bps != null ? p.net_rx_rate_bps / 1024 : undefined,
        net_tx_rate: p.net_tx_rate_bps != null ? p.net_tx_rate_bps / 1024 : undefined,
        ...(p.cpu_per_core ? Object.fromEntries(p.cpu_per_core.map((v, i) => [`core_${i}`, v])) : {}),
      })
    }
    return result
  }, [points])

  const latest = points.length > 0 ? points[points.length - 1] : null
  const health = useMemo(() => evaluateHealth(latest, host?.cpu_cores ?? null), [latest, host?.cpu_cores])

  // Stats for live bar
  const cpuStats = useMemo(() => computeStats(chartData, 'cpu'), [chartData])
  const memPct = useMemo(() => {
    if (!latest?.memory_used_bytes || !latest?.memory_available_bytes) return null
    const total = latest.memory_used_bytes + latest.memory_available_bytes
    return total > 0 ? (latest.memory_used_bytes / total) * 100 : 0
  }, [latest])
  const memAvgPct = useMemo(() => {
    const vals = points.filter(p => p.memory_used_bytes != null && p.memory_available_bytes != null)
      .map(p => { const t = p.memory_used_bytes! + p.memory_available_bytes!; return t > 0 ? (p.memory_used_bytes! / t) * 100 : 0 })
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }, [points])
  const loadStats = useMemo(() => computeStats(chartData, 'load_1m'), [chartData])
  const diskStats = useMemo(() => computeStats(chartData, 'disk_usage'), [chartData])
  const rxStats = useMemo(() => computeStats(chartData, 'net_rx_rate'), [chartData])
  const txStats = useMemo(() => computeStats(chartData, 'net_tx_rate'), [chartData])
  const connStats = useMemo(() => computeStats(chartData, 'connections'), [chartData])

  if (loading || !host) {
    return <div className="mt-10 nw-muted">Loading host details...</div>
  }

  const lastSeenSecs = host.last_seen_at ? timeAgo(host.last_seen_at) + secondsAgo : null
  const statusColors: Record<HealthStatus, string> = {
    healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  return (
    <div
      className="-mt-8 pb-8"
      style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)' }}
    >
      {/* === Health Summary Header === */}
      <div className="sticky top-0 z-20 mb-4 border-b border-white/6 bg-[#08111a]/92 backdrop-blur-xl">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <button onClick={() => router.push('/')} className="nw-button-ghost px-3 py-2 text-sm">Back</button>
              <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{host.hostname}</h1>
              <button
                onClick={() => setPaused(p => !p)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  paused
                    ? 'bg-white/6 text-[var(--nw-text-muted)] border-white/10 hover:border-white/16'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                }`}
              >
                {paused ? <><Pause size={12} /> Paused</> : <><Circle size={8} fill="currentColor" className="animate-pulse" /> Live</>}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 gap-y-2 sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[health.status]}`}>
                  {health.status === 'healthy' ? 'Healthy' : health.status === 'warning' ? 'Warning' : 'Critical'}
                </span>
                {health.alertCount > 0 && (
                  <span className="rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                    {health.alertCount} {health.alertCount === 1 ? 'issue' : 'issues'}
                  </span>
                )}
                {health.issues.length > 0 && (
                  <span className="hidden max-w-xs truncate text-xs text-yellow-400 md:block">
                    {health.issues[0]}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs tabular-nums nw-subtle sm:justify-end">
                {lastSeenSecs != null && <span>Last seen {lastSeenSecs}s ago</span>}
                {lastFetch && <span>{secondsAgo}s ago</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8">

      {/* === Collapsible Host Info Panel === */}
      <div className="mb-4">
        <button
          onClick={() => setHostInfoOpen(o => !o)}
          className="flex items-center gap-2 text-sm nw-muted hover:text-[var(--nw-text)] transition-colors"
        >
          {hostInfoOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="font-medium">Host Information</span>
          {!hostInfoOpen && (
            <span className="text-xs text-zinc-600 ml-2">
              {host.os || '—'} · {host.cpu_cores || '?'} cores · {host.memory_total_bytes ? formatBytes(host.memory_total_bytes) : '—'}
            </span>
          )}
        </button>
        {hostInfoOpen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <InfoItem label="Hostname" value={host.hostname} />
            <InfoItem label="OS" value={host.os || '—'} />
            <InfoItem label="Kernel" value={host.kernel || '—'} />
            <InfoItem label="CPU Model" value={host.cpu_model ? host.cpu_model.replace(/\(R\)|\(TM\)/g, '').split('@')[0].trim() : '—'} />
            <InfoItem label="Cores" value={host.cpu_cores?.toString() || '—'} />
            <InfoItem label="Memory" value={host.memory_total_bytes ? formatBytes(host.memory_total_bytes) : '—'} />
            <InfoItem label="Uptime" value={host.uptime_secs ? formatUptime(host.uptime_secs) : '—'} />
            <InfoItem label="Agent" value={host.agent_version || '—'} />
          </div>
        )}
      </div>

      {/* === Live Stats Bar === */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <LiveStatCard label="CPU" value={cpuStats.current != null ? `${cpuStats.current.toFixed(1)}%` : '—'} delta={getDeltaInfo(cpuStats.current, cpuStats.avg)} valueColor={getStatColor(cpuStats.current, 80, 95)} />
        <LiveStatCard label="Memory" value={memPct != null ? `${memPct.toFixed(1)}%` : '—'} delta={getDeltaInfo(memPct, memAvgPct)} valueColor={getStatColor(memPct, 85)} />
        <LiveStatCard label="Load 1m" value={loadStats.current != null ? loadStats.current.toFixed(2) : '—'} delta={getDeltaInfo(loadStats.current, loadStats.avg)} valueColor={getStatColor(loadStats.current, host.cpu_cores ?? 999)} />
        <LiveStatCard label="Disk" value={diskStats.current != null ? `${diskStats.current.toFixed(1)}%` : '—'} delta={getDeltaInfo(diskStats.current, diskStats.avg)} valueColor={getStatColor(diskStats.current, 90)} />
        <LiveStatCard label="Net RX/TX" value={rxStats.current != null && txStats.current != null ? `${formatRate(rxStats.current)} / ${formatRate(txStats.current)}` : '—'} delta={getDeltaInfo(rxStats.current != null && txStats.current != null ? rxStats.current + txStats.current : null, rxStats.avg != null && txStats.avg != null ? rxStats.avg + txStats.avg : null)} valueColor="text-zinc-100" />
        <LiveStatCard label="Connections" value={connStats.current != null ? connStats.current.toFixed(0) : '—'} delta={getDeltaInfo(connStats.current, connStats.avg)} valueColor="text-zinc-100" />
      </div>

      {/* === Time Range + Dashboard Toolbar === */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => { setRange(r.value); setLoading(true) }}
              className={`nw-tab ${range === r.value ? '' : ''}`}
              data-active={range === r.value}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLock}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              locked ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' : 'bg-white/6 text-[var(--nw-text-muted)] hover:text-[var(--nw-text)] border border-white/10'
            }`}
            title={locked ? 'Unlock panels' : 'Lock panels (prevent collapse)'}
          >
            {locked ? <Lock size={12} /> : <Unlock size={12} />}
            {locked ? 'Locked' : 'Unlocked'}
          </button>
          <button
            onClick={resetLayout}
            className="flex items-center gap-1.5 rounded border border-white/10 bg-white/6 px-2.5 py-1 text-xs font-medium text-[var(--nw-text-muted)] transition-colors hover:text-[var(--nw-text)]"
            title="Reset panel layout and refresh host data"
          >
            <RotateCcw size={12} />
            Reset View
          </button>
        </div>
      </div>

      {/* === Chart Grid === */}
      {chartData.length === 0 ? (
        <p className="nw-muted">No data for this time range.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {panelOrder.map(panelId => {
            const config = PANEL_CONFIGS.find(c => c.id === panelId)
            if (!config) return null
            const isWide = config.id === 'cpu-per-core'
            // Skip rendering cpu-per-core entirely when no core data — avoids
            // a stray empty grid row between the last chart and the panels
            // below.
            if (isWide && getCoreLines(chartData).length === 0) return null
            return (
              <div
                key={config.id}
                className={`${isWide ? 'lg:col-span-2' : ''} ${dragOver === config.id ? 'ring-2 ring-emerald-500/50 rounded-lg' : ''}`}
                style={{ height: collapsed[config.id] ? 'auto' : isWide ? 360 : 280 }}
                draggable={!locked}
                onDragStart={() => handleDragStart(config.id)}
                onDragOver={(e) => handleDragOver(e, config.id)}
                onDrop={() => handleDrop(config.id)}
                onDragEnd={handleDragEnd}
              >
                <ChartPanel
                  config={config}
                  data={chartData}
                  isCollapsed={!!collapsed[config.id]}
                  isLocked={locked}
                  onToggleCollapse={() => toggleCollapse(config.id)}
                  onMaximize={() => setMaximizedPanel(config.id)}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* === Detail panels (alerts / processes / connections) === */}
      <div className="mt-3 space-y-3">
        <AgentAlertsPanel
          alerts={alerts}
          isOpen={alertsOpen}
          onToggle={() => setAlertsOpen(o => !o)}
          rangeLabel={range}
        />
        <ProcessesPanel
          processes={processes}
          isOpen={processesOpen}
          onToggle={() => setProcessesOpen(o => !o)}
        />
        <ConnectionsPanel
          connections={connections}
          isOpen={connectionsOpen}
          onToggle={() => setConnectionsOpen(o => !o)}
        />
        <DnsAnalyticsPanel
          dns={dns}
          isOpen={dnsOpen}
          onToggle={() => setDnsOpen(o => !o)}
        />
      </div>

      {/* === Maximized Panel Overlay === */}
      {maximizedPanel && (
        <MaximizedOverlay
          config={PANEL_CONFIGS.find(c => c.id === maximizedPanel)!}
          data={chartData}
          onClose={() => setMaximizedPanel(null)}
        />
      )}
      </div>
    </div>
  )
}

function AgentAlertsPanel({ alerts, isOpen, onToggle, rangeLabel }: {
  alerts: AgentAlert[]
  isOpen: boolean
  onToggle: () => void
  rangeLabel: string
}) {
  const severityStyles: Record<AgentAlert['severity'], string> = {
    warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  }
  const categoryLabels: Record<AgentAlert['category'], string> = {
    port_scan: 'Port Scan',
    beaconing: 'Beaconing',
    dns_tunnel: 'DNS Tunnel',
    bandwidth: 'Bandwidth',
  }

  return (
    <div className="nw-card rounded-[1.3rem] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 border-b border-zinc-800/50"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3 className="text-sm font-medium text-zinc-300">Agent-Detected Alerts</h3>
        {alerts.length > 0 && (
          <span className="ml-2 rounded-full border border-yellow-500/30 bg-yellow-500/15 px-2 py-0.5 text-xs font-medium text-yellow-400">
            {alerts.length}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="p-3">
          {alerts.length === 0 ? (
            <p className="nw-muted text-sm">No alerts in the last {rangeLabel}.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map(alert => (
                <li
                  key={alert.id}
                  className="flex flex-col gap-1 rounded-lg border border-white/6 bg-white/3 p-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${severityStyles[alert.severity]}`}>
                      {alert.severity}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-xs font-medium text-zinc-300">
                      {categoryLabels[alert.category]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-200">{alert.message}</div>
                    <div className="truncate text-xs nw-muted">{alert.detail}</div>
                  </div>
                  <div className="shrink-0 text-xs tabular-nums nw-subtle">
                    {new Date(alert.time).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="nw-card-soft rounded-[1rem] p-3">
      <div className="text-xs uppercase tracking-[0.16em] nw-subtle">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  )
}

function LiveStatCard({ label, value, delta, valueColor }: {
  label: string; value: string; delta: { arrow: string; color: string }; valueColor: string
}) {
  return (
    <div className="nw-stat-card">
      <div className="mb-1 text-xs uppercase tracking-[0.16em] nw-subtle">{label}</div>
      <div className={`text-lg font-semibold ${valueColor}`}>{value}</div>
      <div className={`text-xs mt-0.5 ${delta.color}`}>{delta.arrow}</div>
    </div>
  )
}

const CORE_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#fb923c', '#2dd4bf', '#e879f9', '#4ade80', '#38bdf8', '#facc15', '#f43f5e', '#818cf8', '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6']

function getCoreLines(data: Record<string, unknown>[]) {
  if (data.length === 0) return []
  // Scan all data points for core keys (first point might not have them)
  const coreKeySet = new Set<string>()
  for (const d of data) {
    for (const k of Object.keys(d)) {
      if (k.startsWith('core_')) coreKeySet.add(k)
    }
    if (coreKeySet.size > 0) break  // found cores, no need to keep scanning
  }
  const coreKeys = Array.from(coreKeySet).sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
  return coreKeys.map((key, i) => ({
    dataKey: key,
    stroke: CORE_COLORS[i % CORE_COLORS.length],
    name: `Core ${key.split('_')[1]}`,
  }))
}

function ChartPanel({ config, data, isCollapsed, isLocked, onToggleCollapse, onMaximize }: {
  config: PanelConfig
  data: Record<string, unknown>[]
  isCollapsed: boolean
  isLocked: boolean
  onToggleCollapse: () => void
  onMaximize: () => void
}) {
  const primaryStat = config.statKeys[0] ? computeStats(data, config.statKeys[0].key) : null
  const isPerCore = config.id === 'cpu-per-core'
  const lines = isPerCore ? getCoreLines(data) : config.lines

  // Hide per-core panel if no core data
  if (isPerCore && lines.length === 0) return null

  return (
    <div className="nw-card rounded-[1.3rem] h-full flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 shrink-0">
        {!isLocked && (
          <GripVertical size={14} className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing shrink-0" />
        )}
        <h3 className="text-sm font-medium text-zinc-300 truncate">{config.title}</h3>
        {primaryStat && !isCollapsed && (
          <div className="hidden sm:flex gap-2 ml-auto mr-2">
            <StatPill label="now" value={formatStatVal(primaryStat.current)} />
            <StatPill label="avg" value={formatStatVal(primaryStat.avg)} />
            <StatPill label="max" value={formatStatVal(primaryStat.max)} />
            <StatPill label="min" value={formatStatVal(primaryStat.min)} />
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button onClick={onMaximize} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title="Maximize">
            <Maximize2 size={13} />
          </button>
          <button onClick={onToggleCollapse} className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors" title={isCollapsed ? 'Expand' : 'Collapse'}>
            {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>
      {/* Chart content */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0 p-2" style={{ minHeight: 140 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={120}>
            <LineChart data={data} syncId="host-dashboard">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="time" stroke="#666" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis stroke="#666" tick={{ fontSize: 11 }} domain={config.yDomain} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {isPerCore && (
                <Line dataKey="cpu" stroke="#ffffff" dot={false} connectNulls strokeWidth={2.5} strokeDasharray="6 3" name="Total CPU %" />
              )}
              {lines.map(line => (
                <Line key={line.dataKey} dataKey={line.dataKey} stroke={line.stroke} dot={false} connectNulls strokeWidth={1} name={line.name} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function MaximizedOverlay({ config, data, onClose }: {
  config: PanelConfig; data: Record<string, unknown>[]; onClose: () => void
}) {
  const primaryStat = config.statKeys[0] ? computeStats(data, config.statKeys[0].key) : null
  const lines = config.id === 'cpu-per-core' ? getCoreLines(data) : config.lines

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#07111a]/96 backdrop-blur-xl" onClick={onClose}>
      <div className="shrink-0 border-b border-white/6 px-6 py-4 flex items-center gap-3" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-zinc-200">{config.title}</h2>
        {primaryStat && (
          <div className="flex gap-3 ml-4">
            <StatPill label="now" value={formatStatVal(primaryStat.current)} />
            <StatPill label="avg" value={formatStatVal(primaryStat.avg)} />
            <StatPill label="max" value={formatStatVal(primaryStat.max)} />
            <StatPill label="min" value={formatStatVal(primaryStat.min)} />
          </div>
        )}
        <button onClick={onClose} className="ml-auto p-2 text-zinc-400 hover:text-zinc-100 transition-colors" title="Close (Escape)">
          <Minimize2 size={18} />
        </button>
      </div>
      <div className="flex-1 p-6" onClick={e => e.stopPropagation()}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} syncId="host-dashboard">
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="time" stroke="#666" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis stroke="#666" tick={{ fontSize: 12 }} domain={config.yDomain} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {lines.map(line => (
              <Line key={line.dataKey} dataKey={line.dataKey} stroke={line.stroke} dot={false} connectNulls strokeWidth={2} name={line.name} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs nw-muted">
      <span className="nw-subtle">{label}</span> {value}
    </span>
  )
}

function formatBps(bps: number): string {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(1)} GB/s`
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} KB/s`
  return `${bps.toFixed(0)} B/s`
}

function ProcessesPanel({ processes, isOpen, onToggle }: {
  processes: ProcessRow[]
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="nw-card rounded-[1.3rem] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 border-b border-zinc-800/50"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3 className="text-sm font-medium text-zinc-300">Top Processes by Bandwidth</h3>
        <span className="ml-2 text-xs nw-subtle">{processes.length}</span>
      </button>
      {isOpen && (
        <div className="p-3">
          {processes.length === 0 ? (
            <p className="nw-muted text-sm">No process bandwidth data yet. Run the agent for a few seconds.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider nw-subtle">
                  <tr className="border-b border-white/6">
                    <th className="text-left py-2 px-2">Process</th>
                    <th className="text-right py-2 px-2">PID</th>
                    <th className="text-right py-2 px-2">Conns</th>
                    <th className="text-right py-2 px-2">RX</th>
                    <th className="text-right py-2 px-2">TX</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((p, i) => (
                    <tr key={`${p.process_name}-${p.pid ?? i}`} className="border-b border-white/6 last:border-b-0">
                      <td className="py-2 px-2 text-zinc-200 truncate max-w-xs">{p.process_name}</td>
                      <td className="py-2 px-2 text-right tabular-nums nw-muted">{p.pid ?? '—'}</td>
                      <td className="py-2 px-2 text-right tabular-nums nw-muted">{p.connection_count}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-emerald-400">{formatBps(p.rx_rate_bps)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-blue-400">{formatBps(p.tx_rate_bps)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const LATENCY_BUCKET_LABELS = ['<5', '<10', '<25', '<50', '<100', '<250', '<500', '≥500']

function DnsAnalyticsPanel({ dns, isOpen, onToggle }: {
  dns: DnsAnalytics | null
  isOpen: boolean
  onToggle: () => void
}) {
  const hasData = dns != null && dns.total_queries > 0
  const maxBucket = hasData ? Math.max(1, ...(dns!.latency_buckets)) : 1
  const nxPct = hasData && dns!.total_responses > 0
    ? ((dns!.nxdomain_count / dns!.total_responses) * 100).toFixed(1)
    : null

  return (
    <div className="nw-card rounded-[1.3rem] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 border-b border-zinc-800/50"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3 className="text-sm font-medium text-zinc-300">DNS Activity</h3>
        {hasData && (
          <span className="ml-2 text-xs nw-subtle">
            {dns!.total_queries.toLocaleString()} queries · {dns!.top_domains.length} domains
          </span>
        )}
      </button>
      {isOpen && (
        <div className="p-3">
          {!hasData ? (
            <p className="nw-muted text-sm">
              No DNS activity yet. Requires packet capture — enable it in
              config and restart the agent with elevated privileges.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Stats */}
              <div className="space-y-2">
                <DnsStat label="Queries seen"     value={dns!.total_queries.toLocaleString()} />
                <DnsStat label="Responses"        value={dns!.total_responses.toLocaleString()} />
                <DnsStat label="NXDOMAIN"         value={`${dns!.nxdomain_count.toLocaleString()}${nxPct ? ` (${nxPct}%)` : ''}`}
                         valueClass={dns!.nxdomain_count > 0 ? 'text-yellow-400' : undefined} />
              </div>

              {/* Latency histogram */}
              <div>
                <div className="text-xs uppercase tracking-wider nw-subtle mb-2">Response latency (ms)</div>
                <div className="flex items-end gap-1 h-24">
                  {dns!.latency_buckets.map((count, i) => {
                    const pct = (count / maxBucket) * 100
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div
                          className="w-full bg-blue-400/60 rounded-t transition-all"
                          style={{ height: `${Math.max(2, pct)}%` }}
                          title={`${LATENCY_BUCKET_LABELS[i]}ms: ${count}`}
                        />
                        <div className="text-[10px] tabular-nums nw-subtle">{LATENCY_BUCKET_LABELS[i]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top domains */}
              <div>
                <div className="text-xs uppercase tracking-wider nw-subtle mb-2">Top domains</div>
                {dns!.top_domains.length === 0 ? (
                  <p className="text-sm nw-muted">—</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {dns!.top_domains.slice(0, 10).map(d => (
                      <li key={d.name} className="flex justify-between gap-2">
                        <span className="truncate text-zinc-200">{d.name}</span>
                        <span className="tabular-nums nw-muted shrink-0">{d.count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DnsStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider nw-subtle">{label}</div>
      <div className={`text-lg font-semibold ${valueClass ?? 'text-zinc-200'}`}>{value}</div>
    </div>
  )
}

function ConnectionsPanel({ connections, isOpen, onToggle }: {
  connections: ConnectionRow[]
  isOpen: boolean
  onToggle: () => void
}) {
  const stateStyles: Record<string, string> = {
    ESTABLISHED: 'text-emerald-400',
    LISTEN: 'text-blue-400',
    TIME_WAIT: 'text-yellow-400',
    CLOSE_WAIT: 'text-orange-400',
  }

  return (
    <div className="nw-card rounded-[1.3rem] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 border-b border-zinc-800/50"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3 className="text-sm font-medium text-zinc-300">Active Connections</h3>
        <span className="ml-2 text-xs nw-subtle">{connections.length}</span>
      </button>
      {isOpen && (
        <div className="p-3">
          {connections.length === 0 ? (
            <p className="nw-muted text-sm">No connection data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider nw-subtle">
                  <tr className="border-b border-white/6">
                    <th className="text-left py-2 px-2">Proto</th>
                    <th className="text-left py-2 px-2">State</th>
                    <th className="text-left py-2 px-2">Process</th>
                    <th className="text-left py-2 px-2">Local</th>
                    <th className="text-left py-2 px-2">Remote</th>
                    <th className="text-right py-2 px-2" title="Kernel-measured SRTT (Linux only)">RTT</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((c, i) => (
                    <tr key={`${c.local_addr}-${c.remote_addr}-${i}`} className="border-b border-white/6 last:border-b-0">
                      <td className="py-2 px-2 tabular-nums nw-muted">{c.protocol}</td>
                      <td className={`py-2 px-2 text-xs font-medium ${stateStyles[c.state] ?? 'nw-muted'}`}>{c.state || '—'}</td>
                      <td className="py-2 px-2 text-zinc-200 truncate max-w-xs">
                        {c.process_name ?? '—'}
                        {c.pid != null && <span className="ml-1 text-xs nw-subtle">({c.pid})</span>}
                      </td>
                      <td className="py-2 px-2 tabular-nums nw-muted truncate max-w-xs">{c.local_addr}</td>
                      <td className="py-2 px-2 tabular-nums nw-muted truncate max-w-xs">{c.remote_addr}</td>
                      <td className="py-2 px-2 text-right tabular-nums nw-muted">
                        {c.kernel_rtt_us != null ? `${(c.kernel_rtt_us / 1000).toFixed(1)} ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import {
  getHost, getMetrics, getAgentAlerts, getProcesses, getConnections, getDnsAnalytics,
  AgentAlert, Host, MetricPoint, ProcessRow, ConnectionRow, DnsAnalytics,
} from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

import {
  ChevronDown, ChevronRight, ChevronUp, Pause, Circle,
  GripVertical, Maximize2, Minimize2, Lock, Unlock, RotateCcw,
  Activity, BarChart3, Cpu, Network, Globe, Bell, Info,
  Search, X as XIcon, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'

// ─── Tabs ────────────────────────────────────────────────────

type TabId = 'overview' | 'charts' | 'processes' | 'connections' | 'dns' | 'alerts' | 'info'

const TABS: { id: TabId; label: string; hotkey: string; icon: typeof Activity }[] = [
  { id: 'overview',    label: 'Overview',    hotkey: '1', icon: Activity },
  { id: 'charts',      label: 'Charts',      hotkey: '2', icon: BarChart3 },
  { id: 'processes',   label: 'Processes',   hotkey: '3', icon: Cpu },
  { id: 'connections', label: 'Connections', hotkey: '4', icon: Network },
  { id: 'dns',         label: 'DNS',         hotkey: '5', icon: Globe },
  { id: 'alerts',      label: 'Alerts',      hotkey: '6', icon: Bell },
  { id: 'info',        label: 'Info',        hotkey: '7', icon: Info },
]

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
  const searchParams = useSearchParams()
  const [host, setHost] = useState<Host | null>(null)
  const [points, setPoints] = useState<MetricPoint[]>([])
  const [alerts, setAlerts] = useState<AgentAlert[]>([])
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [connections, setConnections] = useState<ConnectionRow[]>([])
  const [dns, setDns] = useState<DnsAnalytics | null>(null)
  const [range, setRange] = useState<TimeRange>('24h')
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Tab state — URL-synced via ?tab=X. Default: overview.
  const tabFromUrl = searchParams?.get('tab') as TabId | null
  const activeTab: TabId = TABS.find(t => t.id === tabFromUrl)?.id ?? 'overview'

  // UI polish: help overlay (? to open), density toggle (persisted).
  const [helpOpen, setHelpOpen] = useState(false)
  const [dense, setDense] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('nw-density') === 'dense'
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('nw-density', dense ? 'dense' : 'normal')
  }, [dense])
  const setActiveTab = useCallback((next: TabId) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (next === 'overview') params.delete('tab')
    else params.set('tab', next)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }, [router, searchParams])

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

  // Global hotkeys: 1–7 switch tabs, p pauses, r cycles time range. Ignored
  // when the user is typing in an input/textarea/contenteditable.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Tab hotkeys
      const tab = TABS.find(t => t.hotkey === e.key)
      if (tab) {
        e.preventDefault()
        setActiveTab(tab.id)
        return
      }
      if (e.key === 'p') {
        e.preventDefault()
        setPaused(p => !p)
      } else if (e.key === 'r') {
        e.preventDefault()
        const idx = RANGES.findIndex(r => r.value === range)
        const next = RANGES[(idx + 1) % RANGES.length]
        setRange(next.value)
        setLoading(true)
      } else if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(o => !o)
      } else if (e.key === 'Escape' && helpOpen) {
        e.preventDefault()
        setHelpOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveTab, range, helpOpen])

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

  const noop = () => {}

  return (
    <div
      data-density={dense ? 'dense' : 'normal'}
      className="-mt-8 pb-8"
      style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)' }}
    >
      <style>{`
        [data-density='dense'] table td,
        [data-density='dense'] table th { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        [data-density='dense'] .nw-card li { padding-top: 0.4rem; padding-bottom: 0.4rem; }
      `}</style>
      {/* === Shell: compact header + tab strip === */}
      <div className="sticky top-0 z-20 border-b border-white/6 bg-[#08111a]/92 backdrop-blur-xl">
        <div className="px-4 pt-3 sm:px-6 lg:px-8">
          {/* Row 1 — identity, health, age, live toggle */}
          <div className="flex min-w-0 flex-wrap items-center gap-3 pb-2">
            <button onClick={() => router.push('/')} className="nw-button-ghost px-3 py-1.5 text-sm">Back</button>
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{host.hostname}</h1>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[health.status]}`}>
              {health.status === 'healthy' ? 'Healthy' : health.status === 'warning' ? 'Warning' : 'Critical'}
            </span>
            {alerts.length > 0 && (
              <button
                onClick={() => setActiveTab('alerts')}
                className="rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                title="Jump to Alerts tab"
              >
                {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
              </button>
            )}
            <div className="flex items-center gap-3 text-xs tabular-nums nw-subtle">
              {lastSeenSecs != null && <span>Last seen {lastSeenSecs}s ago</span>}
              {lastFetch && <span>{secondsAgo}s</span>}
            </div>
            <button
              onClick={() => setPaused(p => !p)}
              title="Toggle live polling (p)"
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                paused
                  ? 'bg-white/6 text-[var(--nw-text-muted)] border-white/10 hover:border-white/16'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
            >
              {paused ? <><Pause size={12} /> Paused</> : <><Circle size={8} fill="currentColor" className="animate-pulse" /> Live</>}
            </button>
            <button
              onClick={() => setDense(d => !d)}
              title={dense ? 'Normal density' : 'Dense mode'}
              className={`rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
                dense
                  ? 'bg-[rgba(61,214,198,0.15)] border-[rgba(61,214,198,0.35)] text-[var(--nw-text)]'
                  : 'bg-white/6 border-white/10 text-[var(--nw-text-muted)] hover:text-[var(--nw-text)]'
              }`}
            >
              {dense ? '≡' : '≣'}
            </button>
            <button
              onClick={() => setHelpOpen(true)}
              title="Keyboard shortcuts (?)"
              className="rounded-full border border-white/10 bg-white/6 px-2 py-1 text-xs font-medium text-[var(--nw-text-muted)] hover:text-[var(--nw-text)] transition-colors"
            >
              ?
            </button>
          </div>

          {/* Row 2 — tab strip + time range */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 overflow-x-auto">
              {TABS.map(t => {
                const Icon = t.icon
                const isActive = activeTab === t.id
                const count = t.id === 'alerts' ? alerts.length : undefined
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    title={`${t.label} — press ${t.hotkey}`}
                    className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-[var(--nw-accent)] text-[var(--nw-text)]'
                        : 'border-transparent text-[var(--nw-text-muted)] hover:text-[var(--nw-text)]'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{t.label}</span>
                    {count != null && count > 0 && (
                      <span className="rounded-full bg-red-500/20 text-red-400 px-1.5 py-0.5 text-[10px] font-semibold">
                        {count}
                      </span>
                    )}
                    <span className="hidden sm:inline text-[10px] nw-subtle tabular-nums">{t.hotkey}</span>
                  </button>
                )
              })}
            </div>
            {/* Time range — hidden on tabs where it's irrelevant */}
            {(activeTab === 'overview' || activeTab === 'charts' || activeTab === 'alerts') && (
              <div className="flex items-center gap-2 pb-1">
                <span className="text-[10px] uppercase tracking-wider nw-subtle">Range</span>
                <div className="flex gap-1">
                  {RANGES.map(r => (
                    <button
                      key={r.value}
                      onClick={() => { setRange(r.value); setLoading(true) }}
                      className={`nw-tab text-xs px-2 py-1`}
                      data-active={range === r.value}
                      title="Cycle with r"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 sm:px-6 lg:px-8">
        {/* ═══ Overview tab ═══ */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Live stat tiles — 6 across, tighter padding */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <LiveStatCard label="CPU" value={cpuStats.current != null ? `${cpuStats.current.toFixed(1)}%` : '—'} delta={getDeltaInfo(cpuStats.current, cpuStats.avg)} valueColor={getStatColor(cpuStats.current, 80, 95)} />
              <LiveStatCard label="Memory" value={memPct != null ? `${memPct.toFixed(1)}%` : '—'} delta={getDeltaInfo(memPct, memAvgPct)} valueColor={getStatColor(memPct, 85)} />
              <LiveStatCard label="Load 1m" value={loadStats.current != null ? loadStats.current.toFixed(2) : '—'} delta={getDeltaInfo(loadStats.current, loadStats.avg)} valueColor={getStatColor(loadStats.current, host.cpu_cores ?? 999)} />
              <LiveStatCard label="Disk" value={diskStats.current != null ? `${diskStats.current.toFixed(1)}%` : '—'} delta={getDeltaInfo(diskStats.current, diskStats.avg)} valueColor={getStatColor(diskStats.current, 90)} />
              <LiveStatCard label="Net RX/TX" value={rxStats.current != null && txStats.current != null ? `${formatRate(rxStats.current)} / ${formatRate(txStats.current)}` : '—'} delta={getDeltaInfo(rxStats.current != null && txStats.current != null ? rxStats.current + txStats.current : null, rxStats.avg != null && txStats.avg != null ? rxStats.avg + txStats.avg : null)} valueColor="text-zinc-100" />
              <LiveStatCard label="Connections" value={connStats.current != null ? connStats.current.toFixed(0) : '—'} delta={getDeltaInfo(connStats.current, connStats.avg)} valueColor="text-zinc-100" />
            </div>

            {/* Sparklines — three concerns at a glance */}
            {chartData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <OverviewSparkline title="Gateway RTT (ms)" data={chartData} dataKey="gateway_rtt" stroke="#34d399" />
                <OverviewSparkline title="CPU %" data={chartData} dataKey="cpu" stroke="#fbbf24" />
                <OverviewSparkline title="Network RX+TX (KB/s)" data={chartData} dataKey="net_rx_rate" stroke="#60a5fa" stroke2="#a78bfa" dataKey2="net_tx_rate" />
              </div>
            )}

            {/* Health line — GW + DNS on one row, TUI-style */}
            {latest && (latest.gateway_rtt_ms != null || latest.dns_rtt_ms != null) && (
              <div className="nw-card rounded-[1rem] px-3 py-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
                <span className="text-xs uppercase tracking-wider nw-subtle">Health</span>
                {latest.gateway_rtt_ms != null && (
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs nw-subtle">GW</span>
                    <span className={`tabular-nums font-medium ${getStatColor(latest.gateway_rtt_ms, 100, 250)}`}>{latest.gateway_rtt_ms.toFixed(1)}ms</span>
                    {latest.gateway_loss_pct != null && (
                      <span className={`text-xs tabular-nums ${latest.gateway_loss_pct > 5 ? 'text-red-400' : 'nw-muted'}`}>
                        {latest.gateway_loss_pct.toFixed(0)}% loss
                      </span>
                    )}
                  </span>
                )}
                {latest.dns_rtt_ms != null && (
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs nw-subtle">DNS</span>
                    <span className={`tabular-nums font-medium ${getStatColor(latest.dns_rtt_ms, 50, 200)}`}>{latest.dns_rtt_ms.toFixed(1)}ms</span>
                    {latest.dns_loss_pct != null && (
                      <span className={`text-xs tabular-nums ${latest.dns_loss_pct > 5 ? 'text-red-400' : 'nw-muted'}`}>
                        {latest.dns_loss_pct.toFixed(0)}% loss
                      </span>
                    )}
                  </span>
                )}
                {latest.tcp_time_wait != null && (
                  <span className="text-xs nw-muted tabular-nums">TIME_WAIT {latest.tcp_time_wait}</span>
                )}
                {latest.tcp_close_wait != null && (
                  <span className="text-xs nw-muted tabular-nums">CLOSE_WAIT {latest.tcp_close_wait}</span>
                )}
              </div>
            )}

            {/* Top processes + Top connections side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <OverviewTopProcesses processes={processes} onExpand={() => setActiveTab('processes')} />
              <OverviewTopConnections connections={connections} onExpand={() => setActiveTab('connections')} />
            </div>

            {/* DNS summary + Recent alerts side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <OverviewDnsSummary dns={dns} onExpand={() => setActiveTab('dns')} />
              <OverviewRecentAlerts alerts={alerts} issues={health.issues} rangeLabel={range} onExpand={() => setActiveTab('alerts')} />
            </div>
          </div>
        )}

        {/* ═══ Charts tab ═══ */}
        {activeTab === 'charts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={toggleLock}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  locked ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' : 'bg-white/6 text-[var(--nw-text-muted)] hover:text-[var(--nw-text)] border border-white/10'
                }`}
                title={locked ? 'Unlock panels' : 'Lock panels'}
              >
                {locked ? <Lock size={12} /> : <Unlock size={12} />}
                {locked ? 'Locked' : 'Unlocked'}
              </button>
              <button
                onClick={resetLayout}
                className="flex items-center gap-1.5 rounded border border-white/10 bg-white/6 px-2.5 py-1 text-xs font-medium text-[var(--nw-text-muted)] transition-colors hover:text-[var(--nw-text)]"
                title="Reset layout and refresh"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
            {chartData.length === 0 ? (
              <p className="nw-muted">No data for this time range.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {panelOrder.map(panelId => {
                  const config = PANEL_CONFIGS.find(c => c.id === panelId)
                  if (!config) return null
                  const isWide = config.id === 'cpu-per-core'
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
          </div>
        )}

        {activeTab === 'processes' && (
          <ProcessesPanel processes={processes} isOpen={true} onToggle={noop} />
        )}
        {activeTab === 'connections' && (
          <ConnectionsPanel connections={connections} isOpen={true} onToggle={noop} />
        )}
        {activeTab === 'dns' && (
          <DnsAnalyticsPanel dns={dns} isOpen={true} onToggle={noop} />
        )}
        {activeTab === 'alerts' && (
          <AgentAlertsPanel alerts={alerts} isOpen={true} onToggle={noop} rangeLabel={range} />
        )}

        {/* ═══ Info tab ═══ */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoItem label="Hostname" value={host.hostname} />
              <InfoItem label="OS" value={host.os || '—'} />
              <InfoItem label="Kernel" value={host.kernel || '—'} />
              <InfoItem label="CPU Model" value={host.cpu_model ? host.cpu_model.replace(/\(R\)|\(TM\)/g, '').split('@')[0].trim() : '—'} />
              <InfoItem label="Cores" value={host.cpu_cores?.toString() || '—'} />
              <InfoItem label="Memory" value={host.memory_total_bytes ? formatBytes(host.memory_total_bytes) : '—'} />
              <InfoItem label="Uptime" value={host.uptime_secs ? formatUptime(host.uptime_secs) : '—'} />
              <InfoItem label="Agent" value={host.agent_version || '—'} />
              <InfoItem label="Host ID" value={host.id} />
              <InfoItem label="Last seen" value={lastSeenSecs != null ? `${lastSeenSecs}s ago` : '—'} />
              <InfoItem label="Online" value={host.is_online ? 'Yes' : 'No'} />
            </div>
          </div>
        )}
      </div>

      {/* === Maximized Panel Overlay (from Charts tab) === */}
      {maximizedPanel && (
        <MaximizedOverlay
          config={PANEL_CONFIGS.find(c => c.id === maximizedPanel)!}
          data={chartData}
          onClose={() => setMaximizedPanel(null)}
        />
      )}

      {/* === Keyboard help overlay === */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#07111a]/80 backdrop-blur-sm"
          onClick={() => setHelpOpen(false)}
        >
          <div className="nw-card rounded-[1.5rem] max-w-md w-[90vw] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
              <button onClick={() => setHelpOpen(false)} className="nw-muted hover:text-zinc-200 text-lg" title="Close (Esc)">×</button>
            </div>
            <dl className="text-sm space-y-2">
              {TABS.map(t => (
                <div key={t.id} className="flex justify-between">
                  <dt className="nw-muted">{t.label}</dt>
                  <dd><kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-xs font-mono">{t.hotkey}</kbd></dd>
                </div>
              ))}
              <hr className="border-white/6 my-2" />
              <div className="flex justify-between"><dt className="nw-muted">Pause / resume live polling</dt><dd><kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-xs font-mono">p</kbd></dd></div>
              <div className="flex justify-between"><dt className="nw-muted">Cycle time range</dt><dd><kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-xs font-mono">r</kbd></dd></div>
              <div className="flex justify-between"><dt className="nw-muted">Dismiss overlay / maximized chart</dt><dd><kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-xs font-mono">Esc</kbd></dd></div>
              <div className="flex justify-between"><dt className="nw-muted">Toggle this help</dt><dd><kbd className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-xs font-mono">?</kbd></dd></div>
            </dl>
            <p className="mt-4 text-xs nw-subtle">
              Shortcuts are suppressed while typing in inputs. Density toggle lives next to the Pause button in the header.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentAlertsPanel({ alerts, rangeLabel }: {
  alerts: AgentAlert[]
  rangeLabel: string
  isOpen?: boolean
  onToggle?: () => void
}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const q = searchParams?.get('a_q') ?? ''
  const sev = searchParams?.get('a_sev') ?? '' // '' | 'warning' | 'critical'
  const cat = searchParams?.get('a_cat') ?? '' // '' | 'bandwidth' | 'port_scan' | 'beaconing' | 'dns_tunnel'

  const setP = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    const prefixed = `a_${key}`
    if (value == null || value === '') params.delete(prefixed)
    else params.set(prefixed, value)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }, [router, searchParams])

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

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { bandwidth: 0, port_scan: 0, beaconing: 0, dns_tunnel: 0 }
    for (const a of alerts) counts[a.category] = (counts[a.category] ?? 0) + 1
    return counts
  }, [alerts])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return alerts.filter(a => {
      if (sev && a.severity !== sev) return false
      if (cat && a.category !== cat) return false
      if (needle) {
        const hay = `${a.message} ${a.detail} ${a.category} ${a.severity}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [alerts, q, sev, cat])

  return (
    <div className="nw-card rounded-[1.3rem] overflow-hidden">
      <div className="border-b border-zinc-800/50 px-3 py-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 nw-subtle" />
            <input
              type="text"
              value={q}
              onChange={e => setP('q', e.target.value)}
              placeholder="Search alerts..."
              className="w-full bg-white/4 border border-white/10 rounded-md pl-7 pr-7 py-1.5 text-sm text-zinc-200 placeholder:nw-subtle focus:outline-none focus:border-[var(--nw-accent)]"
            />
            {q && (
              <button onClick={() => setP('q', null)} className="absolute right-2 top-1/2 -translate-y-1/2 nw-subtle hover:text-zinc-200">
                <XIcon size={14} />
              </button>
            )}
          </div>
          <span className="text-xs nw-subtle tabular-nums">
            {filtered.length === alerts.length
              ? `${alerts.length} alerts`
              : `${filtered.length} of ${alerts.length}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip label="All severities" active={!sev} onClick={() => setP('sev', null)} />
          <FilterChip label="Warning" active={sev === 'warning'} onClick={() => setP('sev', 'warning')} />
          <FilterChip label="Critical" active={sev === 'critical'} onClick={() => setP('sev', 'critical')} />
          <span className="mx-1 h-4 w-px bg-white/10" />
          <FilterChip label="All categories" active={!cat} onClick={() => setP('cat', null)} />
          <FilterChip label={`Bandwidth (${categoryCounts.bandwidth})`} active={cat === 'bandwidth'} onClick={() => setP('cat', 'bandwidth')} />
          <FilterChip label={`Port Scan (${categoryCounts.port_scan})`} active={cat === 'port_scan'} onClick={() => setP('cat', 'port_scan')} />
          <FilterChip label={`Beaconing (${categoryCounts.beaconing})`} active={cat === 'beaconing'} onClick={() => setP('cat', 'beaconing')} />
          <FilterChip label={`DNS Tunnel (${categoryCounts.dns_tunnel})`} active={cat === 'dns_tunnel'} onClick={() => setP('cat', 'dns_tunnel')} />
        </div>
      </div>

      {alerts.length === 0 ? (
        <p className="nw-muted text-sm p-3">No alerts in the last {rangeLabel}.</p>
      ) : filtered.length === 0 ? (
        <p className="nw-muted text-sm p-3">No alerts match current filters.</p>
      ) : (
        <ul className="p-3 space-y-2 overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          {filtered.map(alert => (
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

function OverviewTopProcesses({ processes, onExpand }: {
  processes: ProcessRow[]
  onExpand: () => void
}) {
  const top = [...processes].sort((a, b) => (b.rx_rate_bps + b.tx_rate_bps) - (a.rx_rate_bps + a.tx_rate_bps)).slice(0, 6)
  return (
    <div className="nw-card rounded-[1rem] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/6">
        <span className="text-xs uppercase tracking-wider nw-subtle">Top processes</span>
        <button onClick={onExpand} className="text-xs nw-muted hover:text-zinc-200">all →</button>
      </div>
      {top.length === 0 ? (
        <p className="nw-muted text-xs px-3 py-2">No process bandwidth data yet.</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {top.map((p, i) => (
              <tr key={`${p.process_name}-${p.pid ?? i}`} className="border-b border-white/5 last:border-b-0">
                <td className="px-3 py-1 text-zinc-200 truncate max-w-[200px]">{p.process_name}</td>
                <td className="px-2 py-1 text-right tabular-nums nw-muted w-12">{p.connection_count}c</td>
                <td className="px-2 py-1 text-right tabular-nums text-emerald-400 w-20">↓{formatBps(p.rx_rate_bps)}</td>
                <td className="px-3 py-1 text-right tabular-nums text-blue-400 w-20">↑{formatBps(p.tx_rate_bps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function OverviewTopConnections({ connections, onExpand }: {
  connections: ConnectionRow[]
  onExpand: () => void
}) {
  const top = connections
    .filter(c => c.state === 'ESTABLISHED')
    .slice(0, 8)
  return (
    <div className="nw-card rounded-[1rem] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/6">
        <span className="text-xs uppercase tracking-wider nw-subtle">Established connections</span>
        <button onClick={onExpand} className="text-xs nw-muted hover:text-zinc-200">all →</button>
      </div>
      {top.length === 0 ? (
        <p className="nw-muted text-xs px-3 py-2">No connection data yet.</p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {top.map((c, i) => (
              <tr key={`${c.local_addr}-${c.remote_addr}-${i}`} className="border-b border-white/5 last:border-b-0">
                <td className="px-3 py-1 nw-muted w-10">{c.protocol}</td>
                <td className="px-2 py-1 text-zinc-200 truncate max-w-[120px]">{c.process_name ?? '—'}</td>
                <td className="px-2 py-1 tabular-nums nw-muted truncate max-w-[180px]">{c.remote_addr}</td>
                <td className="px-3 py-1 text-right tabular-nums nw-muted w-16">
                  {c.kernel_rtt_us != null ? `${(c.kernel_rtt_us / 1000).toFixed(1)}ms` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function OverviewDnsSummary({ dns, onExpand }: {
  dns: DnsAnalytics | null
  onExpand: () => void
}) {
  const hasData = dns != null && dns.total_queries > 0
  const nxPct = hasData && dns!.total_responses > 0
    ? ((dns!.nxdomain_count / dns!.total_responses) * 100)
    : null
  return (
    <div className="nw-card rounded-[1rem] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/6">
        <span className="text-xs uppercase tracking-wider nw-subtle">DNS</span>
        <button onClick={onExpand} className="text-xs nw-muted hover:text-zinc-200">detail →</button>
      </div>
      {!hasData ? (
        <p className="nw-muted text-xs px-3 py-2">No DNS activity (requires packet capture).</p>
      ) : (
        <div className="px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="flex items-baseline gap-1"><span className="font-semibold tabular-nums">{dns!.total_queries.toLocaleString()}</span> <span className="text-xs nw-subtle">queries</span></span>
            {nxPct != null && (
              <span className="flex items-baseline gap-1">
                <span className={`font-semibold tabular-nums ${dns!.nxdomain_count > 0 ? 'text-yellow-400' : 'text-zinc-200'}`}>{nxPct.toFixed(1)}%</span>
                <span className="text-xs nw-subtle">NXDOMAIN</span>
              </span>
            )}
          </div>
          {dns!.top_domains.length > 0 && (
            <div className="mt-1.5 space-y-0.5 text-xs">
              {dns!.top_domains.slice(0, 5).map(d => (
                <div key={d.name} className="flex justify-between gap-2">
                  <span className="truncate text-zinc-200">{d.name}</span>
                  <span className="tabular-nums nw-muted">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OverviewRecentAlerts({ alerts, issues, rangeLabel, onExpand }: {
  alerts: AgentAlert[]
  issues: string[]
  rangeLabel: string
  onExpand: () => void
}) {
  const top = alerts.slice(0, 4)
  const severityStyles: Record<AgentAlert['severity'], string> = {
    warning: 'text-yellow-400',
    critical: 'text-red-400',
  }
  return (
    <div className="nw-card rounded-[1rem] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/6">
        <span className="text-xs uppercase tracking-wider nw-subtle">Recent alerts + concerns</span>
        <button onClick={onExpand} className="text-xs nw-muted hover:text-zinc-200">all →</button>
      </div>
      {top.length === 0 && issues.length === 0 ? (
        <p className="nw-muted text-xs px-3 py-2">All clear in the last {rangeLabel}.</p>
      ) : (
        <ul className="text-xs">
          {top.map(a => (
            <li key={a.id} className="flex items-baseline gap-2 px-3 py-1 border-b border-white/5 last:border-b-0">
              <span className={`font-semibold w-12 shrink-0 ${severityStyles[a.severity]}`}>{a.severity}</span>
              <span className="truncate text-zinc-200">{a.message}</span>
            </li>
          ))}
          {issues.slice(0, 4 - top.length).map((issue, i) => (
            <li key={`issue-${i}`} className="flex items-baseline gap-2 px-3 py-1 border-b border-white/5 last:border-b-0">
              <span className="text-yellow-400 w-12 shrink-0">concern</span>
              <span className="truncate text-zinc-200">{issue}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function OverviewSparkline({ title, data, dataKey, stroke, dataKey2, stroke2 }: {
  title: string
  data: Record<string, unknown>[]
  dataKey: string
  stroke: string
  dataKey2?: string
  stroke2?: string
}) {
  return (
    <div className="nw-card rounded-[1.3rem] p-3 h-28">
      <div className="text-xs uppercase tracking-wider nw-subtle mb-1">{title}</div>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={data}>
          <Line dataKey={dataKey} stroke={stroke} dot={false} connectNulls strokeWidth={1.5} />
          {dataKey2 && <Line dataKey={dataKey2} stroke={stroke2} dot={false} connectNulls strokeWidth={1.5} />}
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </LineChart>
      </ResponsiveContainer>
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

type ProcSortKey = 'process' | 'conns' | 'rx' | 'tx' | 'total' | null

function ProcessesPanel({ processes }: {
  processes: ProcessRow[]
  isOpen?: boolean
  onToggle?: () => void
}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const q = searchParams?.get('p_q') ?? ''
  const sortRaw = searchParams?.get('p_sort') ?? '-total'
  const sortDesc = sortRaw.startsWith('-')
  const sortKey = (sortDesc ? sortRaw.slice(1) : sortRaw) as ProcSortKey

  const setP = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    const prefixed = `p_${key}`
    if (value == null || value === '') params.delete(prefixed)
    else params.set(prefixed, value)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }, [router, searchParams])

  const toggleSort = useCallback((key: Exclude<ProcSortKey, null>) => {
    if (sortKey !== key) setP('sort', `-${key}`)
    else if (sortDesc) setP('sort', key)
    else setP('sort', `-${key}`)
  }, [sortKey, sortDesc, setP])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = needle
      ? processes.filter(p => p.process_name.toLowerCase().includes(needle))
      : processes
    if (sortKey) {
      const cmp = (a: ProcessRow, b: ProcessRow) => {
        switch (sortKey) {
          case 'process': return a.process_name.localeCompare(b.process_name)
          case 'conns':   return a.connection_count - b.connection_count
          case 'rx':      return a.rx_rate_bps - b.rx_rate_bps
          case 'tx':      return a.tx_rate_bps - b.tx_rate_bps
          case 'total':   return (a.rx_rate_bps + a.tx_rate_bps) - (b.rx_rate_bps + b.tx_rate_bps)
          default: return 0
        }
      }
      out = [...out].sort((a, b) => sortDesc ? -cmp(a, b) : cmp(a, b))
    }
    return out
  }, [processes, q, sortKey, sortDesc])

  return (
    <div className="nw-card rounded-[1.3rem] overflow-hidden">
      <div className="border-b border-zinc-800/50 px-3 py-2 flex items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 nw-subtle" />
          <input
            type="text"
            value={q}
            onChange={e => setP('q', e.target.value)}
            placeholder="Filter process name..."
            className="w-full bg-white/4 border border-white/10 rounded-md pl-7 pr-7 py-1.5 text-sm text-zinc-200 placeholder:nw-subtle focus:outline-none focus:border-[var(--nw-accent)]"
          />
          {q && (
            <button onClick={() => setP('q', null)} className="absolute right-2 top-1/2 -translate-y-1/2 nw-subtle hover:text-zinc-200">
              <XIcon size={14} />
            </button>
          )}
        </div>
        <span className="text-xs nw-subtle tabular-nums">
          {filtered.length === processes.length
            ? `${processes.length} processes`
            : `${filtered.length} of ${processes.length}`}
        </span>
      </div>

      {processes.length === 0 ? (
        <p className="nw-muted text-sm p-3">No process bandwidth data yet. Run the agent for a few seconds.</p>
      ) : filtered.length === 0 ? (
        <p className="nw-muted text-sm p-3">No processes match &ldquo;{q}&rdquo;.</p>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider nw-subtle sticky top-0 bg-[#0c1824] z-10">
              <tr className="border-b border-white/6">
                <SortHeader label="Process" active={sortKey === 'process'} desc={sortDesc} onClick={() => toggleSort('process')} />
                <th className="text-right py-2 px-2">PID</th>
                <SortHeader label="Conns" align="right" active={sortKey === 'conns'} desc={sortDesc} onClick={() => toggleSort('conns')} />
                <SortHeader label="RX" align="right" active={sortKey === 'rx'} desc={sortDesc} onClick={() => toggleSort('rx')} />
                <SortHeader label="TX" align="right" active={sortKey === 'tx'} desc={sortDesc} onClick={() => toggleSort('tx')} />
                <SortHeader label="Total" align="right" active={sortKey === 'total'} desc={sortDesc} onClick={() => toggleSort('total')} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={`${p.process_name}-${p.pid ?? i}`} className="border-b border-white/6 last:border-b-0 hover:bg-white/3">
                  <td className="py-2 px-2 text-zinc-200 truncate max-w-xs">{p.process_name}</td>
                  <td className="py-2 px-2 text-right tabular-nums nw-muted">{p.pid ?? '—'}</td>
                  <td className="py-2 px-2 text-right tabular-nums nw-muted">{p.connection_count}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-emerald-400">{formatBps(p.rx_rate_bps)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-blue-400">{formatBps(p.tx_rate_bps)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-zinc-200">{formatBps(p.rx_rate_bps + p.tx_rate_bps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

type ConnSortKey = 'state' | 'process' | 'remote' | 'rtt' | null

function ConnectionsPanel({ connections }: {
  connections: ConnectionRow[]
  // Legacy props from earlier collapsible-panel usage; not used here.
  isOpen?: boolean
  onToggle?: () => void
}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const q = searchParams?.get('c_q') ?? ''
  const proto = searchParams?.get('c_proto') ?? '' // '' | 'TCP' | 'UDP'
  const state = searchParams?.get('c_state') ?? '' // '' | 'ESTABLISHED' | 'TIME_WAIT' | 'LISTEN' | 'OTHER'
  const sortRaw = searchParams?.get('c_sort') ?? ''
  const sortDesc = sortRaw.startsWith('-')
  const sortKey = (sortDesc ? sortRaw.slice(1) : sortRaw) as ConnSortKey

  const setP = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    const prefixed = `c_${key}`
    if (value == null || value === '') params.delete(prefixed)
    else params.set(prefixed, value)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }, [router, searchParams])

  const toggleSort = useCallback((key: Exclude<ConnSortKey, null>) => {
    if (sortKey !== key) setP('sort', key)
    else if (!sortDesc) setP('sort', `-${key}`)
    else setP('sort', null)
  }, [sortKey, sortDesc, setP])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = connections.filter(c => {
      if (proto && c.protocol.toUpperCase() !== proto) return false
      if (state === 'OTHER') {
        if (['ESTABLISHED', 'TIME_WAIT', 'LISTEN', 'CLOSE_WAIT'].includes(c.state)) return false
      } else if (state && c.state !== state) return false
      if (needle) {
        const hay = `${c.process_name ?? ''} ${c.local_addr} ${c.remote_addr} ${c.state} ${c.protocol}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    if (sortKey) {
      const cmp = (a: ConnectionRow, b: ConnectionRow) => {
        switch (sortKey) {
          case 'state':   return (a.state || '').localeCompare(b.state || '')
          case 'process': return (a.process_name || '').localeCompare(b.process_name || '')
          case 'remote':  return a.remote_addr.localeCompare(b.remote_addr)
          case 'rtt': {
            const av = a.kernel_rtt_us ?? Infinity
            const bv = b.kernel_rtt_us ?? Infinity
            return av - bv
          }
          default: return 0
        }
      }
      out = [...out].sort((a, b) => sortDesc ? -cmp(a, b) : cmp(a, b))
    }
    return out
  }, [connections, q, proto, state, sortKey, sortDesc])

  const stateStyles: Record<string, string> = {
    ESTABLISHED: 'text-emerald-400',
    LISTEN: 'text-blue-400',
    TIME_WAIT: 'text-yellow-400',
    CLOSE_WAIT: 'text-orange-400',
  }

  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = { ESTABLISHED: 0, TIME_WAIT: 0, LISTEN: 0, CLOSE_WAIT: 0, OTHER: 0 }
    for (const c of connections) {
      if (c.state in counts) counts[c.state] += 1
      else counts.OTHER += 1
    }
    return counts
  }, [connections])

  return (
    <div className="nw-card rounded-[1.3rem] overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-zinc-800/50 px-3 py-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 nw-subtle" />
            <input
              type="text"
              value={q}
              onChange={e => setP('q', e.target.value)}
              placeholder="Search process, address, state..."
              className="w-full bg-white/4 border border-white/10 rounded-md pl-7 pr-7 py-1.5 text-sm text-zinc-200 placeholder:nw-subtle focus:outline-none focus:border-[var(--nw-accent)]"
            />
            {q && (
              <button onClick={() => setP('q', null)} className="absolute right-2 top-1/2 -translate-y-1/2 nw-subtle hover:text-zinc-200">
                <XIcon size={14} />
              </button>
            )}
          </div>
          <span className="text-xs nw-subtle tabular-nums">
            {filtered.length === connections.length
              ? `${connections.length} connections`
              : `${filtered.length} of ${connections.length}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip label="All proto" active={!proto} onClick={() => setP('proto', null)} />
          <FilterChip label="TCP" active={proto === 'TCP'} onClick={() => setP('proto', 'TCP')} />
          <FilterChip label="UDP" active={proto === 'UDP'} onClick={() => setP('proto', 'UDP')} />
          <span className="mx-1 h-4 w-px bg-white/10" />
          <FilterChip label="All states" active={!state} onClick={() => setP('state', null)} />
          <FilterChip label={`Estab (${stateCounts.ESTABLISHED})`} active={state === 'ESTABLISHED'} onClick={() => setP('state', 'ESTABLISHED')} />
          <FilterChip label={`TIME_WAIT (${stateCounts.TIME_WAIT})`} active={state === 'TIME_WAIT'} onClick={() => setP('state', 'TIME_WAIT')} />
          <FilterChip label={`LISTEN (${stateCounts.LISTEN})`} active={state === 'LISTEN'} onClick={() => setP('state', 'LISTEN')} />
          <FilterChip label={`Other (${stateCounts.OTHER})`} active={state === 'OTHER'} onClick={() => setP('state', 'OTHER')} />
        </div>
      </div>

      {/* Table */}
      {connections.length === 0 ? (
        <p className="nw-muted text-sm p-3">No connection data yet.</p>
      ) : filtered.length === 0 ? (
        <p className="nw-muted text-sm p-3">No matches for current filters.</p>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider nw-subtle sticky top-0 bg-[#0c1824] z-10">
              <tr className="border-b border-white/6">
                <th className="text-left py-2 px-2">Proto</th>
                <SortHeader label="State" active={sortKey === 'state'} desc={sortDesc} onClick={() => toggleSort('state')} />
                <SortHeader label="Process" active={sortKey === 'process'} desc={sortDesc} onClick={() => toggleSort('process')} />
                <th className="text-left py-2 px-2">Local</th>
                <SortHeader label="Remote" active={sortKey === 'remote'} desc={sortDesc} onClick={() => toggleSort('remote')} />
                <SortHeader label="RTT" align="right" active={sortKey === 'rtt'} desc={sortDesc} onClick={() => toggleSort('rtt')} title="Kernel-measured SRTT" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={`${c.local_addr}-${c.remote_addr}-${i}`} className="border-b border-white/6 last:border-b-0 hover:bg-white/3">
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
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
        active
          ? 'bg-[rgba(61,214,198,0.15)] border-[rgba(61,214,198,0.35)] text-[var(--nw-text)]'
          : 'bg-white/4 border-white/10 text-[var(--nw-text-muted)] hover:text-[var(--nw-text)]'
      }`}
    >
      {label}
    </button>
  )
}

function SortHeader({ label, active, desc, onClick, align, title }: {
  label: string; active: boolean; desc: boolean; onClick: () => void; align?: 'left' | 'right'; title?: string
}) {
  const a = align ?? 'left'
  return (
    <th className={`py-2 px-2 ${a === 'right' ? 'text-right' : 'text-left'}`} title={title}>
      <button onClick={onClick} className={`inline-flex items-center gap-1 uppercase tracking-wider ${active ? 'text-[var(--nw-text)]' : 'nw-subtle hover:text-zinc-300'}`}>
        {label}
        {!active && <ArrowUpDown size={10} className="opacity-50" />}
        {active && (desc ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
      </button>
    </th>
  )
}

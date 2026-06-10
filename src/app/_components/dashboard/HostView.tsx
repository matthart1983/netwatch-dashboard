'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import {
  getHost, getMetrics, getAgentAlerts, getProcesses, getConnections, getDnsAnalytics,
  type AgentAlert, type ConnectionRow, type DnsAnalytics, type Host, type MetricPoint, type ProcessRow,
} from '@/lib/api'
import { DashboardChrome, Pill, TopBar } from '../DashboardChrome'
import { ChartCard, KpiTile, Panel, Sparkline, TabStrip, mkSeries, statusColor, thresholdColor, type TimePoint } from './primitives'
import type { FleetStatus } from './FleetView'

type TabId = 'overview' | 'charts' | 'processes' | 'connections' | 'dns' | 'alerts' | 'info'
type Range = '1h' | '6h' | '24h' | '72h'

const RANGE_HOURS: Record<Range, number> = { '1h': 1, '6h': 6, '24h': 24, '72h': 72 }

function classifyHost(host: Host, latest: MetricPoint | undefined, agentAlerts: AgentAlert[]): FleetStatus {
  if (!host.is_online) return 'offline'
  if (agentAlerts.some(a => a.severity === 'critical')) return 'critical'
  if (latest?.cpu_usage_pct != null && latest.cpu_usage_pct > 80) return 'critical'
  const memTotal = host.memory_total_bytes
  if (latest?.memory_used_bytes != null && memTotal && (latest.memory_used_bytes / memTotal) > 0.85) return 'critical'
  if (latest?.gateway_loss_pct != null && latest.gateway_loss_pct > 5) return 'critical'
  if (agentAlerts.length > 0) return 'warn'
  if (latest?.cpu_usage_pct != null && latest.cpu_usage_pct > 60) return 'warn'
  if (latest?.gateway_rtt_ms != null && latest.gateway_rtt_ms > 20) return 'warn'
  if (latest?.gateway_loss_pct != null && latest.gateway_loss_pct > 0) return 'warn'
  return 'healthy'
}

function fmtUptime(secs: number | null): string {
  if (secs == null) return '—'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m`
}

function fmtSecAgo(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)}`
}

export function HostView({ id }: { id: string }) {
  const { token, isLoading: authLoading } = useAuth()
  const [host, setHost] = useState<Host | null>(null)
  const [points, setPoints] = useState<MetricPoint[]>([])
  const [agentAlerts, setAgentAlerts] = useState<AgentAlert[]>([])
  const [processes, setProcesses] = useState<ProcessRow[] | null>(null)
  const [connections, setConnections] = useState<ConnectionRow[] | null>(null)
  const [dns, setDns] = useState<DnsAnalytics | null>(null)
  const [tab, setTab] = useState<TabId>('overview')
  const [range, setRange] = useState<Range>('24h')

  // Lazy-load per-tab data when the tab becomes active.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    if (tab === 'processes' && processes === null) {
      getProcesses(id).then(r => { if (!cancelled) setProcesses(r.processes) }).catch(() => { if (!cancelled) setProcesses([]) })
    } else if (tab === 'connections' && connections === null) {
      getConnections(id).then(r => { if (!cancelled) setConnections(r.connections) }).catch(() => { if (!cancelled) setConnections([]) })
    } else if (tab === 'dns' && dns === null) {
      getDnsAnalytics(id).then(r => { if (!cancelled) setDns(r) }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [tab, id, token, processes, connections, dns])

  // The process drawer joins against connections, which are normally
  // lazy-loaded only when that tab opens — let the drawer request them.
  const ensureConnections = useCallback(() => {
    if (!token || connections !== null) return
    getConnections(id).then(r => setConnections(r.connections)).catch(() => setConnections([]))
  }, [token, connections, id])

  useEffect(() => {
    if (authLoading || !token) return
    let cancelled = false
    const load = async () => {
      try {
        const from = new Date(Date.now() - RANGE_HOURS[range] * 3600 * 1000).toISOString()
        const [h, m, a] = await Promise.all([
          getHost(id),
          getMetrics(id, from),
          getAgentAlerts(id).catch(() => [] as AgentAlert[]),
        ])
        if (cancelled) return
        setHost(h)
        setPoints(m.points)
        setAgentAlerts(a)
      } catch {}
    }
    void load()
    const t = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [id, range, token, authLoading])

  const latest = points[points.length - 1]
  const status = host ? classifyHost(host, latest, agentAlerts) : 'healthy'
  const sc = statusColor(status)
  const grayed = status === 'offline'

  const memTotal = host?.memory_total_bytes ?? null
  const cpuSeries = points.map(p => p.cpu_usage_pct).filter((v): v is number => v != null)
  const memSeries = memTotal != null
    ? points.map(p => p.memory_used_bytes != null ? (p.memory_used_bytes / memTotal) * 100 : null).filter((v): v is number => v != null)
    : []
  const loadSeries = points.map(p => p.load_avg_1m).filter((v): v is number => v != null)
  const rttSeries = points.map(p => p.gateway_rtt_ms).filter((v): v is number => v != null)
  const dnsRttSeries = points.map(p => p.dns_rtt_ms).filter((v): v is number => v != null)
  const lossSeries = points.map(p => p.gateway_loss_pct).filter((v): v is number => v != null)
  const netSeries = points
    .map(p => ((p.net_rx_rate_bps ?? 0) + (p.net_tx_rate_bps ?? 0)) / 1024)
    .filter(v => Number.isFinite(v))

  const cpu = latest?.cpu_usage_pct ?? null
  const memPct = latest?.memory_used_bytes != null && memTotal
    ? (latest.memory_used_bytes / memTotal) * 100
    : null
  const load1m = latest?.load_avg_1m ?? null
  const rxBps = latest?.net_rx_rate_bps ?? 0
  const txBps = latest?.net_tx_rate_bps ?? 0
  const loss = latest?.gateway_loss_pct ?? null
  const rtt = latest?.gateway_rtt_ms ?? null
  const dnsRtt = latest?.dns_rtt_ms ?? null
  const tcpTimeWait = latest?.tcp_time_wait ?? null
  const tcpCloseWait = latest?.tcp_close_wait ?? null
  const disk = latest?.disk_usage_pct ?? null

  const statusLabel = status === 'offline' ? 'OFFLINE' : status === 'critical' ? 'CRITICAL' : status === 'warn' ? 'WARNING' : 'HEALTHY'
  const alertText = agentAlerts[0]?.message ?? null

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'charts', label: 'Charts', count: 12 },
    { id: 'processes', label: 'Processes' },
    { id: 'connections', label: 'Connections' },
    { id: 'dns', label: 'DNS' },
    { id: 'alerts', label: 'Alerts', count: agentAlerts.length || undefined },
    { id: 'info', label: 'Info' },
  ]

  if (authLoading || !host) {
    return (
      <DashboardChrome>
        <div className="flex flex-1 items-center justify-center font-mono" style={{ color: 'var(--nw-text-muted)' }}>
          loading host…
        </div>
      </DashboardChrome>
    )
  }

  return (
    <DashboardChrome>
      <TopBar
        crumbs={[{ label: 'Fleet', href: '/' }, { label: host.hostname }]}
        right={
          <>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--nw-text-soft)' }}>
              {fmtSecAgo(host.last_seen_at)}
            </span>
            <Pill color={sc}>{grayed ? 'OFFLINE' : 'LIVE'}</Pill>
          </>
        }
      />

      {/* Hero */}
      <div style={{ padding: '18px 22px 0' }}>
        <Link
          href="/"
          className="font-mono"
          style={{ fontSize: 11, color: 'var(--nw-text-muted)', textDecoration: 'none', display: 'inline-block', marginBottom: 10 }}
        >
          ← back to fleet
        </Link>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1
              className="m-0 font-mono font-medium"
              style={{ fontSize: 26, letterSpacing: '-0.02em', color: 'var(--nw-text)' }}
            >
              {host.hostname}
            </h1>
            <div className="mt-2 flex flex-wrap font-mono gap-y-1.5" style={{ fontSize: 11, color: 'var(--nw-text-muted)', columnGap: 18 }}>
              {host.os && <Meta label="os" value={host.os} />}
              {host.kernel && <Meta label="kernel" value={host.kernel} />}
              {host.cpu_cores != null && <Meta label="cores" value={String(host.cpu_cores)} />}
              {host.uptime_secs != null && <Meta label="uptime" value={fmtUptime(host.uptime_secs)} />}
              {host.agent_version && <Meta label="agent" value={host.agent_version} />}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Pill color={sc}>{statusLabel}</Pill>
            <div
              className="flex font-mono"
              style={{ gap: 4, background: 'var(--nw-surface-2)', border: '1px solid var(--nw-border)', borderRadius: 6, padding: 3 }}
            >
              {(['1h', '6h', '24h', '72h'] as Range[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    background: range === r ? 'var(--nw-surface-3)' : 'transparent',
                    border: 'none',
                    color: range === r ? 'var(--nw-text)' : 'var(--nw-text-muted)',
                    fontSize: 11,
                    padding: '4px 9px',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {alertText && (
          <div
            className="font-mono mt-3.5 flex items-center gap-3"
            style={{
              padding: '10px 14px',
              background: `color-mix(in srgb, ${sc} 6%, transparent)`,
              border: `1px solid color-mix(in srgb, ${sc} 20%, transparent)`,
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            <span className="font-semibold" style={{ color: sc }}>ALERT</span>
            <span style={{ color: 'var(--nw-text)' }}>{alertText}</span>
            <span className="ml-auto" style={{ color: 'var(--nw-text-soft)', fontSize: 11 }}>
              {agentAlerts[0] ? new Date(agentAlerts[0].time).toLocaleString() : 'fires now'}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 22px 0' }}>
        <TabStrip tabs={tabs} active={tab} onChange={id => setTab(id as TabId)} />
      </div>

      <div className="flex-1 overflow-auto" style={{ padding: '18px 22px 22px' }}>
        {tab === 'overview' && (
          <OverviewTab
            grayed={grayed}
            cpu={cpu} memPct={memPct} load1m={load1m} rxBps={rxBps} txBps={txBps}
            rtt={rtt} dnsRtt={dnsRtt} loss={loss} disk={disk}
            tcpTimeWait={tcpTimeWait} tcpCloseWait={tcpCloseWait}
            cpuSeries={cpuSeries} memSeries={memSeries} loadSeries={loadSeries}
            rttSeries={rttSeries} dnsRttSeries={dnsRttSeries} lossSeries={lossSeries}
            netSeries={netSeries}
            alertText={alertText}
            host={host}
            agentAlerts={agentAlerts}
            points={points}
            rangeH={RANGE_HOURS[range]}
          />
        )}
        {tab === 'charts' && <ChartsTab points={points} memTotal={memTotal} grayed={grayed} rangeH={RANGE_HOURS[range]} />}
        {tab === 'processes' && (
          <ProcessesTab
            processes={processes}
            connections={connections}
            onNeedConnections={ensureConnections}
            onViewConnections={() => setTab('connections')}
          />
        )}
        {tab === 'connections' && <ConnectionsTab connections={connections} />}
        {tab === 'dns' && <DnsTab dns={dns} />}
        {tab === 'alerts' && <AlertsTab alerts={agentAlerts} />}
        {tab === 'info' && <InfoTab host={host} />}
      </div>
    </DashboardChrome>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span style={{ color: 'var(--nw-text-soft)' }}>{label} </span>
      {value}
    </span>
  )
}

interface OverviewTabProps {
  grayed: boolean
  cpu: number | null
  memPct: number | null
  load1m: number | null
  rxBps: number
  txBps: number
  rtt: number | null
  dnsRtt: number | null
  loss: number | null
  disk: number | null
  tcpTimeWait: number | null
  tcpCloseWait: number | null
  cpuSeries: number[]
  memSeries: number[]
  loadSeries: number[]
  rttSeries: number[]
  dnsRttSeries: number[]
  lossSeries: number[]
  netSeries: number[]
  alertText: string | null
  host: Host
  agentAlerts: AgentAlert[]
  points: MetricPoint[]
  rangeH: number
}

function OverviewTab(p: OverviewTabProps) {
  const cpuColor = thresholdColor(p.cpu, 60, 80)
  const memColor = thresholdColor(p.memPct, 70, 85)
  const loadColor = p.load1m != null && p.host.cpu_cores
    ? thresholdColor(p.load1m, p.host.cpu_cores * 0.6, p.host.cpu_cores * 0.9)
    : 'var(--nw-text)'
  const rttColor = p.rtt != null && p.rtt > 20 ? 'var(--nw-warm)' : 'var(--nw-accent)'
  const lossColor = p.loss != null && p.loss > 1 ? 'var(--nw-danger)' : 'var(--nw-accent)'
  const diskColor = p.disk != null && p.disk > 80 ? 'var(--nw-warm)' : 'var(--nw-accent)'

  return (
    <>
      {/* KPI tiles — 4 primary */}
      <div className="mb-3.5 grid gap-2.5 grid-cols-2 lg:grid-cols-4">
        <KpiTile label="CPU" value={p.grayed || p.cpu == null ? '—' : p.cpu.toFixed(0)} unit={p.grayed || p.cpu == null ? '' : '%'} color={p.grayed ? 'var(--nw-text-soft)' : cpuColor} series={p.cpuSeries} sparkColor={cpuColor} timeSeries={mkSeries(p.points, x => x.cpu_usage_pct)} rangeH={p.rangeH} />
        <KpiTile label="MEMORY" value={p.grayed || p.memPct == null ? '—' : p.memPct.toFixed(0)} unit={p.grayed || p.memPct == null ? '' : '%'} color={p.grayed ? 'var(--nw-text-soft)' : memColor} series={p.memSeries} sparkColor={memColor} timeSeries={mkSeries(p.points, x => p.host.memory_total_bytes && x.memory_used_bytes != null ? (x.memory_used_bytes / p.host.memory_total_bytes) * 100 : null)} rangeH={p.rangeH} />
        <KpiTile label="LOAD 1M" value={p.grayed || p.load1m == null ? '—' : p.load1m.toFixed(2)} color={p.grayed ? 'var(--nw-text-soft)' : loadColor} series={p.loadSeries} sparkColor={loadColor} timeSeries={mkSeries(p.points, x => x.load_avg_1m)} rangeH={p.rangeH} />
        <KpiTile
          label="NET RX/TX"
          value={p.grayed ? '—' : `${fmtMB(p.rxBps)} / ${fmtMB(p.txBps)}`}
          unit={p.grayed ? '' : 'MB/s'}
          color={p.grayed ? 'var(--nw-text-soft)' : 'var(--nw-text)'}
          series={p.netSeries}
          sparkColor="var(--nw-info)"
          timeSeries={mkSeries(p.points, x => (x.net_rx_rate_bps != null || x.net_tx_rate_bps != null) ? ((x.net_rx_rate_bps ?? 0) + (x.net_tx_rate_bps ?? 0)) / 1e6 : null)}
          rangeH={p.rangeH}
        />
      </div>

      {/* HEALTH strip */}
      <Panel style={{ marginBottom: 14, padding: 0 }}>
        <div
          className="flex items-center justify-between"
          style={{ padding: '10px 16px', borderBottom: '1px solid var(--nw-border)' }}
        >
          <span className="font-mono font-medium uppercase" style={{ fontSize: 11, color: 'var(--nw-text)', letterSpacing: '0.04em' }}>
            HEALTH
          </span>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>last 24h</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['GW RTT', p.grayed || p.rtt == null ? '—' : `${p.rtt.toFixed(1)}ms`, rttColor, p.rttSeries] as const,
            ['DNS RTT', p.grayed || p.dnsRtt == null ? '—' : `${p.dnsRtt.toFixed(1)}ms`, 'var(--nw-accent)', p.dnsRttSeries] as const,
            ['PACKET LOSS', p.grayed || p.loss == null ? '—' : `${p.loss.toFixed(1)}%`, lossColor, p.lossSeries] as const,
            ['DISK', p.grayed || p.disk == null ? '—' : `${p.disk.toFixed(0)}%`, diskColor, [] as number[]] as const,
            ['TIME_WAIT', p.grayed || p.tcpTimeWait == null ? '—' : String(p.tcpTimeWait), 'var(--nw-text)', [] as number[]] as const,
            ['CLOSE_WAIT', p.grayed || p.tcpCloseWait == null ? '—' : String(p.tcpCloseWait), 'var(--nw-text)', [] as number[]] as const,
          ].map(([label, val, color, series], i) => (
            <div key={label} style={{ padding: '12px 16px', borderRight: i < 5 ? '1px solid var(--nw-line-soft)' : 'none' }}>
              <div className="font-mono uppercase mb-1.5" style={{ fontSize: 9, color: 'var(--nw-text-soft)', letterSpacing: '0.08em' }}>
                {label}
              </div>
              <div className="font-mono font-medium mb-1.5" style={{ fontSize: 16, color: p.grayed ? 'var(--nw-text-soft)' : color }}>
                {val}
              </div>
              {!p.grayed && series.length > 0 && (
                <Sparkline data={series} color={color} height={20} fill={false} strokeWidth={1.1} />
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Three time-series charts */}
      <div className="mb-3.5 grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <ChartCard label="GATEWAY RTT (ms)" series={mkSeries(p.points, x => x.gateway_rtt_ms)} color="var(--nw-accent)" unit="ms" rangeH={p.rangeH} />
        <ChartCard label="CPU %" series={mkSeries(p.points, x => x.cpu_usage_pct)} color={cpuColor} unit="%" rangeH={p.rangeH} />
        <ChartCard label="NETWORK RX+TX (kB/s)" series={mkSeries(p.points, x => (x.net_rx_rate_bps != null || x.net_tx_rate_bps != null) ? ((x.net_rx_rate_bps ?? 0) + (x.net_tx_rate_bps ?? 0)) / 1024 : null)} color="var(--nw-info)" rangeH={p.rangeH} />
      </div>

      {/* Bottom region — varies by state */}
      {p.grayed ? (
        <Panel>
          <div className="text-center" style={{ padding: '24px 16px' }}>
            <div className="font-mono mb-2" style={{ fontSize: 14, color: 'var(--nw-danger)' }}>
              ● OFFLINE — last seen {fmtSecAgo(p.host.last_seen_at)}
            </div>
            <div className="font-sans mb-3.5" style={{ fontSize: 13, color: 'var(--nw-text-muted)' }}>
              No metrics in the last interval. Showing last-known values, grayed out.
            </div>
            <div className="font-mono flex justify-center gap-3.5" style={{ fontSize: 11, color: 'var(--nw-text-soft)' }}>
              <span>verify agent →</span>
              <span>view ssh history →</span>
              <span>open runbook →</span>
            </div>
          </div>
        </Panel>
      ) : !p.alertText && p.agentAlerts.length === 0 ? (
        <Panel>
          <div className="flex items-center gap-3.5">
            <span className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--nw-accent)', letterSpacing: '0.04em' }}>
              ● QUIET
            </span>
            <span className="font-sans" style={{ fontSize: 13, color: 'var(--nw-text-muted)' }}>
              No process anomalies, no connection events, no DNS issues, no alerts in the last 24h.
            </span>
            <span className="ml-auto font-mono" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>browse data →</span>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-2.5 grid-cols-1 lg:[grid-template-columns:1.3fr_1fr]">
          <Panel padding="0">
            <div
              className="flex items-center justify-between"
              style={{ padding: '10px 16px', borderBottom: '1px solid var(--nw-border)' }}
            >
              <span className="font-mono font-medium uppercase" style={{ fontSize: 11, color: 'var(--nw-text)', letterSpacing: '0.04em' }}>
                AGENT ALERTS
              </span>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>{p.agentAlerts.length} active</span>
            </div>
            {p.agentAlerts.length === 0 ? (
              <div className="font-mono" style={{ padding: '14px 16px', fontSize: 12, color: 'var(--nw-text-soft)' }}>
                no agent-side alerts
              </div>
            ) : p.agentAlerts.slice(0, 5).map((a, i) => (
              <div
                key={i}
                className="grid font-mono items-center"
                style={{
                  gridTemplateColumns: '70px 80px 1fr',
                  gap: 10,
                  padding: '8px 16px',
                  fontSize: 11.5,
                  borderBottom: i < Math.min(p.agentAlerts.length, 5) - 1 ? '1px solid var(--nw-line-soft)' : 'none',
                }}
              >
                <span style={{ color: 'var(--nw-text-soft)' }}>{fmtSecAgo(a.time)}</span>
                <span style={{ color: a.severity === 'critical' ? 'var(--nw-danger)' : 'var(--nw-warm)' }}>
                  {a.severity}
                </span>
                <span style={{ color: 'var(--nw-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.message}
                </span>
              </div>
            ))}
          </Panel>
          <Panel padding="0">
            <div
              className="flex items-center justify-between"
              style={{ padding: '10px 16px', borderBottom: '1px solid var(--nw-border)' }}
            >
              <span className="font-mono font-medium uppercase" style={{ fontSize: 11, color: 'var(--nw-text)', letterSpacing: '0.04em' }}>
                CATEGORY
              </span>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>top 4</span>
            </div>
            {Object.entries(
              p.agentAlerts.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.category]: (acc[a.category] ?? 0) + 1 }), {}),
            ).slice(0, 4).map(([cat, n], i, arr) => (
              <div
                key={cat}
                className="grid font-mono items-center"
                style={{
                  gridTemplateColumns: '1fr 40px',
                  gap: 10,
                  padding: '10px 16px',
                  fontSize: 11.5,
                  borderBottom: i < arr.length - 1 ? '1px solid var(--nw-line-soft)' : 'none',
                }}
              >
                <span style={{ color: 'var(--nw-text)' }}>{cat}</span>
                <span style={{ color: 'var(--nw-text-muted)', textAlign: 'right' }}>{n}</span>
              </div>
            ))}
          </Panel>
        </div>
      )}
    </>
  )
}

// ── Charts tab — small-multiple time-series across 12 metrics ──

function ChartsTab({ points, memTotal, grayed, rangeH }: { points: MetricPoint[]; memTotal: number | null; grayed: boolean; rangeH: number }) {
  if (grayed || points.length === 0) {
    return (
      <Panel>
        <div className="text-center font-mono" style={{ padding: '40px 24px', fontSize: 12, color: 'var(--nw-text-soft)' }}>
          {grayed ? 'host offline · no recent metrics' : 'no metric history in this range'}
        </div>
      </Panel>
    )
  }

  const charts: { label: string; series: TimePoint[]; color: string; unit?: string }[] = [
    { label: 'CPU %', series: mkSeries(points, p => p.cpu_usage_pct), color: 'var(--nw-accent)', unit: '%' },
    { label: 'MEMORY %', series: mkSeries(points, p => memTotal && p.memory_used_bytes != null ? (p.memory_used_bytes / memTotal) * 100 : null), color: 'var(--nw-warm)', unit: '%' },
    { label: 'LOAD 1M', series: mkSeries(points, p => p.load_avg_1m), color: 'var(--nw-info)' },
    { label: 'LOAD 5M', series: mkSeries(points, p => p.load_avg_5m), color: 'var(--nw-info)' },
    { label: 'LOAD 15M', series: mkSeries(points, p => p.load_avg_15m), color: 'var(--nw-info)' },
    { label: 'GW RTT (ms)', series: mkSeries(points, p => p.gateway_rtt_ms), color: 'var(--nw-accent)', unit: 'ms' },
    { label: 'DNS RTT (ms)', series: mkSeries(points, p => p.dns_rtt_ms), color: 'var(--nw-accent)', unit: 'ms' },
    { label: 'PACKET LOSS %', series: mkSeries(points, p => p.gateway_loss_pct), color: 'var(--nw-danger)', unit: '%' },
    { label: 'NET RX (kB/s)', series: mkSeries(points, p => p.net_rx_rate_bps != null ? p.net_rx_rate_bps / 1024 : null), color: 'var(--nw-info)' },
    { label: 'NET TX (kB/s)', series: mkSeries(points, p => p.net_tx_rate_bps != null ? p.net_tx_rate_bps / 1024 : null), color: 'var(--nw-violet)' },
    { label: 'CONNECTIONS', series: mkSeries(points, p => p.connection_count), color: 'var(--nw-text-muted)' },
    { label: 'TCP TIME_WAIT', series: mkSeries(points, p => p.tcp_time_wait), color: 'var(--nw-text-muted)' },
  ]

  return (
    <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {charts.map(c => (
        <ChartCard key={c.label} label={c.label} series={c.series} color={c.color} unit={c.unit} rangeH={rangeH} />
      ))}
    </div>
  )
}

// ── Processes tab — live process list with per-process drill-in ──

/** Human label + color for a single-char ps scheduler state. */
const PROC_STATES: Record<string, { label: string; color: string }> = {
  R: { label: 'running', color: 'var(--nw-ok, #4ade80)' },
  S: { label: 'sleeping', color: 'var(--nw-text-muted)' },
  I: { label: 'idle', color: 'var(--nw-text-muted)' },
  Z: { label: 'zombie', color: 'var(--nw-crit, #f87171)' },
  T: { label: 'stopped', color: 'var(--nw-warn, #fbbf24)' },
  D: { label: 'uninterruptible', color: 'var(--nw-warn, #fbbf24)' },
  U: { label: 'uninterruptible', color: 'var(--nw-warn, #fbbf24)' },
}

function procStateInfo(state: string | null | undefined) {
  if (!state) return null
  return PROC_STATES[state] ?? { label: state.toLowerCase(), color: 'var(--nw-text-muted)' }
}

/** Stable row identity for selection — survives re-sorts and refreshes. */
function procKey(p: ProcessRow): string {
  return `${p.pid ?? 'x'}:${p.process_name}`
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}MB`
  return `${(bytes / 1024).toFixed(0)}kB`
}

/** "3d 4h" / "2h 05m" / "12m" since an RFC 3339 timestamp. */
function fmtAge(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

type ProcSortKey = 'rx' | 'tx' | 'connections' | 'name' | 'cpu' | 'mem'

function ProcessesTab({ processes, connections, onNeedConnections, onViewConnections }: {
  processes: ProcessRow[] | null
  connections: ConnectionRow[] | null
  onNeedConnections: () => void
  onViewConnections: () => void
}) {
  const [sortKey, setSortKey] = useState<ProcSortKey>('connections')
  const [selKey, setSelKey] = useState<string | null>(null)

  // Selected from the full list so a refresh that reorders rows doesn't
  // silently switch which process the drawer shows.
  const selected = useMemo(
    () => (selKey && processes ? processes.find(p => procKey(p) === selKey) ?? null : null),
    [processes, selKey],
  )

  if (processes === null) return <PanelLoading label="loading processes…" />
  if (processes.length === 0) {
    return (
      <Panel>
        <div className="text-center font-mono" style={{ padding: '40px 24px', fontSize: 12, color: 'var(--nw-text-soft)' }}>
          no process data — agent process collector may be off
        </div>
      </Panel>
    )
  }

  const sorted = [...processes].sort((a, b) => {
    if (sortKey === 'name') return a.process_name.localeCompare(b.process_name)
    if (sortKey === 'rx') return b.rx_rate_bps - a.rx_rate_bps
    if (sortKey === 'tx') return b.tx_rate_bps - a.tx_rate_bps
    if (sortKey === 'cpu') return (b.cpu_pct ?? -1) - (a.cpu_pct ?? -1)
    if (sortKey === 'mem') return (b.mem_rss_bytes ?? -1) - (a.mem_rss_bytes ?? -1)
    return b.connection_count - a.connection_count
  })

  // Detail columns only render when the agent reports them (v0.3+), so
  // fleets on older agents keep the original layout, not a wall of dashes.
  const hasDetail = processes.some(p => p.cpu_pct != null || p.user != null || p.mem_rss_bytes != null)
  const gridCols = hasDetail ? '60px 1fr 90px 64px 72px 100px 100px 64px' : '60px 1fr 100px 100px 80px'
  const minWidth = hasDetail ? 700 : 480

  return (
    <>
    <Panel padding="0" style={{ overflowX: 'auto' }}>
      <div
        className="grid font-mono uppercase"
        style={{
          gridTemplateColumns: gridCols,
          gap: 10,
          padding: '10px 14px',
          borderBottom: '1px solid var(--nw-border)',
          fontSize: 10,
          color: 'var(--nw-text-soft)',
          letterSpacing: '0.08em',
          minWidth,
        }}
      >
        <span>PID</span>
        <SortHeader active={sortKey === 'name'} onClick={() => setSortKey('name')}>PROCESS</SortHeader>
        {hasDetail && <span>USER</span>}
        {hasDetail && <SortHeader active={sortKey === 'cpu'} onClick={() => setSortKey('cpu')} align="right">CPU</SortHeader>}
        {hasDetail && <SortHeader active={sortKey === 'mem'} onClick={() => setSortKey('mem')} align="right">MEM</SortHeader>}
        <SortHeader active={sortKey === 'rx'} onClick={() => setSortKey('rx')} align="right">RX/S</SortHeader>
        <SortHeader active={sortKey === 'tx'} onClick={() => setSortKey('tx')} align="right">TX/S</SortHeader>
        <SortHeader active={sortKey === 'connections'} onClick={() => setSortKey('connections')} align="right">CONNS</SortHeader>
      </div>
      {sorted.slice(0, 100).map((p, i) => {
        const st = procStateInfo(p.state)
        const isSel = selKey === procKey(p)
        return (
        <div
          key={`${p.pid}-${p.process_name}-${i}`}
          onClick={() => {
            const next = isSel ? null : procKey(p)
            setSelKey(next)
            if (next) onNeedConnections()
          }}
          className="grid font-mono items-center"
          style={{
            gridTemplateColumns: gridCols,
            gap: 10,
            padding: '8px 14px',
            fontSize: 11.5,
            borderBottom: i < Math.min(sorted.length, 100) - 1 ? '1px solid var(--nw-line-soft)' : 'none',
            minWidth,
            cursor: 'pointer',
            background: isSel ? 'var(--nw-surface-3)' : 'transparent',
          }}
        >
          <span style={{ color: 'var(--nw-text-soft)' }}>{p.pid ?? '—'}</span>
          <span className="truncate" style={{ color: 'var(--nw-text)' }}>
            {st && <span style={{ color: st.color, marginRight: 6 }} title={st.label}>●</span>}
            {p.process_name}
          </span>
          {hasDetail && <span className="truncate" style={{ color: 'var(--nw-text-muted)' }}>{p.user ?? '—'}</span>}
          {hasDetail && (
            <span style={{ color: (p.cpu_pct ?? 0) > 30 ? 'var(--nw-warn, #fbbf24)' : 'var(--nw-text-muted)', textAlign: 'right' }}>
              {p.cpu_pct != null ? `${p.cpu_pct.toFixed(1)}%` : '—'}
            </span>
          )}
          {hasDetail && (
            <span style={{ color: 'var(--nw-text-muted)', textAlign: 'right' }}>
              {p.mem_rss_bytes != null ? fmtBytes(p.mem_rss_bytes) : '—'}
            </span>
          )}
          <span style={{ color: 'var(--nw-text-muted)', textAlign: 'right' }}>{fmtRate(p.rx_rate_bps)}</span>
          <span style={{ color: 'var(--nw-text-muted)', textAlign: 'right' }}>{fmtRate(p.tx_rate_bps)}</span>
          <span style={{ color: 'var(--nw-text)', textAlign: 'right' }}>{p.connection_count}</span>
        </div>
        )
      })}
    </Panel>
    {selected && (
      <ProcessDrawer
        proc={selected}
        allProcesses={processes}
        connections={connections}
        onClose={() => setSelKey(null)}
        onViewConnections={onViewConnections}
      />
    )}
    </>
  )
}

/** Per-process drill-in drawer: identity/resource detail from the agent's ps
 *  sampler, traffic totals, and this process's slice of the connection list. */
function ProcessDrawer({ proc, allProcesses, connections, onClose, onViewConnections }: {
  proc: ProcessRow
  allProcesses: ProcessRow[]
  connections: ConnectionRow[] | null
  onClose: () => void
  onViewConnections: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const totalRate = proc.rx_rate_bps + proc.tx_rate_bps
  const hostRate = allProcesses.reduce((s, p) => s + p.rx_rate_bps + p.tx_rate_bps, 0)
  const share = hostRate > 0 ? (totalRate / hostRate) * 100 : 0

  const procConns = useMemo(() => {
    if (!connections) return null
    const matches = connections.filter(c =>
      proc.pid != null ? c.pid === proc.pid : c.process_name === proc.process_name,
    )
    return [...matches].sort((a, b) =>
      (a.state === 'ESTABLISHED' ? 0 : 1) - (b.state === 'ESTABLISHED' ? 0 : 1)
      || a.remote_addr.localeCompare(b.remote_addr))
  }, [connections, proc])

  const st = procStateInfo(proc.state)
  const label = { fontSize: 10, color: 'var(--nw-text-soft)', letterSpacing: '0.08em', width: 64, flexShrink: 0 } as const
  const row = { display: 'flex', gap: 10, alignItems: 'baseline' } as const

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)' }}
    >
      <aside
        onClick={e => e.stopPropagation()}
        className="font-mono"
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 'min(420px, 100vw)',
          background: 'var(--nw-bg-elevated)',
          borderLeft: '1px solid var(--nw-border)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--nw-border)' }}>
          <span style={{ fontSize: 13, color: 'var(--nw-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proc.process_name}</span>
          <span style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>{proc.pid != null ? `pid ${proc.pid}` : 'pid unknown'}</span>
          <button onClick={onClose} title="Close (Esc)" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--nw-text-muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Process detail — hidden entirely for rows from older agents */}
          {(proc.user != null || proc.cpu_pct != null || proc.started_at != null) && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5 }}>
              <div className="uppercase" style={{ ...label, width: 'auto', marginBottom: 3 }}>process</div>
              {proc.cmd && <div style={row}><span className="uppercase" style={label}>cmd</span><span style={{ color: 'var(--nw-text)', wordBreak: 'break-all' }}>{proc.cmd}</span></div>}
              {proc.user != null && <div style={row}><span className="uppercase" style={label}>user</span><span style={{ color: 'var(--nw-text)' }}>{proc.user}</span></div>}
              {proc.ppid != null && <div style={row}><span className="uppercase" style={label}>ppid</span><span style={{ color: 'var(--nw-text)' }}>{proc.ppid}</span></div>}
              {st && <div style={row}><span className="uppercase" style={label}>state</span><span style={{ color: st.color }}>{st.label}</span></div>}
              {proc.cpu_pct != null && (
                <div style={row}><span className="uppercase" style={label}>cpu</span>
                  <span style={{ color: proc.cpu_pct > 30 ? 'var(--nw-warn, #fbbf24)' : 'var(--nw-text)' }}>{proc.cpu_pct.toFixed(1)}%</span>
                </div>
              )}
              {proc.mem_rss_bytes != null && (
                <div style={row}><span className="uppercase" style={label}>mem</span>
                  <span style={{ color: 'var(--nw-text)' }}>
                    {fmtBytes(proc.mem_rss_bytes)} rss
                    {proc.mem_virt_bytes != null && <span style={{ color: 'var(--nw-text-muted)' }}> / {fmtBytes(proc.mem_virt_bytes)} virt</span>}
                  </span>
                </div>
              )}
              {proc.started_at != null && (
                <div style={row}><span className="uppercase" style={label}>started</span>
                  <span style={{ color: 'var(--nw-text)' }}>
                    {new Date(proc.started_at).toLocaleString()}
                    <span style={{ color: 'var(--nw-text-muted)' }}> ({fmtAge(proc.started_at)} ago)</span>
                  </span>
                </div>
              )}
            </section>
          )}

          {/* Traffic */}
          <section style={{ fontSize: 11.5 }}>
            <div className="uppercase" style={{ ...label, width: 'auto', marginBottom: 6 }}>traffic</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                ['rx rate', fmtRate(proc.rx_rate_bps)], ['tx rate', fmtRate(proc.tx_rate_bps)], ['total', fmtRate(totalRate)],
                ['rx data', fmtBytes(proc.rx_bytes)], ['tx data', fmtBytes(proc.tx_bytes)], ['total data', fmtBytes(proc.rx_bytes + proc.tx_bytes)],
              ].map(([l, v]) => (
                <div key={l} style={{ background: 'var(--nw-surface-2)', border: '1px solid var(--nw-border)', borderRadius: 6, padding: '7px 9px' }}>
                  <div className="uppercase" style={{ fontSize: 9, color: 'var(--nw-text-soft)', letterSpacing: '0.08em' }}>{l}</div>
                  <div style={{ color: 'var(--nw-text)', fontSize: 12 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--nw-surface-3)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, share).toFixed(1)}%`, height: '100%', background: 'var(--nw-accent, #3dd6c6)' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--nw-text-muted)', whiteSpace: 'nowrap' }}>{share.toFixed(1)}% of reported</span>
            </div>
          </section>

          {/* Connections */}
          <section style={{ fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 6 }}>
              <span className="uppercase" style={{ ...label, width: 'auto' }}>
                connections{procConns ? ` (${procConns.length})` : ''}
              </span>
              <button
                onClick={onViewConnections}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--nw-accent, #3dd6c6)', cursor: 'pointer', fontSize: 10, padding: 0 }}
              >
                view all →
              </button>
            </div>
            {procConns === null ? (
              <div style={{ color: 'var(--nw-text-soft)' }}>loading…</div>
            ) : procConns.length === 0 ? (
              <div style={{ color: 'var(--nw-text-soft)' }}>
                no connections in the latest snapshot — the agent reports top flows
                per snapshot, so short-lived or idle sockets may not appear
              </div>
            ) : (
              procConns.map((c, i) => (
                <div key={`${c.local_addr}-${c.remote_addr}-${i}`} title={`${c.protocol} ${c.local_addr} → ${c.remote_addr}`}
                  style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < procConns.length - 1 ? '1px solid var(--nw-line-soft)' : 'none' }}>
                  <span className="truncate" style={{ color: 'var(--nw-text-muted)', flex: 1 }}>{c.remote_addr || c.local_addr}</span>
                  <span style={{ color: c.state === 'ESTABLISHED' ? 'var(--nw-ok, #4ade80)' : 'var(--nw-text-soft)', fontSize: 10 }}>{c.state || '—'}</span>
                  <span style={{ color: 'var(--nw-text-soft)', width: 52, textAlign: 'right' }}>
                    {c.kernel_rtt_us != null ? `${(c.kernel_rtt_us / 1000).toFixed(1)}ms` : '—'}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}

// ── Connections tab — active TCP/UDP ──

function ConnectionsTab({ connections }: { connections: ConnectionRow[] | null }) {
  const [stateFilter, setStateFilter] = useState<string>('all')
  if (connections === null) return <PanelLoading label="loading connections…" />
  if (connections.length === 0) {
    return (
      <Panel>
        <div className="text-center font-mono" style={{ padding: '40px 24px', fontSize: 12, color: 'var(--nw-text-soft)' }}>
          no active connections
        </div>
      </Panel>
    )
  }

  const states = ['all', ...Array.from(new Set(connections.map(c => c.state))).sort()]
  const filtered = stateFilter === 'all' ? connections : connections.filter(c => c.state === stateFilter)
  const breakdown = connections.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.state]: (acc[c.state] ?? 0) + 1 }), {})

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 font-mono" style={{ fontSize: 11 }}>
        {states.map(s => {
          const isActive = stateFilter === s
          const count = s === 'all' ? connections.length : (breakdown[s] ?? 0)
          return (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className="transition-colors"
              style={{
                background: isActive ? 'var(--nw-surface-3)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--nw-line-hard)' : 'var(--nw-border)'}`,
                borderRadius: 4,
                padding: '5px 10px',
                color: isActive ? 'var(--nw-text)' : 'var(--nw-text-muted)',
                cursor: 'pointer',
              }}
            >
              {s.toLowerCase()} <span style={{ color: 'var(--nw-text-soft)', marginLeft: 4 }}>{count}</span>
            </button>
          )
        })}
      </div>
      <Panel padding="0" style={{ overflowX: 'auto' }}>
        <div
          className="grid font-mono uppercase"
          style={{
            gridTemplateColumns: '60px 1fr 1fr 100px 90px 80px',
            gap: 10,
            padding: '10px 14px',
            borderBottom: '1px solid var(--nw-border)',
            fontSize: 10,
            color: 'var(--nw-text-soft)',
            letterSpacing: '0.08em',
            minWidth: 620,
          }}
        >
          <span>PROTO</span>
          <span>LOCAL</span>
          <span>REMOTE</span>
          <span>STATE</span>
          <span>PROCESS</span>
          <span style={{ textAlign: 'right' }}>RTT</span>
        </div>
        {filtered.slice(0, 200).map((c, i) => (
          <div
            key={i}
            className="grid font-mono items-center"
            style={{
              gridTemplateColumns: '60px 1fr 1fr 100px 90px 80px',
              gap: 10,
              padding: '7px 14px',
              fontSize: 11,
              borderBottom: i < Math.min(filtered.length, 200) - 1 ? '1px solid var(--nw-line-soft)' : 'none',
              minWidth: 620,
            }}
          >
            <span style={{ color: 'var(--nw-text-muted)' }}>{c.protocol.toLowerCase()}</span>
            <span className="truncate" style={{ color: 'var(--nw-text)' }}>{c.local_addr}</span>
            <span className="truncate" style={{ color: 'var(--nw-text)' }}>{c.remote_addr}</span>
            <span style={{ color: c.state === 'ESTABLISHED' ? 'var(--nw-accent)' : c.state === 'TIME_WAIT' ? 'var(--nw-warm)' : 'var(--nw-text-muted)' }}>
              {c.state.toLowerCase()}
            </span>
            <span className="truncate" style={{ color: 'var(--nw-text-muted)' }}>{c.process_name ?? '—'}</span>
            <span style={{ color: 'var(--nw-text-muted)', textAlign: 'right' }}>
              {c.kernel_rtt_us != null ? `${(c.kernel_rtt_us / 1000).toFixed(1)}ms` : '—'}
            </span>
          </div>
        ))}
      </Panel>
    </>
  )
}

// ── DNS tab — analytics ──

function DnsTab({ dns }: { dns: DnsAnalytics | null }) {
  if (dns === null) return <PanelLoading label="loading dns…" />
  const buckets = ['<5ms', '<10ms', '<25ms', '<50ms', '<100ms', '<250ms', '<500ms', '≥500ms']
  const maxBucket = Math.max(...dns.latency_buckets, 1)

  return (
    <div className="space-y-3.5">
      <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
        <KpiTile label="QUERIES" value={dns.total_queries.toLocaleString()} color="var(--nw-text)" />
        <KpiTile label="RESPONSES" value={dns.total_responses.toLocaleString()} color="var(--nw-text)" />
        <KpiTile
          label="NXDOMAIN"
          value={dns.nxdomain_count.toLocaleString()}
          color={dns.nxdomain_count > 0 ? 'var(--nw-warm)' : 'var(--nw-text-muted)'}
        />
      </div>

      <Panel padding="0">
        <div
          className="flex items-center justify-between"
          style={{ padding: '10px 16px', borderBottom: '1px solid var(--nw-border)' }}
        >
          <span className="font-mono font-medium uppercase" style={{ fontSize: 11, color: 'var(--nw-text)', letterSpacing: '0.04em' }}>
            LATENCY DISTRIBUTION
          </span>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>
            {dns.total_responses.toLocaleString()} responses
          </span>
        </div>
        <div className="font-mono" style={{ padding: '14px 16px', fontSize: 11.5 }}>
          {dns.latency_buckets.map((count, i) => (
            <div key={i} className="grid items-center" style={{ gridTemplateColumns: '70px 1fr 60px', gap: 10, padding: '4px 0' }}>
              <span style={{ color: 'var(--nw-text-soft)' }}>{buckets[i]}</span>
              <div className="h-1.5 overflow-hidden" style={{ background: 'var(--nw-surface-3)', borderRadius: 2 }}>
                <div
                  style={{
                    width: `${(count / maxBucket) * 100}%`,
                    height: '100%',
                    background: i >= 6 ? 'var(--nw-warm)' : 'var(--nw-accent)',
                  }}
                />
              </div>
              <span style={{ color: 'var(--nw-text)', textAlign: 'right' }}>{count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Panel>

      {dns.top_domains.length > 0 && (
        <Panel padding="0">
          <div
            className="flex items-center justify-between"
            style={{ padding: '10px 16px', borderBottom: '1px solid var(--nw-border)' }}
          >
            <span className="font-mono font-medium uppercase" style={{ fontSize: 11, color: 'var(--nw-text)', letterSpacing: '0.04em' }}>
              TOP DOMAINS
            </span>
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>
              {dns.top_domains.length}
            </span>
          </div>
          {dns.top_domains.slice(0, 25).map((d, i) => (
            <div
              key={d.name}
              className="grid font-mono items-center"
              style={{
                gridTemplateColumns: '1fr 80px',
                gap: 10,
                padding: '7px 16px',
                fontSize: 11.5,
                borderBottom: i < Math.min(dns.top_domains.length, 25) - 1 ? '1px solid var(--nw-line-soft)' : 'none',
              }}
            >
              <span className="truncate" style={{ color: 'var(--nw-text)' }}>{d.name}</span>
              <span style={{ color: 'var(--nw-text-muted)', textAlign: 'right' }}>{d.count.toLocaleString()}</span>
            </div>
          ))}
        </Panel>
      )}
    </div>
  )
}

// ── Alerts tab ──

function AlertsTab({ alerts }: { alerts: AgentAlert[] }) {
  if (alerts.length === 0) {
    return (
      <Panel>
        <div className="flex items-center gap-3.5">
          <span className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--nw-accent)', letterSpacing: '0.04em' }}>
            ● QUIET
          </span>
          <span className="font-sans" style={{ fontSize: 13, color: 'var(--nw-text-muted)' }}>
            No agent-side alerts on this host. Threshold rules and notification settings are in Settings.
          </span>
        </div>
      </Panel>
    )
  }

  return (
    <Panel padding="0">
      <div
        className="grid font-mono uppercase"
        style={{
          gridTemplateColumns: '120px 80px 100px 1fr',
          gap: 10,
          padding: '10px 14px',
          borderBottom: '1px solid var(--nw-border)',
          fontSize: 10,
          color: 'var(--nw-text-soft)',
          letterSpacing: '0.08em',
        }}
      >
        <span>WHEN</span>
        <span>SEVERITY</span>
        <span>CATEGORY</span>
        <span>MESSAGE</span>
      </div>
      {alerts.map((a, i) => (
        <div
          key={i}
          className="grid font-mono items-start"
          style={{
            gridTemplateColumns: '120px 80px 100px 1fr',
            gap: 10,
            padding: '10px 14px',
            fontSize: 11.5,
            borderBottom: i < alerts.length - 1 ? '1px solid var(--nw-line-soft)' : 'none',
          }}
        >
          <span style={{ color: 'var(--nw-text-soft)' }}>{fmtSecAgo(a.time)}</span>
          <span style={{ color: a.severity === 'critical' ? 'var(--nw-danger)' : 'var(--nw-warm)' }}>
            {a.severity}
          </span>
          <span style={{ color: 'var(--nw-text-muted)' }}>{a.category}</span>
          <div className="min-w-0">
            <div style={{ color: 'var(--nw-text)' }}>{a.message}</div>
            {a.detail && (
              <div className="mt-1" style={{ color: 'var(--nw-text-soft)', fontSize: 11 }}>{a.detail}</div>
            )}
          </div>
        </div>
      ))}
    </Panel>
  )
}

// ── Info tab ──

function InfoTab({ host }: { host: Host }) {
  const rows: [string, ReactNode][] = [
    ['hostname', host.hostname],
    ['host_id', <code key="id" style={{ fontSize: 11 }}>{host.id}</code>],
    ['os', host.os ?? '—'],
    ['kernel', host.kernel ?? '—'],
    ['cpu_model', host.cpu_model ?? '—'],
    ['cpu_cores', host.cpu_cores != null ? String(host.cpu_cores) : '—'],
    ['memory_total', host.memory_total_bytes != null ? `${(host.memory_total_bytes / 1024 ** 3).toFixed(1)} GB` : '—'],
    ['agent_version', host.agent_version ?? '—'],
    ['uptime', fmtUptime(host.uptime_secs)],
    ['last_seen', new Date(host.last_seen_at).toLocaleString()],
    ['status', host.is_online ? 'online' : 'offline'],
  ]

  return (
    <div className="grid gap-3.5 grid-cols-1 lg:[grid-template-columns:1.3fr_1fr]">
      <Panel padding="0">
        <div
          className="flex items-center justify-between"
          style={{ padding: '10px 16px', borderBottom: '1px solid var(--nw-border)' }}
        >
          <span className="font-mono font-medium uppercase" style={{ fontSize: 11, color: 'var(--nw-text)', letterSpacing: '0.04em' }}>
            HOST METADATA
          </span>
        </div>
        <dl className="font-mono" style={{ fontSize: 11.5, padding: '4px 0' }}>
          {rows.map(([k, v]) => (
            <div key={k} className="grid" style={{ gridTemplateColumns: '160px 1fr', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--nw-line-soft)' }}>
              <dt style={{ color: 'var(--nw-text-soft)' }}>{k}</dt>
              <dd className="m-0 break-all" style={{ color: 'var(--nw-text)' }}>{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel padding="0">
        <div
          className="flex items-center justify-between"
          style={{ padding: '10px 16px', borderBottom: '1px solid var(--nw-border)' }}
        >
          <span className="font-mono font-medium uppercase" style={{ fontSize: 11, color: 'var(--nw-text)', letterSpacing: '0.04em' }}>
            REINSTALL
          </span>
        </div>
        <div className="font-sans" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--nw-text-muted)', lineHeight: 1.6 }}>
          To reinstall or upgrade the agent on this host:
        </div>
        <pre className="m-0" style={{ padding: '0 16px 16px', fontSize: 11, color: 'var(--nw-accent)', fontFamily: 'var(--font-mono)' }}>
{`$ curl -sSL get.netwatch.cloud | sh \\
    --api-key YOUR_KEY \\
    --rebind`}
        </pre>
      </Panel>
    </div>
  )
}

// ── Helpers ──

function PanelLoading({ label }: { label: string }) {
  return (
    <Panel>
      <div className="text-center font-mono" style={{ padding: '40px 24px', fontSize: 12, color: 'var(--nw-text-soft)' }}>
        {label}
      </div>
    </Panel>
  )
}

function SortHeader({ children, active, onClick, align = 'left' }: { children: ReactNode; active: boolean; onClick: () => void; align?: 'left' | 'right' }) {
  return (
    <button
      onClick={onClick}
      className="font-mono uppercase transition-colors hover:!text-[var(--nw-text)]"
      style={{
        background: 'transparent',
        border: 'none',
        color: active ? 'var(--nw-text)' : 'var(--nw-text-soft)',
        textAlign: align,
        cursor: 'pointer',
        font: 'inherit',
        padding: 0,
      }}
    >
      {children}{active ? ' ↓' : ''}
    </button>
  )
}

function fmtRate(bps: number): string {
  if (bps === 0) return '0'
  if (bps < 1024) return `${bps.toFixed(0)}B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)}kB/s`
  return `${(bps / (1024 * 1024)).toFixed(1)}MB/s`
}

export {}

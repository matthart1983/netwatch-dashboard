'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Host, MetricPoint } from '@/lib/api'
import { Pill, TopBar } from '../DashboardChrome'
import { KpiTile, Panel, Sparkline, statusColor, thresholdColor, type TimePoint } from './primitives'

export type FleetStatus = 'healthy' | 'warn' | 'critical' | 'offline'
type FilterValue = 'all' | FleetStatus

export interface HostMetricsSummary {
  cpu: number | null
  memPct: number | null
  load1m: number | null
  latency: number | null
  loss: number | null
  connections: number | null
  cpuHistory: number[]
}

interface FleetViewProps {
  hosts: Host[]
  hostMetrics: Record<string, HostMetricsSummary>
  hostPoints: Record<string, MetricPoint[]>
  firingPerHost: Record<string, number>
  totalFiring: number
  alertSeries?: TimePoint[]
  onRemove?: (host: Host) => void
}

function classifyStatus(host: Host, m: HostMetricsSummary | undefined, firing: number): FleetStatus {
  if (!host.is_online) return 'offline'
  if (firing > 0) return 'critical'
  if (m?.cpu != null && m.cpu > 80) return 'critical'
  if (m?.memPct != null && m.memPct > 85) return 'critical'
  if (m?.loss != null && m.loss > 5) return 'critical'
  if (m?.cpu != null && m.cpu > 60) return 'warn'
  if (m?.memPct != null && m.memPct > 70) return 'warn'
  if (m?.latency != null && m.latency > 20) return 'warn'
  if (m?.loss != null && m.loss > 0) return 'warn'
  return 'healthy'
}

function alertText(host: Host, m: HostMetricsSummary | undefined, status: FleetStatus): string | null {
  if (status === 'offline') return 'agent offline'
  if (m?.cpu != null && m.cpu > 80) return `cpu ${m.cpu.toFixed(0)}% sustained`
  if (m?.memPct != null && m.memPct > 85) return `memory ${m.memPct.toFixed(0)}% pressure`
  if (m?.loss != null && m.loss > 5) return `gateway packet loss ${m.loss.toFixed(1)}%`
  if (m?.cpu != null && m.cpu > 60) return `cpu ${m.cpu.toFixed(0)}% elevated`
  if (m?.memPct != null && m.memPct > 70) return `memory ${m.memPct.toFixed(0)}% elevated`
  if (m?.latency != null && m.latency > 20) return `gateway rtt ${m.latency.toFixed(0)}ms`
  return null
}

function osShort(os: string | null): string {
  if (!os) return 'unknown'
  return os.split(' ').slice(0, 2).join(' ').toLowerCase()
}

function fmtSecAgo(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function fmtRate(bps: number): string {
  const mbps = bps / 1_000_000
  if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`
  const kbps = bps / 1000
  return `${kbps.toFixed(0)} kB/s`
}

function fleetRxTxSeries(hostPoints: Record<string, MetricPoint[]>): number[] {
  const allPoints = Object.values(hostPoints).flat()
  if (allPoints.length === 0) return []
  const buckets = new Map<number, number>()
  for (const p of allPoints) {
    const t = Math.floor(new Date(p.time).getTime() / 60_000)
    const rate = (p.net_rx_rate_bps ?? 0) + (p.net_tx_rate_bps ?? 0)
    buckets.set(t, (buckets.get(t) ?? 0) + rate)
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v).slice(-40)
}

// Same per-minute fleet rate aggregation, but timestamped (MB/s) for the
// fullscreen detail chart on the FLEET RX/TX tile.
function fleetRxTxTimeSeries(hostPoints: Record<string, MetricPoint[]>): TimePoint[] {
  const allPoints = Object.values(hostPoints).flat()
  if (allPoints.length === 0) return []
  const buckets = new Map<number, number>()
  for (const p of allPoints) {
    const t = Math.floor(new Date(p.time).getTime() / 60_000)
    const rate = (p.net_rx_rate_bps ?? 0) + (p.net_tx_rate_bps ?? 0)
    buckets.set(t, (buckets.get(t) ?? 0) + rate)
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-40).map(([t, v]) => ({ t: t * 60_000, v: v / 1e6 }))
}

type PointStatus = 'critical' | 'warn' | 'healthy'

// Metric-only classification of a single snapshot (mirrors classifyStatus minus
// the live offline/firing inputs, which aren't available historically).
function classifyPoint(p: MetricPoint, memTotal: number | null): PointStatus {
  const memPct = memTotal && p.memory_used_bytes != null ? (p.memory_used_bytes / memTotal) * 100 : null
  if ((p.cpu_usage_pct != null && p.cpu_usage_pct > 80) || (memPct != null && memPct > 85) || (p.gateway_loss_pct != null && p.gateway_loss_pct > 5)) return 'critical'
  if ((p.cpu_usage_pct != null && p.cpu_usage_pct > 60) || (memPct != null && memPct > 70) || (p.gateway_rtt_ms != null && p.gateway_rtt_ms > 20) || (p.gateway_loss_pct != null && p.gateway_loss_pct > 0)) return 'warn'
  return 'healthy'
}

// Real fleet status history: bucket every host's points by minute, classify the
// latest point per host in each bucket, and count online / critical / warning.
function fleetStatusSeries(
  hostPoints: Record<string, MetricPoint[]>,
  hosts: Host[],
): { online: TimePoint[]; critical: TimePoint[]; warning: TimePoint[] } {
  const memTotals = new Map<string, number | null>()
  for (const h of hosts) memTotals.set(h.id, h.memory_total_bytes ?? null)
  const buckets = new Map<number, Map<string, MetricPoint>>()
  for (const [hostId, points] of Object.entries(hostPoints)) {
    for (const p of points) {
      const t = Math.floor(new Date(p.time).getTime() / 60_000)
      let hm = buckets.get(t)
      if (!hm) { hm = new Map(); buckets.set(t, hm) }
      hm.set(hostId, p) // last point in the minute wins
    }
  }
  const online: TimePoint[] = []
  const critical: TimePoint[] = []
  const warning: TimePoint[] = []
  for (const [bt, hm] of [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-60)) {
    let c = 0, w = 0
    for (const [hostId, p] of hm) {
      const s = classifyPoint(p, memTotals.get(hostId) ?? null)
      if (s === 'critical') c++
      else if (s === 'warn') w++
    }
    const t = bt * 60_000
    online.push({ t, v: hm.size })
    critical.push({ t, v: c })
    warning.push({ t, v: w })
  }
  return { online, critical, warning }
}

export function FleetView({ hosts, hostMetrics, hostPoints, firingPerHost, totalFiring, alertSeries, onRemove }: FleetViewProps) {
  const [filter, setFilter] = useState<FilterValue>('all')
  const [sortKey, setSortKey] = useState<'status' | 'name' | 'cpu' | 'memPct' | 'load1m' | 'latency' | 'connections'>('status')

  const enriched = useMemo(() => hosts.map(h => {
    const m = hostMetrics[h.id]
    const firing = firingPerHost[h.id] ?? 0
    const status = classifyStatus(h, m, firing)
    return { host: h, m, status, alert: alertText(h, m, status) }
  }), [hosts, hostMetrics, firingPerHost])

  const trouble = enriched.filter(e => e.status !== 'healthy')
  const offlineCount = enriched.filter(e => e.status === 'offline').length
  const criticalCount = enriched.filter(e => e.status === 'critical').length
  const warnCount = enriched.filter(e => e.status === 'warn').length

  const filtered = filter === 'all' ? enriched : enriched.filter(e => e.status === filter)
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'status') {
      const order: Record<FleetStatus, number> = { offline: 0, critical: 1, warn: 2, healthy: 3 }
      return order[a.status] - order[b.status]
    }
    if (sortKey === 'name') return a.host.hostname.localeCompare(b.host.hostname)
    const av = (a.m?.[sortKey] ?? -Infinity) as number
    const bv = (b.m?.[sortKey] ?? -Infinity) as number
    return bv - av
  })

  const fleetRate = fleetRxTxSeries(hostPoints)
  const fleetRateSeries = fleetRate
  const fleetRateNow = fleetRate.length ? fleetRate[fleetRate.length - 1] : 0
  const fleetRateTime = fleetRxTxTimeSeries(hostPoints)
  const statusSeries = useMemo(() => fleetStatusSeries(hostPoints, hosts), [hostPoints, hosts])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        crumbs={[{ label: 'Fleet' }]}
        right={
          <>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--nw-text-soft)' }}>
              live
            </span>
            <Pill color="var(--nw-accent)">LIVE</Pill>
          </>
        }
      />

      <div className="flex-1 overflow-auto" style={{ padding: '20px 22px' }}>
        {/* Hero */}
        <div className="mb-[18px]">
          <div
            className="font-mono uppercase mb-1.5"
            style={{ fontSize: 11, color: 'var(--nw-text-soft)', letterSpacing: '0.08em' }}
          >
            FLEET · {hosts.length} {hosts.length === 1 ? 'HOST' : 'HOSTS'}
          </div>
          <div className="flex items-baseline gap-3.5">
            <h1
              className="m-0 font-mono font-medium"
              style={{ fontSize: 30, letterSpacing: '-0.02em', color: 'var(--nw-text)' }}
            >
              {hosts.length} {hosts.length === 1 ? 'host' : 'hosts'}
            </h1>
            <span
              className="font-mono"
              style={{ fontSize: 13, color: trouble.length > 0 ? 'var(--nw-warm)' : 'var(--nw-accent)' }}
            >
              {trouble.length === 0 ? 'all clear' : `${trouble.length} need attention`}
            </span>
          </div>
        </div>

        {/* KPI strip */}
        <div className="mb-[18px] grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <KpiTile
            label="ONLINE"
            value={hosts.length - offlineCount}
            unit={`/ ${hosts.length}`}
            color={offlineCount > 0 ? 'var(--nw-warm)' : 'var(--nw-accent)'}
            series={statusSeries.online.map(p => p.v)}
            sparkColor={offlineCount > 0 ? 'var(--nw-warm)' : 'var(--nw-accent)'}
            timeSeries={statusSeries.online.length ? statusSeries.online : undefined}
            rangeH={1}
            chartUnit=""
          />
          <KpiTile
            label="CRITICAL"
            value={criticalCount}
            color={criticalCount > 0 ? 'var(--nw-danger)' : 'var(--nw-text-muted)'}
            series={statusSeries.critical.map(p => p.v)}
            sparkColor={criticalCount > 0 ? 'var(--nw-danger)' : 'var(--nw-text-soft)'}
            timeSeries={statusSeries.critical.length ? statusSeries.critical : undefined}
            rangeH={1}
          />
          <KpiTile
            label="WARNING"
            value={warnCount}
            color={warnCount > 0 ? 'var(--nw-warm)' : 'var(--nw-text-muted)'}
            series={statusSeries.warning.map(p => p.v)}
            sparkColor={warnCount > 0 ? 'var(--nw-warm)' : 'var(--nw-text-soft)'}
            timeSeries={statusSeries.warning.length ? statusSeries.warning : undefined}
            rangeH={1}
          />
          <KpiTile
            label="ACTIVE ALERTS"
            value={totalFiring}
            color={totalFiring > 0 ? 'var(--nw-warm)' : 'var(--nw-text-muted)'}
            series={(alertSeries ?? []).map(p => p.v)}
            sparkColor={totalFiring > 0 ? 'var(--nw-warm)' : 'var(--nw-text-soft)'}
            timeSeries={alertSeries && alertSeries.length ? alertSeries : undefined}
            rangeH={1}
          />
          <KpiTile
            label="FLEET RX/TX"
            value={fmtRate(fleetRateNow).split(' ')[0]}
            unit={fmtRate(fleetRateNow).split(' ').slice(1).join(' ')}
            series={fleetRateSeries}
            sparkColor="var(--nw-info)"
            timeSeries={fleetRateTime.length ? fleetRateTime : undefined}
            rangeH={1}
            chartUnit="MB/s"
          />
        </div>

        {/* Top offenders */}
        {trouble.length > 0 && (
          <Panel style={{ marginBottom: 18, padding: 0 }}>
            <div
              className="flex items-center justify-between"
              style={{ padding: '12px 16px', borderBottom: '1px solid var(--nw-border)' }}
            >
              <span className="font-mono font-medium" style={{ fontSize: 12, color: 'var(--nw-text)' }}>
                TOP OFFENDERS
              </span>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>
                worst-first · click to inspect
              </span>
            </div>
            {trouble.map((e, i) => (
              <Link
                key={e.host.id}
                href={`/hosts/${e.host.id}`}
                className="grid items-center font-mono gap-2.5 sm:gap-3.5 [grid-template-columns:14px_1fr] sm:[grid-template-columns:14px_1.5fr_1fr_130px_90px]"
                style={{
                  padding: '10px 16px',
                  borderBottom: i < trouble.length - 1 ? '1px solid var(--nw-line-soft)' : 'none',
                  fontSize: 12,
                }}
              >
                <span style={{ color: statusColor(e.status) }}>●</span>
                <div className="min-w-0 sm:contents">
                  <span className="block sm:inline truncate" style={{ color: 'var(--nw-text)' }}>{e.host.hostname}</span>
                  <span className="block sm:inline truncate" style={{ color: 'var(--nw-text-muted)', fontSize: 11 }}>{e.alert ?? '—'}</span>
                </div>
                <span className="hidden sm:inline truncate" style={{ color: 'var(--nw-text-muted)', fontSize: 11 }}>
                  {e.host.os ? osShort(e.host.os) : '—'}
                </span>
                <span className="hidden sm:inline" style={{ color: 'var(--nw-text-soft)', fontSize: 11, textAlign: 'right' }}>
                  {fmtSecAgo(e.host.last_seen_at)} →
                </span>
              </Link>
            ))}
          </Panel>
        )}

        {/* Filter chips */}
        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono" style={{ fontSize: 11 }}>
          {(['all', 'critical', 'warn', 'healthy', 'offline'] as FilterValue[]).map(f => {
            const isActive = filter === f
            const count = f === 'all' ? enriched.length :
              f === 'critical' ? criticalCount :
              f === 'warn' ? warnCount :
              f === 'healthy' ? enriched.length - trouble.length :
              offlineCount
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
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
                {f} <span style={{ color: 'var(--nw-text-soft)', marginLeft: 4 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Host table */}
        <Panel padding="0" style={{ overflowX: 'auto' }}>
          <div
            className="grid font-mono uppercase"
            style={{
              gridTemplateColumns: '14px 1.4fr 100px 60px 60px 60px 70px 70px 80px 60px',
              gap: 10,
              padding: '10px 14px',
              borderBottom: '1px solid var(--nw-border)',
              fontSize: 10,
              color: 'var(--nw-text-soft)',
              letterSpacing: '0.08em',
              minWidth: 760,
            }}
          >
            <span></span>
            <button onClick={() => setSortKey('name')} style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>HOST</button>
            <span>OS</span>
            <button onClick={() => setSortKey('cpu')} style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>CPU</button>
            <button onClick={() => setSortKey('memPct')} style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>MEM</button>
            <button onClick={() => setSortKey('load1m')} style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>LOAD</button>
            <button onClick={() => setSortKey('latency')} style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>RTT</button>
            <button onClick={() => setSortKey('connections')} style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>CONNS</button>
            <span>TREND</span>
            <span style={{ textAlign: 'right' }}>SEEN</span>
          </div>

          {sorted.length === 0 && (
            <div className="font-mono" style={{ padding: '20px 16px', fontSize: 12, color: 'var(--nw-text-soft)' }}>
              no hosts match this filter
            </div>
          )}

          {sorted.map((e, i) => {
            const offline = e.status === 'offline'
            const baseColor = offline ? 'var(--nw-text-soft)' : 'var(--nw-text)'
            const cpuColor = offline ? 'var(--nw-text-soft)' : thresholdColor(e.m?.cpu ?? null, 60, 80)
            const memColor = offline ? 'var(--nw-text-soft)' : thresholdColor(e.m?.memPct ?? null, 70, 85)
            const rttColor = offline ? 'var(--nw-text-soft)' :
              (e.m?.latency != null && e.m.latency > 20) ? 'var(--nw-warm)' : 'var(--nw-text)'
            const trendColor = statusColor(e.status)
            return (
              <Link
                key={e.host.id}
                href={`/hosts/${e.host.id}`}
                className="grid items-center font-mono transition-colors hover:!bg-[var(--nw-surface-3)]"
                style={{
                  gridTemplateColumns: '14px 1.4fr 100px 60px 60px 60px 70px 70px 80px 60px 24px',
                  gap: 10,
                  padding: '8px 14px',
                  borderBottom: i < sorted.length - 1 ? '1px solid var(--nw-line-soft)' : 'none',
                  fontSize: 11.5,
                  minWidth: 760,
                }}
              >
                <span style={{ color: statusColor(e.status) }}>●</span>
                <span style={{ color: baseColor }}>{e.host.hostname}</span>
                <span style={{ color: 'var(--nw-text-muted)', fontSize: 11 }}>
                  {e.host.os ? osShort(e.host.os) : '—'}
                </span>
                <span style={{ color: cpuColor }}>{offline ? '—' : e.m?.cpu != null ? `${e.m.cpu.toFixed(0)}%` : '—'}</span>
                <span style={{ color: memColor }}>{offline ? '—' : e.m?.memPct != null ? `${e.m.memPct.toFixed(0)}%` : '—'}</span>
                <span style={{ color: baseColor }}>{offline ? '—' : e.m?.load1m != null ? e.m.load1m.toFixed(2) : '—'}</span>
                <span style={{ color: rttColor }}>{offline ? '—' : e.m?.latency != null ? `${e.m.latency.toFixed(0)}ms` : '—'}</span>
                <span style={{ color: 'var(--nw-text-muted)' }}>{offline ? '—' : e.m?.connections ?? '—'}</span>
                <div className="h-[18px] overflow-hidden">
                  {!offline && e.m?.cpuHistory && e.m.cpuHistory.length > 0 && (
                    <Sparkline data={e.m.cpuHistory} color={trendColor} height={18} fill={false} strokeWidth={1.1} />
                  )}
                </div>
                <span style={{ color: 'var(--nw-text-soft)', fontSize: 11, textAlign: 'right' }}>
                  {fmtSecAgo(e.host.last_seen_at)}
                </span>
                {onRemove ? (
                  <button
                    onClick={ev => { ev.preventDefault(); ev.stopPropagation(); onRemove(e.host) }}
                    title="Remove host"
                    aria-label={`Remove ${e.host.hostname}`}
                    style={{ color: 'var(--nw-text-soft)', textAlign: 'right', lineHeight: 1 }}
                    className="transition-colors hover:!text-[var(--nw-danger,#f87171)]"
                  >
                    ✕
                  </button>
                ) : <span />}
              </Link>
            )
          })}
        </Panel>
      </div>
    </div>
  )
}

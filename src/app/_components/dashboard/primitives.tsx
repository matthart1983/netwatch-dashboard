'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { MetricPoint } from '@/lib/api'

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = 'var(--nw-accent)',
  fill = true,
  strokeWidth = 1.4,
}: {
  data: (number | null)[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  strokeWidth?: number
}) {
  const clean = data.filter((v): v is number => v != null && Number.isFinite(v))
  if (clean.length === 0) return null
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const range = Math.max(max - min, 0.001)
  const norm = clean.map(v => (v - min) / range)
  const pts = norm.map((v, i) => [(i / (norm.length - 1 || 1)) * width, height - v * (height - 2) - 1])
  const d = pts.map((p, i) => (i === 0 ? `M${p[0].toFixed(1)},${p[1].toFixed(1)}` : `L${p[0].toFixed(1)},${p[1].toFixed(1)}`)).join(' ')
  const fillD = `${d} L${width},${height} L0,${height} Z`
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block">
      {fill && <path d={fillD} fill={color} fillOpacity="0.10" />}
      <path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function KpiTile({
  label,
  value,
  unit,
  color = 'var(--nw-text)',
  series,
  sparkColor,
  timeSeries,
  rangeH = 24,
  chartUnit,
}: {
  label: string
  value: ReactNode
  unit?: string
  color?: string
  series?: (number | null)[]
  sparkColor?: string
  timeSeries?: TimePoint[]
  rangeH?: number
  chartUnit?: string
}) {
  const [full, setFull] = useState(false)
  const expandable = !!timeSeries && timeSeries.some(s => s.v != null)
  const latest = expandable ? timeSeries!.reduce<number | null>((acc, s) => (s.v != null ? s.v : acc), null) : null
  return (
    <>
      <div
        className="relative min-w-0 flex-1 overflow-hidden font-mono"
        style={{
          background: 'linear-gradient(180deg, var(--nw-surface-2) 0%, var(--nw-bg-elevated) 100%)',
          border: '1px solid var(--nw-border)',
          borderRadius: 8,
          padding: '14px 16px 8px',
        }}
      >
        <div className="mb-1 flex items-baseline justify-between">
          <div style={{ fontSize: 10, color: 'var(--nw-text-soft)', letterSpacing: '0.08em' }}>{label}</div>
          {expandable && (
            <button
              onClick={() => setFull(true)}
              title="Expand to fullscreen"
              aria-label={`Expand ${label} chart`}
              className="transition-colors hover:!text-[var(--nw-text)]"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--nw-text-soft)', fontSize: 12, lineHeight: 1, padding: 0 }}
            >
              ⛶
            </button>
          )}
        </div>
        <div className="mb-2 flex items-baseline gap-1">
          <span className="font-medium" style={{ fontSize: 24, color, letterSpacing: '-0.02em' }}>{value}</span>
          {unit && <span style={{ fontSize: 11, color: 'var(--nw-text-soft)' }}>{unit}</span>}
        </div>
        {series && series.length > 0 && (
          <div className="-mx-4 -mb-2">
            <Sparkline data={series} color={sparkColor || color} height={28} fill />
          </div>
        )}
      </div>
      {full && timeSeries && (
        <ChartOverlay label={label} series={timeSeries} color={sparkColor || color} unit={chartUnit ?? unit} rangeH={rangeH} latest={latest} onClose={() => setFull(false)} />
      )}
    </>
  )
}

export function Panel({ children, padding = '14px 16px', style }: { children: ReactNode; padding?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--nw-bg-elevated)',
        border: '1px solid var(--nw-border)',
        borderRadius: 8,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function TabStrip({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div
      className="flex font-mono overflow-x-auto"
      style={{ gap: 4, borderBottom: '1px solid var(--nw-border)', padding: '0 4px', scrollbarWidth: 'thin' }}
    >
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="inline-flex shrink-0 items-center gap-2 transition-colors"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? 'var(--nw-accent)' : 'transparent'}`,
              padding: '12px 14px',
              fontSize: 12,
              color: isActive ? 'var(--nw-text)' : 'var(--nw-text-muted)',
              cursor: 'pointer',
              marginBottom: -1,
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {tab.label}
            {tab.count != null && (
              <span style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function statusColor(status: 'healthy' | 'warn' | 'critical' | 'offline'): string {
  if (status === 'offline' || status === 'critical') return 'var(--nw-danger)'
  if (status === 'warn') return 'var(--nw-warm)'
  return 'var(--nw-accent)'
}

export function thresholdColor(value: number | null, warn: number, crit: number): string {
  if (value == null) return 'var(--nw-text-soft)'
  if (value >= crit) return 'var(--nw-danger)'
  if (value >= warn) return 'var(--nw-warm)'
  return 'var(--nw-text)'
}

// ── Time-series chart card + fullscreen detail view ──────────────────────────

export interface TimePoint { t: number; v: number | null }

export function mkSeries(points: MetricPoint[], accessor: (p: MetricPoint) => number | null): TimePoint[] {
  return points.map(p => ({ t: new Date(p.time).getTime(), v: accessor(p) }))
}

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return v.toString()
  const a = Math.abs(v)
  if (a >= 100) return v.toFixed(0)
  if (a >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

function fmtAxisTick(t: number, rangeH: number): string {
  const d = new Date(t)
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return rangeH > 48 ? `${d.getMonth() + 1}/${d.getDate()} ${hm}` : hm
}

function fmtTooltipTime(t: number | undefined): string {
  if (t == null) return '—'
  return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function genTicks(series: TimePoint[], n: number): number[] {
  if (series.length === 0) return []
  const t0 = series[0].t
  const t1 = series[series.length - 1].t
  if (t1 <= t0) return [t0]
  return Array.from({ length: n }, (_, i) => Math.round(t0 + ((t1 - t0) * i) / (n - 1)))
}

const TOOLTIP_STYLE = { background: 'var(--nw-surface-2)', border: '1px solid var(--nw-line-hard)', fontSize: 11, fontFamily: 'var(--font-mono)', borderRadius: 6 } as const

export function ChartCard({ label, series, color, unit, rangeH }: { label: string; series: TimePoint[]; color: string; unit?: string; rangeH: number }) {
  const [full, setFull] = useState(false)
  const vals = series.map(s => s.v).filter((v): v is number => v != null && Number.isFinite(v))
  const hasData = vals.length > 0
  const latest = hasData ? vals[vals.length - 1] : null
  const trend = hasData && vals.length > 1
    ? (vals[vals.length - 1] > vals[0] ? '↑' : vals[vals.length - 1] < vals[0] ? '↓' : '→')
    : '→'
  const ticks = genTicks(series, 3)

  return (
    <>
      <Panel padding="12px 14px 10px">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--nw-text-soft)', letterSpacing: '0.08em' }}>
            {label}
          </span>
          <div className="flex items-center gap-2.5">
            {latest != null && (
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>{fmtNum(latest)}{unit ?? ''}</span>
            )}
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--nw-text-soft)' }}>{trend}</span>
            <button
              onClick={() => setFull(true)}
              title="Expand to fullscreen"
              aria-label={`Expand ${label} chart`}
              className="transition-colors hover:!text-[var(--nw-text)]"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--nw-text-soft)', fontSize: 13, lineHeight: 1, padding: 0 }}
            >
              ⛶
            </button>
          </div>
        </div>
        <div style={{ height: 96 }}>
          {!hasData ? (
            <div className="flex h-full items-center justify-center font-mono" style={{ fontSize: 11, color: 'var(--nw-text-soft)' }}>
              no data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 4, right: 6, bottom: 2, left: 4 }}>
                <CartesianGrid stroke="var(--nw-line-soft)" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="t" type="number" domain={['dataMin', 'dataMax']} ticks={ticks}
                  tickFormatter={(t) => fmtAxisTick(t as number, rangeH)}
                  tick={{ fontSize: 9, fill: 'var(--nw-text-faint)', fontFamily: 'var(--font-mono)' }}
                  tickLine={false} axisLine={{ stroke: 'var(--nw-line-hard)' }} minTickGap={24}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: 'var(--nw-text-soft)' }}
                  labelFormatter={(t) => fmtTooltipTime(t as number)}
                  formatter={(v) => [typeof v === 'number' ? fmtNum(v) + (unit ?? '') : String(v ?? ''), label]}
                />
                <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.4} dot={false} isAnimationActive={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>
      {full && (
        <ChartOverlay label={label} series={series} color={color} unit={unit} rangeH={rangeH} latest={latest} onClose={() => setFull(false)} />
      )}
    </>
  )
}

function ChartOverlay({ label, series, color, unit, rangeH, latest, onClose }: {
  label: string; series: TimePoint[]; color: string; unit?: string; rangeH: number; latest: number | null; onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const ticks = genTicks(series, 9)
  const first = series[0]?.t
  const last = series[series.length - 1]?.t

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(2px)', padding: 24 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="font-mono flex flex-col"
        style={{ width: 'min(1200px, 95vw)', height: 'min(720px, 88vh)', background: 'var(--nw-bg-elevated)', border: '1px solid var(--nw-border)', borderRadius: 10, overflow: 'hidden' }}
      >
        <div className="flex items-center justify-between" style={{ padding: '14px 20px', borderBottom: '1px solid var(--nw-border)' }}>
          <div className="flex items-baseline gap-3">
            <span className="uppercase font-medium" style={{ fontSize: 13, letterSpacing: '0.06em', color: 'var(--nw-text)' }}>{label}</span>
            {latest != null && (
              <span style={{ fontSize: 22, color, letterSpacing: '-0.02em' }}>
                {fmtNum(latest)}<span style={{ fontSize: 12, color: 'var(--nw-text-soft)' }}>{unit ?? ''}</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close fullscreen"
            className="transition-colors hover:!text-[var(--nw-text)]"
            style={{ background: 'transparent', border: '1px solid var(--nw-border)', borderRadius: 5, cursor: 'pointer', color: 'var(--nw-text-soft)', fontSize: 11, padding: '5px 10px' }}
          >
            ✕ esc
          </button>
        </div>
        <div className="flex-1" style={{ padding: '18px 18px 10px' }}>
          {series.length === 0 ? (
            <div className="flex h-full items-center justify-center" style={{ fontSize: 12, color: 'var(--nw-text-soft)' }}>no data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 18, bottom: 22, left: 6 }}>
                <CartesianGrid stroke="var(--nw-line-soft)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="t" type="number" domain={['dataMin', 'dataMax']} ticks={ticks}
                  tickFormatter={(t) => fmtAxisTick(t as number, rangeH)}
                  tick={{ fontSize: 11, fill: 'var(--nw-text-muted)', fontFamily: 'var(--font-mono)' }}
                  tickLine={{ stroke: 'var(--nw-line-hard)' }} axisLine={{ stroke: 'var(--nw-line-hard)' }} minTickGap={40}
                />
                <YAxis
                  width={50} domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: 'var(--nw-text-muted)', fontFamily: 'var(--font-mono)' }}
                  tickLine={false} axisLine={false} tickFormatter={(v) => fmtNum(v as number)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: 'var(--nw-text-soft)' }}
                  labelFormatter={(t) => fmtTooltipTime(t as number)}
                  formatter={(v) => [typeof v === 'number' ? fmtNum(v) + (unit ?? '') : String(v ?? ''), label]}
                />
                <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex items-center justify-between" style={{ padding: '10px 20px', borderTop: '1px solid var(--nw-border)', fontSize: 10, color: 'var(--nw-text-soft)' }}>
          <span>{series.length} samples · {fmtTooltipTime(first)} → {fmtTooltipTime(last)}</span>
          <span>window: last {rangeH}h · hover for exact values</span>
        </div>
      </div>
    </div>
  )
}

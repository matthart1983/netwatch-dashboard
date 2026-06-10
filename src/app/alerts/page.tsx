'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import {
  getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule,
  getAlertHistory, ackAlertEvent, AlertRule, AlertEvent
} from '@/lib/api'
import { TermStat } from '../_components/terminal'
import { DashboardChrome, TopBar } from '../_components/DashboardChrome'

const METRICS = [
  { value: 'host_status', label: 'Host Status', type: 'status' },
  { value: 'interface_status', label: 'Interface Status', type: 'status' },
  { value: 'gateway_rtt_ms', label: 'Gateway Latency (ms)', type: 'numeric' },
  { value: 'gateway_loss_pct', label: 'Gateway Packet Loss (%)', type: 'numeric' },
  { value: 'dns_rtt_ms', label: 'DNS Latency (ms)', type: 'numeric' },
  { value: 'dns_loss_pct', label: 'DNS Packet Loss (%)', type: 'numeric' },
  { value: 'connection_count', label: 'Connection Count', type: 'numeric' },
  { value: 'cpu_usage_pct', label: 'CPU Usage (%)', type: 'numeric' },
  { value: 'swap_used_bytes', label: 'Swap Used (bytes)', type: 'numeric' },
  { value: 'disk_usage_pct', label: 'Disk Usage (%)', type: 'numeric' },
  { value: 'disk_read_bytes', label: 'Disk Read (bytes)', type: 'numeric' },
  { value: 'disk_write_bytes', label: 'Disk Write (bytes)', type: 'numeric' },
  { value: 'tcp_time_wait', label: 'TCP TIME_WAIT Count', type: 'numeric' },
  { value: 'tcp_close_wait', label: 'TCP CLOSE_WAIT Count', type: 'numeric' },
]

export default function AlertsPage() {
  const { token, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [rules, setRules] = useState<AlertRule[]>([])
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [tab, setTab] = useState<'rules' | 'history'>('rules')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<'all' | 'firing' | 'resolved'>('all')

  const [formName, setFormName] = useState('')
  const [formMetric, setFormMetric] = useState('gateway_loss_pct')
  const [formCondition, setFormCondition] = useState('>')
  const [formThreshold, setFormThreshold] = useState('5')
  const [formDuration, setFormDuration] = useState('60')
  const [formSeverity, setFormSeverity] = useState('warning')

  useEffect(() => {
    if (authLoading) return
    if (!token) { router.push('/login'); return }
    loadData()
  }, [authLoading, token, router])

  async function loadData() {
    try {
      const [r, e] = await Promise.all([getAlertRules(), getAlertHistory()])
      setRules(r)
      setEvents(e)
    } catch {
      // handled by auth redirect
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const metricDef = METRICS.find(m => m.value === formMetric)
    const isStatus = metricDef?.type === 'status'

    await createAlertRule({
      name: formName || `${metricDef?.label} alert`,
      metric: formMetric,
      condition: isStatus ? 'changes_to' : formCondition,
      threshold: isStatus ? undefined : parseFloat(formThreshold),
      threshold_str: isStatus ? (formMetric === 'host_status' ? 'offline' : 'down') : undefined,
      duration_secs: parseInt(formDuration),
      severity: formSeverity,
    })

    setShowForm(false)
    setFormName('')
    loadData()
  }

  async function handleToggle(rule: AlertRule) {
    await updateAlertRule(rule.id, { enabled: !rule.enabled })
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this alert rule?')) return
    await deleteAlertRule(id)
    loadData()
  }

  if (authLoading || loading) return <div className="mt-10 font-mono text-[13px]" style={{ color: 'var(--nw-text-soft)' }}>loading alerts…</div>

  return (
    <DashboardChrome>
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar crumbs={[{ label: 'Alerts' }]} />
        <div className="flex-1 overflow-auto space-y-7" style={{ padding: '20px 22px' }}>
          <div>
            <div className="font-mono uppercase mb-1.5" style={{ fontSize: 11, color: 'var(--nw-text-soft)', letterSpacing: '0.08em' }}>ALERTING · CONTROL PLANE</div>
            <h1 className="m-0 font-mono font-medium" style={{ fontSize: 30, letterSpacing: '-0.02em', color: 'var(--nw-text)' }}>Alerts</h1>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <TermStat label="rules" value={rules.length} />
            <TermStat label="events" value={events.length} />
            <TermStat label="enabled" value={rules.filter(rule => rule.enabled).length} accent />
          </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => setTab('rules')} className="nw-tab" data-active={tab === 'rules'}>
          Rules ({rules.length})
        </button>
        <button onClick={() => setTab('history')} className="nw-tab" data-active={tab === 'history'}>
          Event history ({events.length})
        </button>
      </div>

      {tab === 'rules' && (
        <div className="space-y-4">
          <div className="grid gap-3">
            {rules.length === 0 && !showForm && (
              <div className="nw-empty-state">
                <h2 className="text-lg font-semibold">No alert rules yet</h2>
                <p className="mt-2 text-sm leading-7 nw-muted">
                  Start with one high-signal rule like gateway loss, host offline, or elevated CPU to make the system feel useful immediately.
                </p>
              </div>
            )}
            {rules.map(rule => (
              <div key={rule.id} className="nw-panel p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        rule.severity === 'critical' ? 'bg-red-500/12 text-red-300' :
                        rule.severity === 'warning' ? 'bg-amber-400/12 text-amber-200' :
                        'bg-sky-400/12 text-sky-200'
                      }`}>
                        {rule.severity}
                      </span>
                      <span className={`text-base font-semibold ${rule.enabled ? 'text-[var(--nw-text)]' : 'text-[var(--nw-text-soft)]'}`}>
                        {rule.name}
                      </span>
                    </div>
                    <p className="text-sm nw-muted">
                      {rule.metric} {rule.condition} {rule.threshold ?? rule.threshold_str} · {rule.duration_secs}s window · {rule.host_id ? 'specific host' : 'all hosts'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                        rule.enabled
                          ? 'bg-[rgba(159,232,180,0.14)] text-[#cdf0d7]'
                          : 'bg-white/6 text-[var(--nw-text-muted)]'
                      }`}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button onClick={() => handleDelete(rule.id)} className="nw-button-ghost px-4 py-2 text-xs">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showForm ? (
            <form onSubmit={handleCreate} className="nw-panel p-5 sm:p-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--nw-text-soft)]">New rule</p>
                <h2 className="text-xl font-semibold">Define alert conditions</h2>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium nw-muted">Name</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="High gateway loss" className="nw-input" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium nw-muted">Metric</label>
                  <select value={formMetric} onChange={e => setFormMetric(e.target.value)} className="nw-input">
                    {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                {METRICS.find(m => m.value === formMetric)?.type === 'numeric' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium nw-muted">Threshold</label>
                    <div className="grid grid-cols-[92px_1fr] gap-3">
                      <select value={formCondition} onChange={e => setFormCondition(e.target.value)} className="nw-input">
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                      </select>
                      <input type="number" step="any" value={formThreshold} onChange={e => setFormThreshold(e.target.value)} className="nw-input" />
                    </div>
                  </div>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium nw-muted">Duration (seconds)</label>
                  <input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)} className="nw-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium nw-muted">Severity</label>
                  <select value={formSeverity} onChange={e => setFormSeverity(e.target.value)} className="nw-input">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="submit" className="nw-button-primary">Create rule</button>
                <button type="button" onClick={() => setShowForm(false)} className="nw-button-ghost">Cancel</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} className="nw-button-primary">
              New alert rule
            </button>
          )}
        </div>
      )}

      {tab === 'history' && (() => {
        const q = search.trim().toLowerCase()
        const filteredEvents = events.filter(e => {
          if (stateFilter !== 'all' && e.state !== stateFilter) return false
          if (q && !e.message.toLowerCase().includes(q)) return false
          return true
        })
        const firingCount = events.filter(e => e.state === 'firing').length
        const dismiss = async (id: number) => {
          try {
            await ackAlertEvent(id)
            setEvents(prev => prev.filter(e => e.id !== id))  // dismissed → gone
          } catch { /* ignore — row stays as-is */ }
        }
        const clearShown = async () => {
          const ids = filteredEvents.map(e => e.id)
          if (ids.length === 0) return
          if (!window.confirm(`Dismiss ${ids.length} shown alert${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
          await Promise.all(ids.map(id => ackAlertEvent(id).catch(() => {})))
          setEvents(prev => prev.filter(e => !ids.includes(e.id)))
        }
        return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 min-w-[200px] max-w-md bg-white/4 border border-white/10 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:nw-subtle focus:outline-none focus:border-[var(--nw-accent)]"
            />
            <div className="flex items-center gap-1.5">
              <button onClick={() => setStateFilter('all')} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${stateFilter === 'all' ? 'bg-[rgba(159,232,180,0.15)] border-[rgba(159,232,180,0.35)] text-[var(--nw-text)]' : 'bg-white/4 border-white/10 text-[var(--nw-text-muted)] hover:text-[var(--nw-text)]'}`}>All ({events.length})</button>
              <button onClick={() => setStateFilter('firing')} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${stateFilter === 'firing' ? 'bg-red-500/20 border-red-500/30 text-red-200' : 'bg-white/4 border-white/10 text-[var(--nw-text-muted)] hover:text-[var(--nw-text)]'}`}>Firing ({firingCount})</button>
              <button onClick={() => setStateFilter('resolved')} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${stateFilter === 'resolved' ? 'bg-[rgba(159,232,180,0.15)] border-[rgba(159,232,180,0.35)] text-[var(--nw-text)]' : 'bg-white/4 border-white/10 text-[var(--nw-text-muted)] hover:text-[var(--nw-text)]'}`}>Resolved ({events.length - firingCount})</button>
            </div>
            <span className="text-xs nw-subtle tabular-nums">
              {filteredEvents.length === events.length ? `${events.length} events` : `${filteredEvents.length} of ${events.length}`}
            </span>
            {filteredEvents.length > 0 && (
              <button onClick={clearShown} className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-xs text-[var(--nw-text-muted)] transition-colors hover:!text-[var(--nw-text)] hover:border-white/20">
                Clear {stateFilter === 'all' ? 'all' : stateFilter} ({filteredEvents.length})
              </button>
            )}
          </div>
          <div className="grid gap-3">
          {filteredEvents.length === 0 ? (
            <div className="nw-empty-state">
              <h2 className="text-lg font-semibold">{events.length === 0 ? 'No alert events yet' : 'No matches'}</h2>
              <p className="mt-2 text-sm leading-7 nw-muted">
                {events.length === 0
                  ? 'Once rules fire or resolve, the event stream will give you a clean timeline of what changed and when.'
                  : 'Adjust your search or state filter.'}
              </p>
            </div>
          ) : (
            filteredEvents.map(event => (
              <div key={event.id} className="nw-panel p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${event.state === 'firing' ? 'bg-red-400' : 'bg-[var(--nw-accent)]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--nw-text)]">{event.message}</div>
                    <div className="mt-1 text-xs nw-subtle">{new Date(event.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => dismiss(event.id)}
                      className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[11px] font-medium text-[var(--nw-text-muted)] transition-colors hover:text-[var(--nw-text)] hover:border-white/20"
                    >
                      Dismiss
                    </button>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${event.state === 'firing' ? 'bg-red-500/12 text-red-300' : 'bg-[rgba(159,232,180,0.14)] text-[#cdf0d7]'}`}>
                      {event.state}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
          </div>
        </div>
        )
      })()}
        </div>
      </div>
    </DashboardChrome>
  )
}

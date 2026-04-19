'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import {
  getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule,
  getAlertHistory, AlertRule, AlertEvent
} from '@/lib/api'

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

  if (authLoading || loading) return <div className="mt-10 nw-muted">Loading alerts...</div>

  return (
    <div className="space-y-8">
      <section className="nw-card rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="nw-kicker">Alerting control plane</span>
            <div>
              <h1 className="nw-section-title">Alert rules that stay sharp under pressure.</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 nw-muted">
                Manage the signals that matter, tighten response noise, and keep the incident trail readable for the whole team.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Rules</div>
              <div className="mt-2 text-2xl font-semibold">{rules.length}</div>
            </div>
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Events</div>
              <div className="mt-2 text-2xl font-semibold">{events.length}</div>
            </div>
            <div className="nw-stat-card">
              <div className="text-xs uppercase tracking-[0.18em] nw-subtle">Enabled</div>
              <div className="mt-2 text-2xl font-semibold">{rules.filter(rule => rule.enabled).length}</div>
            </div>
          </div>
        </div>
      </section>

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
              <div key={rule.id} className="nw-card-hover rounded-[1.25rem] p-4 sm:p-5">
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
                          ? 'bg-[rgba(61,214,198,0.14)] text-[#bffff8]'
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
            <form onSubmit={handleCreate} className="nw-card rounded-[1.5rem] p-5 sm:p-6 space-y-4">
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

      {tab === 'history' && (
        <div className="grid gap-3">
          {events.length === 0 ? (
            <div className="nw-empty-state">
              <h2 className="text-lg font-semibold">No alert events yet</h2>
              <p className="mt-2 text-sm leading-7 nw-muted">
                Once rules fire or resolve, the event stream will give you a clean timeline of what changed and when.
              </p>
            </div>
          ) : (
            events.map(event => (
              <div key={event.id} className="nw-card rounded-[1.25rem] p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${event.state === 'firing' ? 'bg-red-400' : 'bg-[var(--nw-accent)]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--nw-text)]">{event.message}</div>
                    <div className="mt-1 text-xs nw-subtle">{new Date(event.created_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${event.state === 'firing' ? 'bg-red-500/12 text-red-300' : 'bg-[rgba(61,214,198,0.14)] text-[#bffff8]'}`}>
                    {event.state}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

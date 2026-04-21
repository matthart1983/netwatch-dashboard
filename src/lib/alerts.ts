import { getDb } from './db'

export interface AlertRule {
  id: string
  host_id: string | null
  name: string
  metric: string
  condition: string
  threshold: number | null
  threshold_str: string | null
  duration_secs: number
  severity: string
  enabled: boolean
  created_at: string
}

interface AlertRuleRow {
  id: string
  host_id: string | null
  name: string
  metric: string
  condition: string
  threshold: number | null
  threshold_str: string | null
  duration_secs: number
  severity: string
  enabled: number
  created_at: string
}

function rowToRule(r: AlertRuleRow): AlertRule {
  return { ...r, enabled: r.enabled === 1 }
}

export function listRules(): AlertRule[] {
  const rows = getDb().prepare(`
    SELECT id, host_id, name, metric, condition, threshold, threshold_str,
           duration_secs, severity, enabled, created_at
    FROM alert_rules
    ORDER BY created_at DESC
  `).all() as AlertRuleRow[]
  return rows.map(rowToRule)
}

export function getRule(id: string): AlertRule | null {
  const row = getDb().prepare(`
    SELECT id, host_id, name, metric, condition, threshold, threshold_str,
           duration_secs, severity, enabled, created_at
    FROM alert_rules WHERE id = ?
  `).get(id) as AlertRuleRow | undefined
  return row ? rowToRule(row) : null
}

export interface CreateRuleInput {
  name: string
  metric: string
  condition: string
  threshold?: number | null
  threshold_str?: string | null
  duration_secs?: number
  severity?: string
  host_id?: string | null
}

export function createRule(input: CreateRuleInput): AlertRule {
  const id = crypto.randomUUID()
  getDb().prepare(`
    INSERT INTO alert_rules (id, host_id, name, metric, condition, threshold, threshold_str, duration_secs, severity, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    input.host_id ?? null,
    input.name,
    input.metric,
    input.condition,
    input.threshold ?? null,
    input.threshold_str ?? null,
    input.duration_secs ?? 0,
    input.severity ?? 'warning',
  )
  return getRule(id)!
}

export interface UpdateRuleInput {
  enabled?: boolean
  threshold?: number
  duration_secs?: number
  severity?: string
}

export function updateRule(id: string, patch: UpdateRuleInput): boolean {
  const fields: string[] = []
  const values: unknown[] = []
  if (patch.enabled !== undefined) { fields.push('enabled = ?'); values.push(patch.enabled ? 1 : 0) }
  if (patch.threshold !== undefined) { fields.push('threshold = ?'); values.push(patch.threshold) }
  if (patch.duration_secs !== undefined) { fields.push('duration_secs = ?'); values.push(patch.duration_secs) }
  if (patch.severity !== undefined) { fields.push('severity = ?'); values.push(patch.severity) }
  if (fields.length === 0) return true
  values.push(id)
  const info = getDb().prepare(`UPDATE alert_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values as [])
  return info.changes > 0
}

export function deleteRule(id: string): boolean {
  const info = getDb().prepare('DELETE FROM alert_rules WHERE id = ?').run(id)
  return info.changes > 0
}

export interface AlertEvent {
  id: number
  rule_id: string
  host_id: string
  state: string
  metric_value: number | null
  message: string
  created_at: string
}

const NUMERIC_METRICS = new Set([
  'gateway_rtt_ms', 'gateway_loss_pct', 'dns_rtt_ms', 'dns_loss_pct',
  'connection_count', 'cpu_usage_pct', 'swap_used_bytes', 'disk_usage_pct',
  'disk_read_bytes', 'disk_write_bytes', 'tcp_time_wait', 'tcp_close_wait',
])

function compare(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case '>': return value > threshold
    case '<': return value < threshold
    case '>=': return value >= threshold
    case '<=': return value <= threshold
    case '==': return value === threshold
    case '!=': return value !== threshold
    default: return false
  }
}

type HotRow = Record<string, number | null>

export function evaluateRulesForSnapshot(hostId: string, hotRow: HotRow): void {
  const db = getDb()
  const rules = db.prepare(`
    SELECT id, host_id, name, metric, condition, threshold, severity, current_state
    FROM alert_rules
    WHERE enabled = 1 AND (host_id IS NULL OR host_id = ?)
  `).all(hostId) as Array<{
    id: string; host_id: string | null; name: string; metric: string;
    condition: string; threshold: number | null; severity: string; current_state: string;
  }>

  if (rules.length === 0) return

  const updateState = db.prepare(`
    UPDATE alert_rules SET current_state = ?, last_evaluated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?
  `)
  const insertEvent = db.prepare(`
    INSERT INTO alert_events (rule_id, host_id, state, metric_value, message)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const rule of rules) {
    if (!NUMERIC_METRICS.has(rule.metric)) continue
    if (rule.threshold == null) continue
    const value = hotRow[rule.metric]
    if (value == null) continue

    const firing = compare(value, rule.condition, rule.threshold)
    const nextState = firing ? 'firing' : 'ok'
    if (nextState === rule.current_state) continue

    const message = firing
      ? `${rule.name}: ${rule.metric}=${value} ${rule.condition} ${rule.threshold}`
      : `${rule.name}: resolved (${rule.metric}=${value})`
    insertEvent.run(rule.id, hostId, nextState, value, message)
    updateState.run(nextState, rule.id)
  }
}

export function listEvents(hostId?: string): AlertEvent[] {
  const db = getDb()
  if (hostId) {
    return db.prepare(`
      SELECT id, rule_id, host_id, state, metric_value, message, created_at
      FROM alert_events WHERE host_id = ? ORDER BY created_at DESC LIMIT 500
    `).all(hostId) as AlertEvent[]
  }
  return db.prepare(`
    SELECT id, rule_id, host_id, state, metric_value, message, created_at
    FROM alert_events ORDER BY created_at DESC LIMIT 500
  `).all() as AlertEvent[]
}

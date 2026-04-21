import { SOURCE_BASE_URL, SOURCE_KIND, getToken } from './source'

export async function fetchAPI(path: string, options: RequestInit = {}) {
  const token = getToken()

  const res = await fetch(`${SOURCE_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    if (SOURCE_KIND === 'core' && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `API error: ${res.status}`)
  }

  if (res.status === 204) return null
  const text = await res.text()
  if (!text) return null
  return JSON.parse(text)
}

export async function register(email: string, password: string) {
  const data = await fetchAPI('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return data as { account_id: string; api_key: string; access_token: string; refresh_token: string }
}

export async function login(email: string, password: string) {
  const data = await fetchAPI('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return data as { access_token: string; refresh_token: string; account_id: string }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await fetchAPI('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await fetchAPI('/api/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export interface Host {
  id: string
  hostname: string
  os: string | null
  kernel: string | null
  agent_version: string | null
  is_online: boolean
  last_seen_at: string
  uptime_secs: number | null
  cpu_model: string | null
  cpu_cores: number | null
  memory_total_bytes: number | null
}

export async function getHosts(): Promise<Host[]> {
  return fetchAPI('/api/v1/hosts')
}

export async function getHost(id: string): Promise<Host> {
  return fetchAPI(`/api/v1/hosts/${id}`)
}

export interface MetricPoint {
  time: string
  gateway_rtt_ms: number | null
  gateway_loss_pct: number | null
  dns_rtt_ms: number | null
  dns_loss_pct: number | null
  connection_count: number | null
  cpu_usage_pct: number | null
  memory_used_bytes: number | null
  memory_available_bytes: number | null
  load_avg_1m: number | null
  load_avg_5m: number | null
  load_avg_15m: number | null
  swap_total_bytes: number | null
  swap_used_bytes: number | null
  disk_read_bytes: number | null
  disk_write_bytes: number | null
  disk_usage_pct: number | null
  tcp_time_wait: number | null
  tcp_close_wait: number | null
  net_rx_bytes: number | null
  net_tx_bytes: number | null
  net_rx_rate_bps: number | null
  net_tx_rate_bps: number | null
  cpu_per_core: number[] | null
}

export interface MetricsResponse {
  host_id: string
  from: string
  to: string
  points: MetricPoint[]
}

export async function getMetrics(hostId: string, from?: string, to?: string): Promise<MetricsResponse> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString() ? `?${params.toString()}` : ''
  return fetchAPI(`/api/v1/hosts/${hostId}/metrics${query}`)
}

export type AgentAlertSeverity = 'warning' | 'critical'
export type AgentAlertCategory = 'port_scan' | 'beaconing' | 'dns_tunnel' | 'bandwidth'

export interface AgentAlert {
  id: number
  time: string
  severity: AgentAlertSeverity
  category: AgentAlertCategory
  message: string
  detail: string
}

export interface ProcessRow {
  process_name: string
  pid: number | null
  rx_bytes: number
  tx_bytes: number
  rx_rate_bps: number
  tx_rate_bps: number
  connection_count: number
}

export interface ProcessesResponse {
  time: string | null
  processes: ProcessRow[]
}

export async function getProcesses(hostId: string): Promise<ProcessesResponse> {
  return fetchAPI(`/api/v1/hosts/${hostId}/processes`)
}

export interface ConnectionRow {
  protocol: string
  local_addr: string
  remote_addr: string
  state: string
  pid: number | null
  process_name: string | null
  kernel_rtt_us: number | null
}

export interface ConnectionsResponse {
  time: string | null
  connections: ConnectionRow[]
}

export async function getConnections(hostId: string): Promise<ConnectionsResponse> {
  return fetchAPI(`/api/v1/hosts/${hostId}/connections`)
}

export interface DnsTopDomain {
  name: string
  count: number
}

export interface DnsAnalytics {
  time: string | null
  total_queries: number
  total_responses: number
  nxdomain_count: number
  /// 8 buckets: <5ms, <10ms, <25ms, <50ms, <100ms, <250ms, <500ms, ≥500ms
  latency_buckets: number[]
  top_domains: DnsTopDomain[]
}

export async function getDnsAnalytics(hostId: string): Promise<DnsAnalytics> {
  return fetchAPI(`/api/v1/hosts/${hostId}/dns-analytics`)
}

export async function getAgentAlerts(hostId: string, from?: string, to?: string): Promise<AgentAlert[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString() ? `?${params.toString()}` : ''
  return fetchAPI(`/api/v1/hosts/${hostId}/agent-alerts${query}`)
}

export interface ApiKeyInfo {
  id: string
  key_prefix: string
  label: string | null
  created_at: string
  last_used_at: string | null
}

export async function getApiKeys(): Promise<ApiKeyInfo[]> {
  return fetchAPI('/api/v1/account/api-keys')
}

export async function createApiKey(): Promise<{ id: string; api_key: string }> {
  return fetchAPI('/api/v1/account/api-keys', { method: 'POST' })
}

export async function deleteApiKey(id: string): Promise<void> {
  await fetchAPI(`/api/v1/account/api-keys/${id}`, { method: 'DELETE' })
}

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

export interface AlertEvent {
  id: number
  rule_id: string
  host_id: string
  state: string
  metric_value: number | null
  message: string
  created_at: string
}

export async function getAlertRules(): Promise<AlertRule[]> {
  return fetchAPI('/api/v1/alerts/rules')
}

export async function createAlertRule(rule: {
  name: string
  metric: string
  condition: string
  threshold?: number
  threshold_str?: string
  duration_secs?: number
  severity?: string
  host_id?: string
}): Promise<AlertRule> {
  return fetchAPI('/api/v1/alerts/rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  })
}

export async function updateAlertRule(id: string, update: {
  enabled?: boolean
  threshold?: number
  duration_secs?: number
  severity?: string
}): Promise<void> {
  await fetchAPI(`/api/v1/alerts/rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(update),
  })
}

export async function deleteAlertRule(id: string): Promise<void> {
  await fetchAPI(`/api/v1/alerts/rules/${id}`, { method: 'DELETE' })
}

export async function getAlertHistory(hostId?: string): Promise<AlertEvent[]> {
  const params = hostId ? `?host_id=${hostId}` : ''
  return fetchAPI(`/api/v1/alerts/history${params}`)
}

export interface AccountInfo {
  email: string
  created_at: string
  plan: string
  notify_email: boolean
  has_slack_webhook: boolean
}

export async function getAccount(): Promise<AccountInfo> {
  return fetchAPI('/api/v1/account')
}

export async function updateAccount(data: { notify_email?: boolean; slack_webhook?: string }): Promise<void> {
  await fetchAPI('/api/v1/account', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// Admin types + fetchers have moved to api-commercial.ts so the OSS mirror
// can exclude them. See STRATEGY.md.

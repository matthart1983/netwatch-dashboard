export interface HostInfo {
  host_id: string
  hostname: string
  os?: string | null
  kernel?: string | null
  uptime_secs?: number | null
  cpu_model?: string | null
  cpu_cores?: number | null
  memory_total_bytes?: number | null
}

export interface InterfaceMetric {
  name: string
  is_up: boolean
  rx_bytes: number
  tx_bytes: number
  rx_bytes_delta: number
  tx_bytes_delta: number
  rx_packets: number
  tx_packets: number
  rx_errors: number
  tx_errors: number
  rx_drops: number
  tx_drops: number
  rx_rate?: number | null
  tx_rate?: number | null
  rx_history?: number[] | null
  tx_history?: number[] | null
}

export interface HealthMetric {
  gateway_ip?: string | null
  gateway_rtt_ms?: number | null
  gateway_loss_pct?: number | null
  dns_ip?: string | null
  dns_rtt_ms?: number | null
  dns_loss_pct?: number | null
  gateway_rtt_history?: (number | null)[] | null
  dns_rtt_history?: (number | null)[] | null
}

export interface SystemMetric {
  cpu_usage_pct?: number | null
  memory_total_bytes?: number | null
  memory_used_bytes?: number | null
  memory_available_bytes?: number | null
  load_avg_1m?: number | null
  load_avg_5m?: number | null
  load_avg_15m?: number | null
  swap_total_bytes?: number | null
  swap_used_bytes?: number | null
  cpu_per_core?: number[] | null
}

export interface DiskUsage {
  mount: string
  filesystem?: string | null
  total_bytes: number
  used_bytes: number
  available_bytes: number
  usage_pct: number
}

export interface DiskIo {
  read_bytes?: number | null
  write_bytes?: number | null
  read_bytes_delta?: number | null
  write_bytes_delta?: number | null
}

export interface AgentAlert {
  time: string
  severity: 'warning' | 'critical'
  category: 'port_scan' | 'beaconing' | 'dns_tunnel' | 'bandwidth'
  message: string
  detail?: string
}

export interface Snapshot {
  timestamp: string
  interfaces: InterfaceMetric[]
  health?: HealthMetric | null
  connection_count?: number | null
  system?: SystemMetric | null
  disk_usage?: DiskUsage[] | null
  disk_io?: DiskIo | null
  tcp_time_wait?: number | null
  tcp_close_wait?: number | null
  processes?: unknown[] | null
  connections?: unknown[] | null
  alerts?: AgentAlert[] | null
  dns_analytics?: unknown | null
}

export interface IngestRequest {
  agent_version: string
  host: HostInfo
  snapshots: Snapshot[]
}

export interface SnapshotResult {
  index: number
  status: number
  message: string
}

export interface IngestResponse {
  accepted: number
  rejected: number
  host_id: string
  results: SnapshotResult[]
}

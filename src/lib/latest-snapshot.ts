import { getDb } from './db'
import type { Snapshot } from './ingest-types'

interface LatestRow {
  time: string
  payload: string
}

export function getLatestSnapshot(hostId: string): { time: string; snapshot: Snapshot } | null {
  const row = getDb()
    .prepare('SELECT time, payload FROM snapshots WHERE host_id = ? ORDER BY time DESC LIMIT 1')
    .get(hostId) as LatestRow | undefined
  if (!row) return null
  return { time: row.time, snapshot: JSON.parse(row.payload) as Snapshot }
}

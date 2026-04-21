import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { dataDir } from './db'

const CONFIG_PATH = path.join(dataDir, 'config.json')

interface Config {
  apiKey: string
}

function loadOrCreate(): Config {
  const envKey = process.env.NETWATCH_DASHBOARD_API_KEY
  if (envKey) return { apiKey: envKey }

  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Config
  }

  const apiKey = `ndk_${crypto.randomBytes(24).toString('base64url')}`
  const cfg: Config = { apiKey }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 })
  console.log(`[netwatch-dashboard] generated API key — point agents at /api/v1/ingest with Bearer ${apiKey}`)
  return cfg
}

let cached: Config | undefined
export function getConfig(): Config {
  if (!cached) cached = loadOrCreate()
  return cached
}

export function checkBearer(authHeader: string | null): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice('Bearer '.length).trim()
  const expected = getConfig().apiKey
  if (token.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export function requireBearer(req: NextRequest): NextResponse | null {
  if (!checkBearer(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

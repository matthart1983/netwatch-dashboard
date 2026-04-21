import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { listRules, createRule, type CreateRuleInput } from '@/lib/alerts'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  return NextResponse.json(listRules())
}

export async function POST(req: NextRequest) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  let body: CreateRuleInput
  try {
    body = (await req.json()) as CreateRuleInput
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!body.name || !body.metric || !body.condition) {
    return NextResponse.json({ error: 'name, metric, condition required' }, { status: 400 })
  }
  return NextResponse.json(createRule(body))
}

import { NextRequest, NextResponse } from 'next/server'
import { requireBearer } from '@/lib/config'
import { getRule, updateRule, deleteRule, type UpdateRuleInput } from '@/lib/alerts'

export const runtime = 'nodejs'

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  const { id } = await ctx.params
  let body: UpdateRuleInput
  try {
    body = (await req.json()) as UpdateRuleInput
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!getRule(id)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  updateRule(id, body)
  return new NextResponse(null, { status: 204 })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const unauth = requireBearer(req)
  if (unauth) return unauth
  const { id } = await ctx.params
  if (!deleteRule(id)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}

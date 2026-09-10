import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { itemSchema } from '@/lib/validators'

const patchSchema = itemSchema.partial()

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Params) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { id } = await ctx.params
  const item = await prisma.plannerItem.findFirst({ where: { id, userId: user.id }, include: { reminders: true } })
  if (!item) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ item })
}

export async function PATCH(req: NextRequest, ctx: Params) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const { id } = await ctx.params
  const existing = await prisma.plannerItem.findFirst({ where: { id, userId: user.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DATA', details: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  const update: Record<string, unknown> = {}
  for (const key of ['type','title','description','allDay','priority','category','color','isInbox','repeatType','repeatInterval'] as const) {
    if (data[key] !== undefined) update[key] = data[key]
  }
  if (data.startAt !== undefined) update.startAt = data.startAt ? new Date(data.startAt) : null
  if (data.endAt !== undefined) update.endAt = data.endAt ? new Date(data.endAt) : null
  if (data.dueAt !== undefined) update.dueAt = data.dueAt ? new Date(data.dueAt) : null
  if (data.repeatUntil !== undefined) update.repeatUntil = data.repeatUntil ? new Date(data.repeatUntil) : null

  const item = await prisma.$transaction(async (tx) => {
    if (data.isInbox === true) {
      update.startAt = null; update.endAt = null; update.dueAt = null; update.repeatType = 'NONE'; update.repeatUntil = null
      await tx.reminder.deleteMany({ where: { itemId: id, userId: user.id } })
    } else if (data.reminderOffsets !== undefined) {
      await tx.reminder.deleteMany({ where: { itemId: id, userId: user.id } })
      const unique = [...new Set(data.reminderOffsets)]
      if (unique.length) await tx.reminder.createMany({ data: unique.map((offsetMinutes) => ({ itemId: id, userId: user.id, offsetMinutes })) })
    }
    return tx.plannerItem.update({ where: { id }, data: update, include: { reminders: true } })
  })
  return NextResponse.json({ item })
}

export async function DELETE(req: NextRequest, ctx: Params) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const { id } = await ctx.params
  const result = await prisma.plannerItem.deleteMany({ where: { id, userId: user.id } })
  if (!result.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

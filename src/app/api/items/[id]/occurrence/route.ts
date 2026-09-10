import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { z } from 'zod'

const schema = z.object({ occurrenceAt: z.string().datetime(), completed: z.boolean() })
type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Params) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const { id } = await ctx.params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DATA' }, { status: 400 })
  const item = await prisma.plannerItem.findFirst({ where: { id, userId: user.id }, select: { id: true, repeatType: true } })
  if (!item) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  if (item.repeatType === 'NONE') {
    await prisma.plannerItem.update({ where: { id }, data: { completedAt: parsed.data.completed ? new Date() : null } })
  } else {
    const occurrenceAt = new Date(parsed.data.occurrenceAt)
    await prisma.itemOccurrenceState.upsert({
      where: { itemId_occurrenceAt: { itemId: id, occurrenceAt } },
      create: { itemId: id, occurrenceAt, completedAt: parsed.data.completed ? new Date() : null },
      update: { completedAt: parsed.data.completed ? new Date() : null }
    })
  }
  return NextResponse.json({ ok: true })
}

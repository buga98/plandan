import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { semanticDay } from '@/lib/timezone'
import { z } from 'zod'

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  energy: z.number().int().min(1).max(5).nullable().optional(),
  gratitude: z.string().max(5000).nullable().optional(),
  note: z.string().max(10000).nullable().optional()
})

export async function GET(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const dateKey = new URL(req.url).searchParams.get('date') || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return NextResponse.json({ error: 'INVALID_DATE' }, { status: 400 })
  const reflection = await prisma.reflection.findUnique({ where: { userId_date: { userId: user.id, date: semanticDay(dateKey) } } })
  return NextResponse.json({ reflection })
}

export async function PUT(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DATA' }, { status: 400 })
  const date = semanticDay(parsed.data.date)
  const reflection = await prisma.reflection.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, mood: parsed.data.mood ?? null, energy: parsed.data.energy ?? null, gratitude: parsed.data.gratitude || null, note: parsed.data.note || null },
    update: { mood: parsed.data.mood ?? null, energy: parsed.data.energy ?? null, gratitude: parsed.data.gratitude || null, note: parsed.data.note || null }
  })
  return NextResponse.json({ reflection })
}

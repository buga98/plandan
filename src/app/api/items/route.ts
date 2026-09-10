import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { occurrencesBetween } from '@/lib/recurrence'
import { sameOrigin } from '@/lib/security'
import { itemSchema } from '@/lib/validators'
import { safeTimeZone } from '@/lib/timezone'

export async function GET(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const url = new URL(req.url)
  const inbox = url.searchParams.get('inbox') === '1'

  if (inbox) {
    const items = await prisma.plannerItem.findMany({
      where: { userId: user.id, isInbox: true },
      include: { reminders: true },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ items })
  }

  const from = new Date(url.searchParams.get('from') || '')
  const to = new Date(url.searchParams.get('to') || '')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 400 })
  }

  const items = await prisma.plannerItem.findMany({
    where: {
      userId: user.id,
      isInbox: false,
      OR: [
        {
          repeatType: 'NONE',
          OR: [
            { startAt: { gte: from, lte: to } },
            { dueAt: { gte: from, lte: to } }
          ]
        },
        {
          repeatType: { not: 'NONE' },
          OR: [
            { startAt: { lte: to } },
            { dueAt: { lte: to } }
          ]
        }
      ]
    },
    include: {
      reminders: true,
      occurrenceStates: { where: { occurrenceAt: { gte: from, lte: to } } }
    },
    orderBy: [{ startAt: 'asc' }, { dueAt: 'asc' }, { createdAt: 'asc' }]
  })

  const timezone = safeTimeZone(user.settings?.timezone)
  const occurrences = items.flatMap((item) => {
    const dates = occurrencesBetween(item, from, to, timezone)
    const duration = item.startAt && item.endAt ? Math.max(0, item.endAt.getTime() - item.startAt.getTime()) : 0
    return dates.map((occurrenceAt) => {
      const state = item.occurrenceStates.find((entry) => entry.occurrenceAt.getTime() === occurrenceAt.getTime())
      return {
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        allDay: item.allDay,
        priority: item.priority,
        category: item.category,
        color: item.color,
        repeatType: item.repeatType,
        occurrenceAt: occurrenceAt.toISOString(),
        occurrenceEndAt: duration ? new Date(occurrenceAt.getTime() + duration).toISOString() : null,
        completedAt: item.repeatType === 'NONE' ? item.completedAt?.toISOString() || null : state?.completedAt?.toISOString() || null,
        reminders: item.reminders.map((r) => r.offsetMinutes)
      }
    })
  })

  return NextResponse.json({ occurrences })
}

export async function POST(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const parsed = itemSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DATA', details: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  const isInbox = data.isInbox
  const item = await prisma.plannerItem.create({
    data: {
      userId: user.id,
      type: data.type,
      title: data.title,
      description: data.description || null,
      startAt: isInbox ? null : data.startAt ? new Date(data.startAt) : null,
      endAt: isInbox ? null : data.endAt ? new Date(data.endAt) : null,
      dueAt: isInbox ? null : data.dueAt ? new Date(data.dueAt) : null,
      allDay: data.allDay,
      priority: data.priority,
      category: data.category || null,
      color: data.color || null,
      isInbox,
      repeatType: isInbox ? 'NONE' : data.repeatType,
      repeatInterval: data.repeatInterval,
      repeatUntil: isInbox || !data.repeatUntil ? null : new Date(data.repeatUntil),
      reminders: !isInbox && data.reminderOffsets.length
        ? { create: [...new Set(data.reminderOffsets)].map((offsetMinutes) => ({ userId: user.id, offsetMinutes })) }
        : undefined
    },
    include: { reminders: true }
  })

  return NextResponse.json({ item }, { status: 201 })
}

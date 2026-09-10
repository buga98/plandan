import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const now = Date.now()
  const focusSince = new Date(now - 90 * 24 * 60 * 60 * 1000)
  const habitSince = new Date(now - 120 * 24 * 60 * 60 * 1000)
  const reflectionSince = new Date(now - 365 * 24 * 60 * 60 * 1000)
  const occurrenceStateSince = new Date(now - 365 * 24 * 60 * 60 * 1000)
  const [items, habits, reflections, focusSessions, settings, dayOffs] = await Promise.all([
    prisma.plannerItem.findMany({
      where: { userId: user.id },
      include: { reminders: true, occurrenceStates: { where: { occurrenceAt: { gte: occurrenceStateSince } } } },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.habit.findMany({
      where: { userId: user.id, archived: false },
      include: { checkins: { where: { date: { gte: habitSince } }, orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.reflection.findMany({ where: { userId: user.id, date: { gte: reflectionSince } }, orderBy: { date: 'asc' } }),
    prisma.focusSession.findMany({
      where: { userId: user.id, startedAt: { gte: focusSince } },
      orderBy: { startedAt: 'asc' }
    }),
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.dayOff.findMany({ where: { userId: user.id }, orderBy: { date: 'asc' } })
  ])

  return NextResponse.json({
    syncedAt: new Date().toISOString(),
    profile: { id: user.id, name: user.name, email: user.email },
    settings,
    items,
    habits,
    reflections,
    focusSessions,
    dayOffs
  })
}

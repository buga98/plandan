import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { occurrencesBetween } from '@/lib/recurrence'
import { safeTimeZone, semanticDay, shiftDateKey, zonedDateKey, zonedDayRange } from '@/lib/timezone'

export async function GET(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const timezone = safeTimeZone(user.settings?.timezone)
  const todayKey = zonedDateKey(new Date(), timezone)
  const fromKey = shiftDateKey(todayKey, -6)
  const { from, to } = zonedDayRange(fromKey, todayKey, timezone)
  const dayKeys = Array.from({ length: 7 }, (_, idx) => shiftDateKey(fromKey, idx))

  const items = await prisma.plannerItem.findMany({
    where: {
      userId: user.id,
      type: 'TASK',
      isInbox: false,
      OR: [
        { repeatType: 'NONE', OR: [{ startAt: { gte: from, lte: to } }, { dueAt: { gte: from, lte: to } }] },
        { repeatType: { not: 'NONE' }, OR: [{ startAt: { lte: to } }, { dueAt: { lte: to } }] }
      ]
    },
    include: { occurrenceStates: { where: { occurrenceAt: { gte: from, lte: to } } } }
  })

  let totalTasks = 0
  let completedTasks = 0
  const daily = dayKeys.map((date) => ({ date, total: 0, completed: 0 }))
  const dailyByDate = new Map(daily.map((row) => [row.date, row]))

  for (const item of items) {
    const occurrences = occurrencesBetween(item, from, to, timezone)
    for (const occurrence of occurrences) {
      totalTasks += 1
      const state = item.repeatType === 'NONE'
        ? Boolean(item.completedAt)
        : Boolean(item.occurrenceStates.find((s) => s.occurrenceAt.getTime() === occurrence.getTime())?.completedAt)
      if (state) completedTasks += 1
      const row = dailyByDate.get(zonedDateKey(occurrence, timezone))
      if (row) { row.total += 1; if (state) row.completed += 1 }
    }
  }

  const [focus, habits, reflections] = await Promise.all([
    prisma.focusSession.aggregate({
      where: { userId: user.id, startedAt: { gte: from, lte: to }, completed: true },
      _sum: { durationMin: true },
      _count: true
    }),
    prisma.habit.findMany({
      where: { userId: user.id, archived: false },
      include: { checkins: { where: { date: { gte: semanticDay(fromKey), lte: semanticDay(todayKey) } } } }
    }),
    prisma.reflection.findMany({ where: { userId: user.id, date: { gte: semanticDay(fromKey), lte: semanticDay(todayKey) } } })
  ])

  const habitTarget = habits.reduce((sum, habit) => sum + habit.targetPerWeek, 0)
  const habitDone = habits.reduce((sum, habit) => sum + habit.checkins.filter((c) => c.count >= Math.max(1, habit.targetPerDay)).length, 0)
  const moods = reflections.map((r) => r.mood).filter((v): v is number => typeof v === 'number')
  const energies = reflections.map((r) => r.energy).filter((v): v is number => typeof v === 'number')

  return NextResponse.json({
    totalTasks,
    completedTasks,
    completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
    focusMinutes: focus._sum.durationMin || 0,
    focusSessions: focus._count,
    habitDone,
    habitTarget,
    habitConsistency: habitTarget ? Math.min(100, Math.round((habitDone / habitTarget) * 100)) : 0,
    avgMood: moods.length ? Number((moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)) : null,
    avgEnergy: energies.length ? Number((energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)) : null,
    daily
  })
}

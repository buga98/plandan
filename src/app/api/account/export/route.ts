import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const [items, habits, focusSessions, reflections, settings, dayOffs] = await Promise.all([
    prisma.plannerItem.findMany({ where: { userId: user.id }, include: { reminders: true, occurrenceStates: true } }),
    prisma.habit.findMany({ where: { userId: user.id }, include: { checkins: true } }),
    prisma.focusSession.findMany({ where: { userId: user.id } }),
    prisma.reflection.findMany({ where: { userId: user.id } }),
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.dayOff.findMany({ where: { userId: user.id } })
  ])
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'PlanDan',
    profile: { name: user.name, email: user.email, createdAt: user.createdAt },
    settings,
    items,
    habits,
    focusSessions,
    reflections,
    dayOffs
  }
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="plandan-export-${new Date().toISOString().slice(0,10)}.json"`
    }
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { z } from 'zod'

const schema = z.object({
  durationMin: z.number().int().min(1).max(480),
  label: z.string().trim().max(120).optional().nullable(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  completed: z.boolean().default(true)
})

export async function POST(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DATA' }, { status: 400 })
  const session = await prisma.focusSession.create({ data: { userId: user.id, durationMin: parsed.data.durationMin, label: parsed.data.label || null, startedAt: new Date(parsed.data.startedAt), endedAt: new Date(parsed.data.endedAt), completed: parsed.data.completed } })
  return NextResponse.json({ session }, { status: 201 })
}

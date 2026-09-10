import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { settingsSchema } from '@/lib/validators'

export async function GET(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  return NextResponse.json({ settings: user.settings })
}

export async function PATCH(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const parsed = settingsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DATA', details: parsed.error.flatten() }, { status: 400 })
  const settings = await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: parsed.data
  })
  return NextResponse.json({ settings })
}

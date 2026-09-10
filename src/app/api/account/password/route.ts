import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { z } from 'zod'

const schema = z.object({ currentPassword: z.string().min(1).max(100), newPassword: z.string().min(8).max(100) })

export async function POST(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DATA' }, { status: 400 })
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } })
  if (!dbUser || !(await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash))) {
    return NextResponse.json({ error: 'WRONG_PASSWORD' }, { status: 400 })
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
  return NextResponse.json({ ok: true })
}

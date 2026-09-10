import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession, setSessionCookie } from '@/lib/auth'
import { getClientIp, rateLimit, sameOrigin } from '@/lib/security'
import { loginSchema } from '@/lib/validators'

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const limit = rateLimit(`login:${getClientIp(req)}`, 10, 60_000)
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } })

  const parsed = loginSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_LOGIN' }, { status: 400 })
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() }, include: { settings: true } })
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: 'INVALID_LOGIN' }, { status: 401 })
  }

  const session = await createSession(user.id)
  const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, settings: user.settings } })
  setSessionCookie(res, session.token, session.expiresAt)
  return res
}

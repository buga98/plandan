import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession, setSessionCookie } from '@/lib/auth'
import { getClientIp, rateLimit, sameOrigin } from '@/lib/security'
import { registerSchema } from '@/lib/validators'

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const limit = rateLimit(`register:${getClientIp(req)}`, 8, 60_000)
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } })

  const parsed = registerSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  const email = parsed.data.email.toLowerCase()
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) return NextResponse.json({ error: 'EMAIL_EXISTS' }, { status: 409 })

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
      settings: { create: { language: parsed.data.language } }
    },
    include: { settings: true }
  })
  const session = await createSession(user.id)
  const res = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, settings: user.settings } }, { status: 201 })
  setSessionCookie(res, session.token, session.expiresAt)
  return res
}

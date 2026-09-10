import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { z } from 'zod'

const schema = z.object({
  endpoint: z.string().url().max(768),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) })
})

export async function POST(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DATA' }, { status: 400 })
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: { userId: user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, userAgent: req.headers.get('user-agent')?.slice(0, 255) || null },
    update: { userId: user.id, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, userAgent: req.headers.get('user-agent')?.slice(0, 255) || null }
  })
  return NextResponse.json({ subscription: { id: sub.id } }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { endpoint?: string }
  if (body.endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: user.id } })
  return NextResponse.json({ ok: true })
}

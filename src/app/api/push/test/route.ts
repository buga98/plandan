import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { getWebPush } from '@/lib/webpush'

export async function POST(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const [subscriptions, settings] = await Promise.all([
    prisma.pushSubscription.findMany({ where: { userId: user.id } }),
    prisma.userSettings.findUnique({ where: { userId: user.id }, select: { language: true } })
  ])
  const language = settings?.language || 'HR'
  const copy = {
    HR: 'Push obavijesti rade. Nećeš propustiti ono bitno.',
    EN: 'Push notifications work. You won’t miss what matters.',
    DE: 'Push-Benachrichtigungen funktionieren. Du verpasst nichts Wichtiges.'
  }[language]
  const push = getWebPush()
  let sent = 0
  for (const sub of subscriptions) {
    try {
      await push.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: 'PlanDan ✦', body: copy, url: '/app', tag: 'plandan-test' }))
      sent += 1
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined)
    }
  }
  return NextResponse.json({ ok: true, sent })
}

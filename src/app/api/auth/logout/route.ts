import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie, deleteSessionByToken, SESSION_COOKIE } from '@/lib/auth'
import { sameOrigin } from '@/lib/security'

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  await deleteSessionByToken(req.cookies.get(SESSION_COOKIE)?.value)
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}

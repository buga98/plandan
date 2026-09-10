import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from './prisma'

export const SESSION_COOKIE = 'plandan_session'
const SESSION_DAYS = 30

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt }
  })
  return { token, expiresAt }
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0)
  })
}

export async function deleteSessionByToken(token?: string | null) {
  if (!token) return
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
}

export async function getCurrentUser() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { settings: true } } }
  })

  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }

  return session.user
}

export async function getUserFromToken(token?: string | null) {
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { settings: true } } }
  })
  if (!session || session.expiresAt <= new Date()) return null
  return session.user
}

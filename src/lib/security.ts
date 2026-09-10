import { NextRequest } from 'next/server'

const buckets = new Map<string, { count: number; resetAt: number }>()

export function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function rateLimit(key: string, max = 10, windowMs = 60_000) {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  current.count += 1
  if (current.count > max) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const originHost = new URL(origin).host
    const requestHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
    return Boolean(requestHost && originHost === requestHost)
  } catch {
    return false
  }
}

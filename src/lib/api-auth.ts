import { NextRequest } from 'next/server'
import { SESSION_COOKIE, getUserFromToken } from './auth'

export async function apiUser(req: NextRequest) {
  return getUserFromToken(req.cookies.get(SESSION_COOKIE)?.value)
}

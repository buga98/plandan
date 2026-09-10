import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const user = await apiUser(req)
  if (!user) return NextResponse.json({ user: null }, { status: 401 })
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, settings: user.settings } })
}

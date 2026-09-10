import { NextResponse } from 'next/server'
export async function GET() {
  if (!process.env.VAPID_PUBLIC_KEY) return NextResponse.json({ error: 'PUSH_NOT_CONFIGURED' }, { status: 503 })
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY })
}

import { NextRequest, NextResponse } from 'next/server'

export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/v2', req.url), 307)
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { semanticDay } from '@/lib/timezone'

const schema=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),label:z.string().trim().min(1).max(120),color:z.string().max(20).default('#ef5da8')})
export async function GET(req:NextRequest){
 const user=await apiUser(req);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401})
 const u=new URL(req.url),from=u.searchParams.get('from'),to=u.searchParams.get('to');const where:any={userId:user.id}
 if(from&&to)where.date={gte:semanticDay(from),lte:semanticDay(to)}
 const days=await prisma.dayOff.findMany({where,orderBy:{date:'asc'}});return NextResponse.json({days})
}
export async function POST(req:NextRequest){
 const user=await apiUser(req);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403})
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'INVALID_DATA'},{status:400})
 const day=await prisma.dayOff.upsert({where:{userId_date:{userId:user.id,date:semanticDay(parsed.data.date)}},create:{userId:user.id,date:semanticDay(parsed.data.date),label:parsed.data.label,color:parsed.data.color},update:{label:parsed.data.label,color:parsed.data.color}})
 return NextResponse.json({day},{status:201})
}

import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { semanticDay } from '@/lib/timezone'
import { z } from 'zod'
const schema=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),count:z.number().int().min(0).max(100).optional(),done:z.boolean().optional()})
type Params={params:Promise<{id:string}>}
export async function POST(req:NextRequest,ctx:Params){const user=await apiUser(req);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});const {id}=await ctx.params;const habit=await prisma.habit.findFirst({where:{id,userId:user.id},select:{id:true,targetPerDay:true}});if(!habit)return NextResponse.json({error:'NOT_FOUND'},{status:404});const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'INVALID_DATA'},{status:400});const date=semanticDay(parsed.data.date);let count=parsed.data.count;if(count===undefined&&parsed.data.done!==undefined)count=parsed.data.done?habit.targetPerDay:0;if(count===undefined)return NextResponse.json({error:'INVALID_DATA'},{status:400});if(count<=0){await prisma.habitCheckin.deleteMany({where:{habitId:id,date}})}else{await prisma.habitCheckin.upsert({where:{habitId_date:{habitId:id,date}},create:{habitId:id,date,count},update:{count}})}return NextResponse.json({ok:true,count})}

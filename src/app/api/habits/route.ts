import { NextRequest, NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
import { z } from 'zod'

const hhmm=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const schema=z.object({
 name:z.string().trim().min(1).max(120),emoji:z.string().max(12).default('✓'),color:z.string().max(20).default('#7c5cff'),
 targetPerWeek:z.number().int().min(1).max(7).default(7),targetPerDay:z.number().int().min(1).max(50).default(1),
 reminderMode:z.enum(['NONE','FIXED','INTERVAL']).default('NONE'),reminderTime:hhmm.nullable().optional(),
 reminderIntervalMinutes:z.number().int().min(15).max(1440).nullable().optional(),reminderStartTime:hhmm.nullable().optional(),reminderEndTime:hhmm.nullable().optional()
}).superRefine((v,ctx)=>{if(v.reminderMode==='FIXED'&&!v.reminderTime)ctx.addIssue({code:'custom',path:['reminderTime'],message:'Required'});if(v.reminderMode==='INTERVAL'&&(!v.reminderIntervalMinutes||!v.reminderStartTime||!v.reminderEndTime))ctx.addIssue({code:'custom',path:['reminderIntervalMinutes'],message:'Interval configuration required'})})

export async function GET(req:NextRequest){const user=await apiUser(req);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});const since=new Date(Date.now()-70*86400000);const habits=await prisma.habit.findMany({where:{userId:user.id,archived:false},include:{checkins:{where:{date:{gte:since}},orderBy:{date:'asc'}}},orderBy:{createdAt:'asc'}});return NextResponse.json({habits})}
export async function POST(req:NextRequest){const user=await apiUser(req);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'INVALID_DATA',details:parsed.error.flatten()},{status:400});const d=parsed.data;const habit=await prisma.habit.create({data:{userId:user.id,name:d.name,emoji:d.emoji,color:d.color,targetPerWeek:d.targetPerWeek,targetPerDay:d.targetPerDay,reminderMode:d.reminderMode,reminderTime:d.reminderMode==='FIXED'?d.reminderTime:null,reminderIntervalMinutes:d.reminderMode==='INTERVAL'?d.reminderIntervalMinutes:null,reminderStartTime:d.reminderMode==='INTERVAL'?d.reminderStartTime:null,reminderEndTime:d.reminderMode==='INTERVAL'?d.reminderEndTime:null}});return NextResponse.json({habit},{status:201})}

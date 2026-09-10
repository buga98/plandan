import { NextRequest,NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
export async function GET(req:NextRequest){
 const user=await apiUser(req);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401})
 const url=new URL(req.url),before=new Date(url.searchParams.get('before')||'');if(Number.isNaN(before.getTime()))return NextResponse.json({error:'INVALID_DATE'},{status:400})
 const tasks=await prisma.plannerItem.findMany({where:{userId:user.id,type:'TASK',isInbox:false,repeatType:'NONE',completedAt:null,dueAt:{lt:before}},include:{reminders:true},orderBy:{dueAt:'asc'},take:100})
 return NextResponse.json({tasks})
}

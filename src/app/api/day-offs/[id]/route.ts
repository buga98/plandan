import { NextRequest,NextResponse } from 'next/server'
import { apiUser } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { sameOrigin } from '@/lib/security'
type Params={params:Promise<{id:string}>}
export async function DELETE(req:NextRequest,ctx:Params){const user=await apiUser(req);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});const {id}=await ctx.params;const r=await prisma.dayOff.deleteMany({where:{id,userId:user.id}});return r.count?NextResponse.json({ok:true}):NextResponse.json({error:'NOT_FOUND'},{status:404})}

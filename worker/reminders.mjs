import { PrismaClient } from '@prisma/client'
import webpush from 'web-push'

const prisma = new PrismaClient()
const publicKey = process.env.VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

if (!publicKey || !privateKey) {
  console.error('[worker] Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY')
  process.exit(1)
}
webpush.setVapidDetails(subject, publicKey, privateKey)

function safeTimeZone(value){try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format(new Date());return value}catch{return 'Europe/Zagreb'}}
function zonedParts(date, timeZone) {
  timeZone=safeTimeZone(timeZone)
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' })
  const obj = Object.fromEntries(fmt.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type, Number(p.value)]))
  return { year:obj.year, month:obj.month, day:obj.day, hour:obj.hour, minute:obj.minute, second:obj.second }
}
function partsMs(p){ return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second) }
function zonedToUtc(parts,timeZone){
  let guess=new Date(partsMs(parts))
  for(let i=0;i<3;i++){
    const actual=zonedParts(guess,timeZone)
    const delta=partsMs(parts)-partsMs(actual)
    if(!delta) break
    guess=new Date(guess.getTime()+delta)
  }
  return guess
}
function dim(y,m){ return new Date(Date.UTC(y,m,0)).getUTCDate() }
function addLocal(p,type,interval,n){
  const step=Math.max(1,interval||1)*n
  if(type==='DAILY'||type==='WEEKLY'){
    const days=type==='DAILY'?step:step*7
    const d=new Date(Date.UTC(p.year,p.month-1,p.day+days,p.hour,p.minute,p.second))
    return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:p.hour,minute:p.minute,second:p.second}
  }
  if(type==='MONTHLY'){
    const raw=p.month-1+step, y=p.year+Math.floor(raw/12), mi=((raw%12)+12)%12, m=mi+1
    return {year:y,month:m,day:Math.min(p.day,dim(y,m)),hour:p.hour,minute:p.minute,second:p.second}
  }
  if(type==='YEARLY'){
    const y=p.year+step
    return {year:y,month:p.month,day:Math.min(p.day,dim(y,p.month)),hour:p.hour,minute:p.minute,second:p.second}
  }
  return p
}
function occurrencesBetween(item,from,to,timeZone,max=5000){
  const base=item.startAt||item.dueAt
  if(!base||to<from) return []
  if(item.repeatType==='NONE') return base>=from&&base<=to?[base]:[]
  const p=zonedParts(base,timeZone), out=[]
  for(let n=0;n<max;n++){
    const c=zonedToUtc(addLocal(p,item.repeatType,item.repeatInterval,n),timeZone)
    if(item.repeatUntil&&c>item.repeatUntil) break
    if(c>to) break
    if(c>=from) out.push(c)
  }
  return out
}
function localDateKey(date,tz){
  const p=zonedParts(date,tz)
  return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`
}
function semanticDay(key){ return new Date(`${key}T00:00:00.000Z`) }

const copy={
  HR:{reminder:'Podsjetnik',due:'Vrijeme je za',habit:'Navika te čeka',habitBody:(n)=>`Danas još nisi označio/la: ${n}`},
  EN:{reminder:'Reminder',due:'Time for',habit:'Your habit is waiting',habitBody:(n)=>`You have not checked off today: ${n}`},
  DE:{reminder:'Erinnerung',due:'Zeit für',habit:'Deine Gewohnheit wartet',habitBody:(n)=>`Heute noch nicht erledigt: ${n}`}
}

async function sendToUser(user, payload){
  let sent=0
  for(const sub of user.pushSubscriptions){
    try{
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload),{TTL:3600})
      sent++
    }catch(err){
      if(err?.statusCode===404||err?.statusCode===410){
        await prisma.pushSubscription.delete({where:{id:sub.id}}).catch(()=>undefined)
      }else console.error('[worker] push failed',err?.statusCode||err?.message||err)
    }
  }
  return sent
}

async function processItemReminders(now){
  const reminders=await prisma.reminder.findMany({
    include:{
      item:true,
      user:{include:{settings:true,pushSubscriptions:true}}
    }
  })
  // Small look-back prevents missed reminders after a short worker pause/restart.
  const windowStart=new Date(now.getTime()-120_000)
  const windowEnd=new Date(now.getTime()+35_000)
  for(const r of reminders){
    if(r.item.isInbox||!r.user.pushSubscriptions.length) continue
    const tz=safeTimeZone(r.user.settings?.timezone||'Europe/Zagreb')
    const targetFrom=new Date(windowStart.getTime()+r.offsetMinutes*60_000)
    const targetTo=new Date(windowEnd.getTime()+r.offsetMinutes*60_000)
    const occ=occurrencesBetween(r.item,targetFrom,targetTo,tz)
    for(const occurrenceAt of occ){
      const exists=await prisma.reminderDelivery.findUnique({where:{reminderId_occurrenceAt:{reminderId:r.id,occurrenceAt}}})
      if(exists) continue
      const lang=r.user.settings?.language||'HR', c=copy[lang]||copy.HR
      const sent=await sendToUser(r.user,{
        title:`PlanDan · ${c.reminder}`,
        body:`${c.due}: ${r.item.title}`,
        url:`/app?date=${localDateKey(occurrenceAt,tz)}&item=${r.item.id}`,
        tag:`item-${r.id}-${occurrenceAt.toISOString()}`
      })
      if(sent>0){
        await prisma.reminderDelivery.create({data:{reminderId:r.id,occurrenceAt}}).catch(()=>undefined)
        console.log(`[worker] reminder sent: ${r.item.title} -> ${sent} device(s)`)
      }
    }
  }
}

function minutesOf(hhmm){const [h,m]=String(hhmm||'00:00').split(':').map(Number);return h*60+m}
function slotPartsForToday(now,tz,minuteOfDay){const p=zonedParts(now,tz);return {year:p.year,month:p.month,day:p.day,hour:Math.floor(minuteOfDay/60),minute:minuteOfDay%60,second:0}}

async function processHabitReminders(now){
  const habits=await prisma.habit.findMany({
    where:{archived:false,reminderMode:{not:'NONE'}},
    include:{user:{include:{settings:true,pushSubscriptions:true}}}
  })
  for(const habit of habits){
    if(!habit.user.pushSubscriptions.length) continue
    const tz=safeTimeZone(habit.user.settings?.timezone||'Europe/Zagreb')
    const dayKey=localDateKey(now,tz), date=semanticDay(dayKey)
    const check=await prisma.habitCheckin.findUnique({where:{habitId_date:{habitId:habit.id,date}}})
    const current=check?.count||0, target=Math.max(1,habit.targetPerDay||1)
    if(current>=target) continue

    const slots=[]
    if(habit.reminderMode==='FIXED'&&habit.reminderTime){slots.push(minutesOf(habit.reminderTime))}
    if(habit.reminderMode==='INTERVAL'&&habit.reminderIntervalMinutes&&habit.reminderStartTime&&habit.reminderEndTime){
      const start=minutesOf(habit.reminderStartTime), end=minutesOf(habit.reminderEndTime), step=Math.max(15,habit.reminderIntervalMinutes)
      if(end>=start){for(let m=start;m<=end;m+=step)slots.push(m)}
      else {for(let m=start;m<1440;m+=step)slots.push(m);for(let m=0;m<=end;m+=step)slots.push(m)}
    }
    for(const minuteOfDay of slots){
      const scheduledAt=zonedToUtc(slotPartsForToday(now,tz,minuteOfDay),tz)
      if(scheduledAt.getTime()<now.getTime()-120_000||scheduledAt.getTime()>now.getTime()+35_000) continue
      const delivered=await prisma.habitReminderSlotDelivery.findUnique({where:{habitId_scheduledAt:{habitId:habit.id,scheduledAt}}})
      if(delivered) continue
      const lang=habit.user.settings?.language||'HR', c=copy[lang]||copy.HR
      const progress=target>1?` (${current}/${target})`:''
      const sent=await sendToUser(habit.user,{title:`PlanDan · ${c.habit}`,body:`${c.habitBody(habit.name)}${progress}`,url:'/app/habits',tag:`habit-${habit.id}-${scheduledAt.toISOString()}`})
      if(sent>0) await prisma.habitReminderSlotDelivery.create({data:{habitId:habit.id,scheduledAt}}).catch(()=>undefined)
    }
  }
}

let running=false
async function tick(){
  if(running) return
  running=true
  try{
    const now=new Date()
    await processItemReminders(now)
    await processHabitReminders(now)
  }catch(err){ console.error('[worker] tick error',err) }
  finally{ running=false }
}

console.log('[worker] PlanDan reminder worker started')
await tick()
setInterval(tick,20_000)

process.on('SIGTERM',async()=>{await prisma.$disconnect();process.exit(0)})
process.on('SIGINT',async()=>{await prisma.$disconnect();process.exit(0)})

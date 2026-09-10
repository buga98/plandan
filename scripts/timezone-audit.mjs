import assert from 'node:assert/strict'

const TZ = 'Europe/Zagreb'
function zonedParts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' })
  const o = Object.fromEntries(f.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]))
  return {year:o.year,month:o.month,day:o.day,hour:o.hour,minute:o.minute,second:o.second}
}
function ms(p){return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)}
function toUtc(p,tz){let g=new Date(ms(p));for(let i=0;i<4;i++){const a=zonedParts(g,tz),d=ms(p)-ms(a);if(!d)return g;g=new Date(g.getTime()+d)}return g}
function iso(date,time){const [year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number);return toUtc({year,month,day,hour,minute,second:0},TZ).toISOString()}
function key(date){const p=zonedParts(date,TZ);return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`}
function localClock(date){const p=zonedParts(date,TZ);return `${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`}

assert.equal(iso('2026-01-15','10:00'),'2026-01-15T09:00:00.000Z','winter UTC+1')
assert.equal(iso('2026-07-15','10:00'),'2026-07-15T08:00:00.000Z','summer UTC+2')
assert.equal(localClock(new Date('2026-03-28T09:00:00.000Z')),'10:00')
assert.equal(localClock(new Date('2026-03-30T08:00:00.000Z')),'10:00','DST start keeps 10:00 wall clock')
assert.equal(localClock(new Date('2026-10-24T08:00:00.000Z')),'10:00')
assert.equal(localClock(new Date('2026-10-26T09:00:00.000Z')),'10:00','DST end keeps 10:00 wall clock')
const occurrence = new Date(iso('2026-07-15','10:00'))
const sendAt = new Date(occurrence.getTime()-10*60_000)
assert.equal(localClock(sendAt),'09:50','10-minute reminder must be 09:50 local')
assert.equal(key(occurrence),'2026-07-15')
assert.equal(iso('2026-07-15','08:00'),'2026-07-15T06:00:00.000Z','habit summer slot')
assert.equal(iso('2026-12-15','08:00'),'2026-12-15T07:00:00.000Z','habit winter slot')
console.log('PlanDan timezone audit OK — Europe/Zagreb winter/summer/DST/reminder offsets are correct.')

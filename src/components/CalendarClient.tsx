'use client'
import { CalendarPlus,Check,ChevronLeft,ChevronRight,Circle,Clock3,NotebookPen,RotateCcw,X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import { HolidayCountry,holidaysBetween } from '@/lib/holidays'
import { localeFor,useI18n } from '@/lib/i18n'
import { deviceTimeZone, endOfZonedDayIso, formatInTimeZone, moveIsoToZonedDateKeepingTime, safeTimeZone, startOfZonedDayIso, zonedDateKey, zonedPartsClient } from '@/lib/timezone-client'

type Occurrence={id:string;type:'TASK'|'EVENT'|'NOTE';title:string;description?:string|null;allDay:boolean;priority:string;category?:string|null;color?:string|null;repeatType:string;occurrenceAt:string;occurrenceEndAt?:string|null;completedAt?:string|null;reminders:number[]}
type DayOff={id:string;date:string;label:string;color:string}
type Overdue={id:string;title:string;description?:string|null;dueAt:string|null;color?:string|null;priority:string;allDay:boolean}
type Settings={holidayCountry?:HolidayCountry;showHolidays?:boolean;timezone?:string}
function plainDateKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function parseKey(key:string){const[y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d)}
function monthDays(cursor:Date){const first=new Date(cursor.getFullYear(),cursor.getMonth(),1),weekday=(first.getDay()+6)%7,start=new Date(first);start.setDate(first.getDate()-weekday);return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})}

export default function CalendarClient(){
 const {t,lang}=useI18n(),locale=localeFor[lang],params=useSearchParams(),deviceTz=deviceTimeZone();
 const explicitDate=params.get('date')&&/^\d{4}-\d{2}-\d{2}$/.test(params.get('date')!)?params.get('date')!:null
 const initial=explicitDate||zonedDateKey(new Date(),deviceTz)
 const [selected,setSelected]=useState(initial),[cursor,setCursor]=useState(()=>{const d=parseKey(initial);return new Date(d.getFullYear(),d.getMonth(),1)}),[items,setItems]=useState<Occurrence[]>([]),[dayOffs,setDayOffs]=useState<DayOff[]>([]),[settings,setSettings]=useState<Settings>({holidayCountry:'HR',showHolidays:true,timezone:deviceTz}),[loading,setLoading]=useState(true),[dayOpen,setDayOpen]=useState(false),[tab,setTab]=useState<'timeline'|'todo'|'notes'>('timeline'),[overdue,setOverdue]=useState<Overdue[]>([])
 const deepLinkHandled=useRef(false),loadedOnce=useRef(false),timezoneAdjusted=useRef(Boolean(explicitDate))
 const timeZone=safeTimeZone(settings.timezone)
 const days=useMemo(()=>monthDays(cursor),[cursor]),rangeFrom=plainDateKey(days[0]),rangeTo=plainDateKey(days[days.length-1])

 const load=useCallback(async()=>{
  if(!loadedOnce.current)setLoading(true)
  try{
   const from=startOfZonedDayIso(rangeFrom,timeZone),to=endOfZonedDayIso(rangeTo,timeZone)
   const [ir,dr,sr]=await Promise.all([
    fetch(`/api/items?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,{cache:'no-store'}),
    fetch(`/api/day-offs?from=${rangeFrom}&to=${rangeTo}`,{cache:'no-store'}),
    fetch('/api/settings',{cache:'no-store'})
   ])
   if(ir.ok){const d=await ir.json();setItems(d.occurrences||[])}
   if(dr.ok){const d=await dr.json();setDayOffs(d.days||[])}
   if(sr.ok){const d=await sr.json();if(d.settings){const incoming={...d.settings,timezone:safeTimeZone(d.settings.timezone)};setSettings(incoming);if(!timezoneAdjusted.current){timezoneAdjusted.current=true;const today=zonedDateKey(new Date(),incoming.timezone);setSelected(today);setCursor(parseKey(today))}}}
  }finally{loadedOnce.current=true;setLoading(false)}
 },[rangeFrom,rangeTo,timeZone])

 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener('plandan:refresh',refresh);return()=>window.removeEventListener('plandan:refresh',refresh)},[load])
 useEffect(()=>{if(deepLinkHandled.current)return;const item=params.get('item'),quick=params.get('quick');if(!item&&!quick)return;deepLinkHandled.current=true;if(item){setDayOpen(true);setTimeout(()=>window.dispatchEvent(new CustomEvent('plandan:edit',{detail:{id:item}})),60)}else if(['task','event','note'].includes(quick||'')){setTimeout(()=>window.dispatchEvent(new CustomEvent('plandan:quickadd',{detail:{date:selected,type:(quick||'task').toUpperCase()}})),60)}},[params,selected])

 const grouped=useMemo(()=>{const m=new Map<string,Occurrence[]>();for(const x of items){const k=zonedDateKey(x.occurrenceAt,timeZone),a=m.get(k)||[];a.push(x);m.set(k,a)}for(const a of m.values())a.sort((x,y)=>new Date(x.occurrenceAt).getTime()-new Date(y.occurrenceAt).getTime());return m},[items,timeZone])
 const holidays=useMemo(()=>settings.showHolidays===false?[]:holidaysBetween(days[0],days[days.length-1],settings.holidayCountry||'HR',lang),[days,settings.showHolidays,settings.holidayCountry,lang])
 const holidayMap=useMemo(()=>new Map(holidays.map(h=>[h.date,h])),[holidays]),dayOffMap=useMemo(()=>new Map(dayOffs.map(x=>[x.date.slice(0,10),x])),[dayOffs]),selectedItems=grouped.get(selected)||[]

 async function loadOverdue(){if(selected!==zonedDateKey(new Date(),timeZone)){setOverdue([]);return}try{const r=await fetch(`/api/tasks/overdue?before=${encodeURIComponent(startOfZonedDayIso(selected,timeZone))}`,{cache:'no-store'});if(r.ok){const d=await r.json();setOverdue(d.tasks||[])}}catch{}}
 useEffect(()=>{if(dayOpen)void loadOverdue()},[dayOpen,selected,timeZone])
 async function toggle(item:Occurrence){if(item.type!=='TASK')return;const next=!item.completedAt;setItems(p=>p.map(x=>x.id===item.id&&x.occurrenceAt===item.occurrenceAt?{...x,completedAt:next?new Date().toISOString():null}:x));const r=await fetch(`/api/items/${item.id}/occurrence`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({occurrenceAt:item.occurrenceAt,completed:next})});if(!r.ok)void load()}
 async function completeOverdue(item:Overdue){await fetch(`/api/items/${item.id}/occurrence`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({occurrenceAt:item.dueAt,completed:true})});setOverdue(p=>p.filter(x=>x.id!==item.id));window.dispatchEvent(new Event('plandan:refresh'))}
 async function moveOverdue(item:Overdue){await fetch(`/api/items/${item.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({dueAt:moveIsoToZonedDateKeepingTime(item.dueAt,selected,timeZone),isInbox:false})});setOverdue(p=>p.filter(x=>x.id!==item.id));window.dispatchEvent(new Event('plandan:refresh'))}
 function openDay(k:string){setSelected(k);setTab('timeline');setDayOpen(true)}
 function add(time?:string,type?:'TASK'|'EVENT'|'NOTE'){window.dispatchEvent(new CustomEvent('plandan:quickadd',{detail:{date:selected,time,type}}))}
 function edit(id:string){window.dispatchEvent(new CustomEvent('plandan:edit',{detail:{id}}))}
 function today(){const key=zonedDateKey(new Date(),timeZone),d=parseKey(key);setCursor(new Date(d.getFullYear(),d.getMonth(),1));openDay(key)}
 const monthTitle=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(cursor),weekdays=[1,2,3,4,5,6,0].map((_,i)=>new Intl.DateTimeFormat(locale,{weekday:'short'}).format(new Date(2026,7,17+i)))
 return <>
  <div className="calendarOnlyPage"><div className="calendarOnlyHead"><div><h1>{monthTitle}</h1><p>{t('simpleCalendarSubtitle')}</p></div><div className="calendarOnlyActions"><button className="btn btnSoft" onClick={today}>{t('today')}</button><button className="btn btnSoft iconBtn" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()-1,1))}><ChevronLeft size={19}/></button><button className="btn btnSoft iconBtn" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+1,1))}><ChevronRight size={19}/></button></div></div>
   <section className="card calendarCard calendarOnlyCard"><div className="weekdays">{weekdays.map((x,i)=><span key={i}>{x}</span>)}</div><div className="monthGrid simpleMonthGrid">{days.map(d=>{const k=plainDateKey(d),list=grouped.get(k)||[],holiday=holidayMap.get(k),off=dayOffMap.get(k),outside=d.getMonth()!==cursor.getMonth(),isToday=k===zonedDateKey(new Date(),timeZone);return <button type="button" key={k} className={`dayCell simpleDayCell ${outside?'outside':''} ${isToday?'today':''} ${holiday||off?'specialDay':''}`} onClick={()=>openDay(k)}><div className="dayCellTop"><span className="dayNumber">{d.getDate()}</span>{list.some(x=>x.type==='TASK'&&x.completedAt)&&<span className="dayDone"><Check size={11}/></span>}</div>{holiday&&<span className="holidayMini">{holiday.name}</span>}{off&&<span className="dayOffMini">{off.label}</span>}<div className="dayDots">{list.slice(0,5).map((x,i)=><i key={`${x.id}-${i}`} style={{background:x.completedAt?'var(--green)':x.color||'var(--accent)'}}/>)}</div></button>})}</div>{loading&&<div className="calendarLoading">{t('loadingPlan')}</div>}</section>
  </div>
  {dayOpen&&<DayPlanModal date={selected} items={selectedItems} overdue={overdue} tab={tab} setTab={setTab} holiday={holidayMap.get(selected)?.name} dayOff={dayOffMap.get(selected)} locale={locale} timeZone={timeZone} t={t} onClose={()=>setDayOpen(false)} onAdd={add} onEdit={edit} onToggle={toggle} onMoveOverdue={moveOverdue} onCompleteOverdue={completeOverdue}/>} 
 </>
}

function DayPlanModal({date,items,overdue,tab,setTab,holiday,dayOff,locale,timeZone,t,onClose,onAdd,onEdit,onToggle,onMoveOverdue,onCompleteOverdue}:{date:string;items:Occurrence[];overdue:Overdue[];tab:'timeline'|'todo'|'notes';setTab:(x:'timeline'|'todo'|'notes')=>void;holiday?:string;dayOff?:DayOff;locale:string;timeZone:string;t:(k:string)=>string;onClose:()=>void;onAdd:(time?:string,type?:'TASK'|'EVENT'|'NOTE')=>void;onEdit:(id:string)=>void;onToggle:(x:Occurrence)=>void;onMoveOverdue:(x:Overdue)=>void;onCompleteOverdue:(x:Overdue)=>void}){
 const d=parseKey(date),title=new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long'}).format(d),tasks=items.filter(x=>x.type==='TASK'),notes=items.filter(x=>x.type==='NOTE'),allDay=items.filter(x=>x.allDay),timed=items.filter(x=>!x.allDay);const firstHour=Math.min(6,...timed.map(x=>zonedPartsClient(x.occurrenceAt,timeZone).hour)),hours=Array.from({length:24-firstHour},(_,i)=>i+firstHour),done=tasks.filter(x=>x.completedAt).length
 const time=(iso:string)=>formatInTimeZone(iso,locale,timeZone,{hour:'2-digit',minute:'2-digit'})
 return <div className="modalBackdrop dayModalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="dayPlanModal"><header className="dayPlanHead"><div><div className="eyebrow">{t('dayPlan')}</div><h2>{title}</h2><div className="dayPlanMeta">{tasks.length>0&&<span>{done}/{tasks.length} {t('completed').toLowerCase()}</span>}{holiday&&<span className="holidayBadge">{holiday}</span>}{dayOff&&<span className="dayOffBadge">{dayOff.label}</span>}</div></div><button className="btn btnSoft iconBtn" onClick={onClose}><X size={19}/></button></header>
  {overdue.length>0&&<div className="overdueBlock"><div className="overdueHead"><div><strong>{t('previousDayTasks')}</strong><small>{t('smartCarryHint')}</small></div></div><div className="overdueList">{overdue.map(x=><div className="overdueRow" key={x.id}><button className="itemCheck" onClick={()=>onCompleteOverdue(x)} aria-label={t('complete')}/><span><strong>{x.title}</strong><small>{x.dueAt?formatInTimeZone(x.dueAt,locale,timeZone,{day:'numeric',month:'short'}):''}</small></span><button className="btn btnSoft btnTiny" onClick={()=>onMoveOverdue(x)}><RotateCcw size={13}/>{t('moveToToday')}</button></div>)}</div></div>}
  <div className="dayTabs"><button className={tab==='timeline'?'active':''} onClick={()=>setTab('timeline')}><Clock3 size={16}/>{t('timeline')}</button><button className={tab==='todo'?'active':''} onClick={()=>setTab('todo')}><Check size={16}/>{t('todo')} {tasks.length?`(${tasks.length})`:''}</button><button className={tab==='notes'?'active':''} onClick={()=>setTab('notes')}><NotebookPen size={16}/>{t('notes')} {notes.length?`(${notes.length})`:''}</button></div>
  <div className="dayPlanBody">{tab==='timeline'&&<><p className="timelineHint">{t('tapTimeHint')}</p>{allDay.length>0&&<div className="allDayStrip"><span>{t('allDay')}</span><div>{allDay.map(x=><PlanChip key={`${x.id}-${x.occurrenceAt}`} item={x} locale={locale} timeZone={timeZone} onEdit={onEdit} onToggle={onToggle}/>)}</div></div>}<div className="timelineList">{hours.map(hour=>{const hs=String(hour).padStart(2,'0'),at=timed.filter(x=>zonedPartsClient(x.occurrenceAt,timeZone).hour===hour);return <div className="timelineHour" key={hour}><button className="timeButton" onClick={()=>onAdd(`${hs}:00`)}>{hs}:00</button><div className="timelineSlot" onClick={()=>onAdd(`${hs}:00`)}>{at.length?at.map(x=><PlanChip key={`${x.id}-${x.occurrenceAt}`} item={x} locale={locale} timeZone={timeZone} onEdit={onEdit} onToggle={onToggle}/>):<span className="slotPlus">＋</span>}</div></div>})}</div></>}
   {tab==='todo'&&<div className="tabSimple"><button className="btn btnPrimary addTabButton" onClick={()=>onAdd('09:00','TASK')}><CalendarPlus size={16}/>{t('addTask')}</button>{tasks.length?<div className="todoDayList">{tasks.map(x=><div className={`todoDayRow ${x.completedAt?'completed':''}`} key={`${x.id}-${x.occurrenceAt}`}><button className={`itemCheck ${x.completedAt?'done':''}`} onClick={()=>onToggle(x)}>{x.completedAt&&<Check size={14}/>}</button><button className="todoMain" onClick={()=>onEdit(x.id)}><strong>{x.title}</strong><small>{x.allDay?t('allDay'):time(x.occurrenceAt)}{x.description?` · ${x.description}`:''}</small></button></div>)}</div>:<div className="emptyState compactEmpty">{t('noTasksDay')}</div>}</div>}
   {tab==='notes'&&<div className="tabSimple"><button className="btn btnPrimary addTabButton" onClick={()=>onAdd('09:00','NOTE')}><NotebookPen size={16}/>{t('addNote')}</button>{notes.length?<div className="notesDayGrid">{notes.map(x=><button className="noteCard" key={`${x.id}-${x.occurrenceAt}`} onClick={()=>onEdit(x.id)}><strong>{x.title}</strong>{x.description&&<p>{x.description}</p>}<small>{x.allDay?t('allDay'):time(x.occurrenceAt)}</small></button>)}</div>:<div className="emptyState compactEmpty">{t('noNotesDay')}</div>}</div>}
  </div></section></div>
}

function PlanChip({item,locale,timeZone,onEdit,onToggle}:{item:Occurrence;locale:string;timeZone:string;onEdit:(id:string)=>void;onToggle:(x:Occurrence)=>void}){const time=item.allDay?'':formatInTimeZone(item.occurrenceAt,locale,timeZone,{hour:'2-digit',minute:'2-digit'});return <div className={`timelineItem type-${item.type.toLowerCase()} ${item.completedAt?'completed':''}`} style={{borderLeftColor:item.color||'var(--accent)'}} onClick={e=>e.stopPropagation()}>{item.type==='TASK'?<button className={`itemCheck ${item.completedAt?'done':''}`} onClick={()=>onToggle(item)}>{item.completedAt&&<Check size={13}/>}</button>:item.type==='NOTE'?<NotebookPen size={16}/>:<Circle size={13} fill={item.color||'var(--accent)'} color={item.color||'var(--accent)'}/>}<button className="timelineItemMain" onClick={()=>onEdit(item.id)}><strong>{item.title}</strong><small>{time}{item.occurrenceEndAt?` – ${formatInTimeZone(item.occurrenceEndAt,locale,timeZone,{hour:'2-digit',minute:'2-digit'})}`:''}</small></button></div>}

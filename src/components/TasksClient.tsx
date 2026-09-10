'use client'
import { Check,CalendarPlus,RotateCcw } from 'lucide-react'
import { useCallback,useEffect,useMemo,useState } from 'react'
import { localeFor,useI18n } from '@/lib/i18n'
import { deviceTimeZone, formatInTimeZone, moveIsoToZonedDateKeepingTime, safeTimeZone, zonedDateKey } from '@/lib/timezone-client'

type Item={id:string;type:string;title:string;description?:string|null;dueAt?:string|null;completedAt?:string|null;isInbox:boolean;repeatType:string;priority:string;color?:string|null}

export default function TasksClient(){
 const {t,lang}=useI18n(),locale=localeFor[lang]
 const [items,setItems]=useState<Item[]>([]),[timeZone,setTimeZone]=useState(deviceTimeZone())
 const today=zonedDateKey(new Date(),timeZone)
 const load=useCallback(()=>fetch('/api/sync/bootstrap',{cache:'no-store'}).then(r=>r.json()).then(d=>{setItems((d.items||[]).filter((x:Item)=>x.type==='TASK'&&x.repeatType==='NONE'));if(d.settings?.timezone)setTimeZone(safeTimeZone(d.settings.timezone))}).catch(()=>undefined),[])
 useEffect(()=>{void load();const r=()=>void load();window.addEventListener('plandan:refresh',r);return()=>window.removeEventListener('plandan:refresh',r)},[load])
 const groups=useMemo(()=>{const dateOf=(iso?:string|null)=>iso?zonedDateKey(iso,timeZone):'';const open=items.filter(x=>!x.completedAt),completed=items.filter(x=>x.completedAt).sort((a,b)=>Number(new Date(b.completedAt!))-Number(new Date(a.completedAt!))).slice(0,20);return{overdue:open.filter(x=>!x.isInbox&&x.dueAt&&dateOf(x.dueAt)<today),today:open.filter(x=>!x.isInbox&&dateOf(x.dueAt)===today),upcoming:open.filter(x=>!x.isInbox&&x.dueAt&&dateOf(x.dueAt)>today),unscheduled:open.filter(x=>x.isInbox||!x.dueAt),completed}},[items,today,timeZone])
 async function toggle(x:Item){const next=!x.completedAt;setItems(p=>p.map(i=>i.id===x.id?{...i,completedAt:next?new Date().toISOString():null}:i));await fetch(`/api/items/${x.id}/occurrence`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({occurrenceAt:x.dueAt||new Date().toISOString(),completed:next})});window.dispatchEvent(new Event('plandan:refresh'))}
 async function todayMove(x:Item){await fetch(`/api/items/${x.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({dueAt:moveIsoToZonedDateKeepingTime(x.dueAt,today,timeZone),isInbox:false})});void load()}
 function edit(id:string){window.dispatchEvent(new CustomEvent('plandan:edit',{detail:{id}}))}
 function add(){window.dispatchEvent(new CustomEvent('plandan:quickadd',{detail:{type:'TASK',unscheduled:true}}))}
 const Block=({title,rows,move=false}:{title:string;rows:Item[];move?:boolean})=>rows.length?<section className="taskGroup"><h2>{title}<span>{rows.length}</span></h2><div className="taskLibraryList">{rows.map(x=><div className={`taskLibraryRow card ${x.completedAt?'completed':''}`} key={x.id}><button className={`itemCheck ${x.completedAt?'done':''}`} onClick={()=>toggle(x)}>{x.completedAt&&<Check size={14}/>}</button><button className="taskLibraryMain" onClick={()=>edit(x.id)}><strong>{x.title}</strong><small>{x.dueAt?formatInTimeZone(x.dueAt,locale,timeZone,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):t('noDate')}{x.description?` · ${x.description}`:''}</small></button>{move&&<button className="btn btnSoft btnTiny" onClick={()=>todayMove(x)}><RotateCcw size={13}/>{t('moveToToday')}</button>}</div>)}</div></section>:null
 return <div className="libraryPage"><div className="simplePageHead actionHead"><div><h1>{t('taskLibrary')}</h1><p>{t('allTasksHint')}</p></div><button className="btn btnPrimary" onClick={add}><CalendarPlus size={16}/>{t('addTask')}</button></div>{!items.length?<div className="card emptyState">{t('noGlobalTasks')}</div>:<><Block title={t('overdue')} rows={groups.overdue} move/><Block title={t('todayTasks')} rows={groups.today}/><Block title={t('upcomingTasks')} rows={groups.upcoming}/><Block title={t('unscheduled')} rows={groups.unscheduled}/><Block title={t('completedTasks')} rows={groups.completed}/></>}</div>
}

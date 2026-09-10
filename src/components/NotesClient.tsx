'use client'
import { NotebookPen,Search } from 'lucide-react'
import { useCallback,useEffect,useMemo,useState } from 'react'
import { localeFor,useI18n } from '@/lib/i18n'
import { deviceTimeZone, formatInTimeZone, safeTimeZone } from '@/lib/timezone-client'

type Item={id:string;type:string;title:string;description?:string|null;startAt?:string|null;isInbox:boolean;createdAt:string;color?:string|null}
export default function NotesClient(){
 const{t,lang}=useI18n(),locale=localeFor[lang];const[items,setItems]=useState<Item[]>([]),[q,setQ]=useState(''),[timeZone,setTimeZone]=useState(deviceTimeZone())
 const load=useCallback(()=>fetch('/api/sync/bootstrap',{cache:'no-store'}).then(r=>r.json()).then(d=>{setItems((d.items||[]).filter((x:Item)=>x.type==='NOTE'));if(d.settings?.timezone)setTimeZone(safeTimeZone(d.settings.timezone))}).catch(()=>undefined),[])
 useEffect(()=>{void load();const r=()=>void load();window.addEventListener('plandan:refresh',r);return()=>window.removeEventListener('plandan:refresh',r)},[load])
 const filtered=useMemo(()=>items.filter(x=>`${x.title} ${x.description||''}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>Number(new Date(b.startAt||b.createdAt))-Number(new Date(a.startAt||a.createdAt))),[items,q])
 function add(){window.dispatchEvent(new CustomEvent('plandan:quickadd',{detail:{type:'NOTE',unscheduled:true}}))}function edit(id:string){window.dispatchEvent(new CustomEvent('plandan:edit',{detail:{id}}))}
 return <div className="libraryPage"><div className="simplePageHead actionHead"><div><h1>{t('noteLibrary')}</h1><p>{t('allNotesHint')}</p></div><button className="btn btnPrimary" onClick={add}><NotebookPen size={16}/>{t('addNote')}</button></div><label className="searchBox"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={t('searchNotes')}/></label>{filtered.length?<div className="noteLibraryGrid">{filtered.map(x=><button className="card noteLibraryCard" key={x.id} onClick={()=>edit(x.id)}><span className="noteColor" style={{background:x.color||'var(--accent)'}}/><strong>{x.title}</strong>{x.description&&<p>{x.description}</p>}<small>{x.startAt?formatInTimeZone(x.startAt,locale,timeZone,{weekday:'short',day:'numeric',month:'short',year:'numeric'}):t('noDate')}</small></button>)}</div>:<div className="card emptyState">{t('noGlobalNotes')}</div>}</div>
}

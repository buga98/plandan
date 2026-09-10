'use client'

import { Heart, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { deviceTimeZone, safeTimeZone, zonedDateKey } from '@/lib/timezone-client'

export default function ReflectionCard({ date: requestedDate }: { date?: string }) {
  const { t } = useI18n()
  const [date,setDate]=useState(requestedDate||zonedDateKey(new Date(),deviceTimeZone()))
  const [mood,setMood]=useState<number|null>(null)
  const [energy,setEnergy]=useState<number|null>(null)
  const [gratitude,setGratitude]=useState('')
  const [note,setNote]=useState('')
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)

  useEffect(()=>{
    if(requestedDate)return
    fetch('/api/settings',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{
      if(d?.settings?.timezone)setDate(zonedDateKey(new Date(),safeTimeZone(d.settings.timezone)))
    }).catch(()=>undefined)
  },[requestedDate])

  useEffect(()=>{
    let active=true
    const load=()=>fetch(`/api/reflection?date=${date}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{
      if(!active||!data)return
      const x=data.reflection
      setMood(x?.mood??null);setEnergy(x?.energy??null);setGratitude(x?.gratitude||'');setNote(x?.note||'');setSaved(false)
    }).catch(()=>undefined)
    void load()
    const refresh=()=>void load()
    window.addEventListener('plandan:refresh',refresh)
    return()=>{active=false;window.removeEventListener('plandan:refresh',refresh)}
  },[date])

  async function save(){
    setSaving(true);setSaved(false)
    try{
      const res=await fetch('/api/reflection',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,mood,energy,gratitude,note})})
      if(res.ok){setSaved(true);setTimeout(()=>setSaved(false),1800)}
    }finally{setSaving(false)}
  }

  return <div className="card reflectionCard">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:15}}><div><div className="cardTitle">{t('reflections')}</div><div className="small muted" style={{marginTop:3}}>{t('reflectionHint')}</div></div><Sparkles size={18} color="var(--accent)"/></div>
    <div className="formStack" style={{gap:12}}>
      <div className="label"><span>{t('mood')}</span><div className="scaleRow">{['😣','😕','😐','🙂','😄'].map((x,i)=><button className={`scaleBtn ${mood===i+1?'active':''}`} type="button" onClick={()=>setMood(i+1)} key={x}>{x}</button>)}</div></div>
      <div className="label"><span>{t('energy')}</span><div className="scaleRow">{[1,2,3,4,5].map(x=><button className={`scaleBtn ${energy===x?'active':''}`} type="button" onClick={()=>setEnergy(x)} key={x}>{x}</button>)}</div></div>
      <label className="label">{t('gratitude')}<input className="input" value={gratitude} onChange={e=>setGratitude(e.target.value)} /></label>
      <label className="label">{t('dayNote')}<textarea className="textarea" style={{minHeight:80}} value={note} onChange={e=>setNote(e.target.value)} /></label>
      <button className="btn btnSoft" type="button" onClick={save} disabled={saving}><Heart size={16}/>{saved?t('saved'):saving?t('saving'):t('saveReflection')}</button>
    </div>
  </div>
}

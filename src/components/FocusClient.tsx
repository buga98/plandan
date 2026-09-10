'use client'
import { CheckCircle2, Pause, Play, RotateCcw, TimerReset } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'

export default function FocusClient(){
 const {t}=useI18n();const [minutes,setMinutes]=useState(25);const [remaining,setRemaining]=useState(25*60);const [targetAt,setTargetAt]=useState<number|null>(null);const [label,setLabel]=useState('');const startRef=useRef<string|null>(null);const initialSec=useRef(25*60)
 const running=targetAt!==null
 useEffect(()=>{const raw=localStorage.getItem('plandan_focus');if(!raw)return;try{const x=JSON.parse(raw);if(x.targetAt&&x.targetAt>Date.now()){setMinutes(x.minutes);initialSec.current=x.initialSec;setRemaining(Math.ceil((x.targetAt-Date.now())/1000));setTargetAt(x.targetAt);setLabel(x.label||'');startRef.current=x.startedAt||new Date().toISOString()}}catch{}},[])
 useEffect(()=>{if(!targetAt)return;const tick=()=>{const r=Math.max(0,Math.ceil((targetAt-Date.now())/1000));setRemaining(r);if(r<=0){void finish(true)}};tick();const id=setInterval(tick,500);return()=>clearInterval(id)},[targetAt])
 useEffect(()=>{if(targetAt)localStorage.setItem('plandan_focus',JSON.stringify({targetAt,minutes,initialSec:initialSec.current,label,startedAt:startRef.current}));else localStorage.removeItem('plandan_focus')},[targetAt,label,minutes])
 function preset(m:number){if(running)return;setMinutes(m);setRemaining(m*60);initialSec.current=m*60}
 function start(){if(remaining<=0){setRemaining(minutes*60);initialSec.current=minutes*60}if(!startRef.current)startRef.current=new Date().toISOString();setTargetAt(Date.now()+remaining*1000)}
 function pause(){if(!targetAt)return;setRemaining(Math.max(0,Math.ceil((targetAt-Date.now())/1000)));setTargetAt(null)}
 function reset(){setTargetAt(null);setRemaining(minutes*60);initialSec.current=minutes*60;startRef.current=null}
 async function finish(auto=false){
  const elapsed=Math.max(60,initialSec.current-Math.max(0,remaining));const durationMin=Math.max(1,Math.round(elapsed/60));const startedAt=startRef.current||new Date(Date.now()-elapsed*1000).toISOString();const endedAt=new Date().toISOString();setTargetAt(null);setRemaining(minutes*60);initialSec.current=minutes*60;startRef.current=null
  await fetch('/api/focus',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({durationMin,label:label.trim()||null,startedAt,endedAt,completed:true})}).catch(()=>undefined)
  if(auto&&'Notification'in window&&Notification.permission==='granted'){navigator.serviceWorker?.ready.then(reg=>reg.showNotification(`PlanDan · ${t('focusFinished')}`,{body:label?t('focusDone').replace('{label}',label):t('focusBreak'),icon:'/icons/icon-192.png'})).catch(()=>undefined)}
 }
 const pct=Math.min(100,Math.max(0,100-(remaining/initialSec.current)*100));const mm=String(Math.floor(remaining/60)).padStart(2,'0'),ss=String(remaining%60).padStart(2,'0')
 return <>
  <div className="appTop"><div className="pageTitle"><h1>{t('focus')}</h1><p>{t('focusHint')}</p></div></div>
  <div className="focusWrap"><div className="card focusCard"><div className="eyebrow"><TimerReset size={14}/> {t('deepWork')}</div><h2 style={{fontSize:30,letterSpacing:'-.04em',margin:'10px 0 5px'}}>{t('focusTitle')}</h2><p className="muted" style={{margin:0}}>{t('focusHint')}</p><div className="focusPresets" style={{marginTop:22}}>{[25,50,90].map(m=><button className={`chip ${minutes===m?'active':''}`} key={m} onClick={()=>preset(m)} disabled={running}>{m} {t('minutes')}</button>)}</div><div className="timerRing" style={{'--progress':`${pct}%`} as React.CSSProperties}><div><div className="timerValue">{mm}:{ss}</div><div className="timerSub">{Math.round(pct)}% · {label||t('focusHint')}</div></div></div><div style={{maxWidth:470,margin:'0 auto'}}><input className="input" value={label} onChange={e=>setLabel(e.target.value)} placeholder={t('focusLabel')} /></div><div className="focusActions">{running?<button className="btn btnPrimary" onClick={pause}><Pause size={17}/>{t('pause')}</button>:<button className="btn btnPrimary" onClick={start}><Play size={17}/>{t('start')}</button>}<button className="btn btnSoft" onClick={reset}><RotateCcw size={17}/>{t('reset')}</button><button className="btn btnSoft" onClick={()=>void finish(false)} disabled={initialSec.current===remaining&&!running}><CheckCircle2 size={17}/>{t('finish')}</button></div></div></div>
 </>
}

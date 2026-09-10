'use client'

import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, LogOut, Menu, Target } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Lang, useI18n } from '@/lib/i18n'
import QuickAddModal from './QuickAddModal'
import OfflineStatus from './OfflineStatus'
import FastLink from './FastLink'
import CalendarClient from './CalendarClient'
import HabitsClient from './HabitsClient'
import MoreClient from './MoreClient'

type User={id:string;name:string;email:string;settings:{language:Lang;theme:'SYSTEM'|'LIGHT'|'DARK';timezone:string;focusMinutes:number;breakMinutes:number}|null}
const nav=[{href:'/app',key:'calendar',icon:CalendarDays},{href:'/app/habits',key:'habits',icon:Target},{href:'/app/more',key:'more',icon:Menu}]
const primaryPaths=new Set(['/app','/app/habits','/app/more'])
const prefetchRoutes=['/app/more/tasks','/app/more/notes','/app/more/days-off','/app/more/checkin','/app/focus','/app/insights','/app/settings']

export default function AppShell({children,user}:{children:React.ReactNode;user:User}){
 const pathname=usePathname(),router=useRouter(),{t,setLang}=useI18n()
 const [clientPath,setClientPath]=useState(pathname)
 const [warmPrimary,setWarmPrimary]=useState(false)

 useEffect(()=>setClientPath(pathname),[pathname])
 useEffect(()=>{
  const onNavigate=(event:Event)=>{
   const href=(event as CustomEvent<{href?:string}>).detail?.href
   if(!href)return
   try{setClientPath(new URL(href,window.location.origin).pathname)}catch{}
  }
  const onPop=()=>setClientPath(window.location.pathname)
  window.addEventListener('plandan:navigate',onNavigate)
  window.addEventListener('popstate',onPop)
  return()=>{window.removeEventListener('plandan:navigate',onNavigate);window.removeEventListener('popstate',onPop)}
 },[])
 useEffect(()=>{
  const timer=window.setTimeout(()=>setWarmPrimary(true),120)
  return()=>window.clearTimeout(timer)
 },[])
 useEffect(()=>{
  if(navigator.onLine) for(const route of prefetchRoutes) router.prefetch(route)
 },[router])
 useEffect(()=>{if(!user.settings)return;setLang(user.settings.language);const root=document.documentElement;if(user.settings.theme==='SYSTEM')delete root.dataset.theme;else root.dataset.theme=user.settings.theme.toLowerCase()},[user.settings?.language,user.settings?.theme,setLang])

 const primaryPath=primaryPaths.has(clientPath)?clientPath:null
 const active=(href:string)=>href==='/app'?clientPath==='/app':href==='/app/more'?clientPath.startsWith('/app/more')||clientPath.startsWith('/app/focus')||clientPath.startsWith('/app/insights')||clientPath.startsWith('/app/settings'):clientPath.startsWith(href)
 const initials=user.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()
 async function logout(){await fetch('/api/auth/logout',{method:'POST'}).catch(()=>undefined);navigator.serviceWorker?.controller?.postMessage({type:'PLANDAN_CLEAR_PRIVATE'});router.replace('/login');router.refresh()}

 return <div className="appRoot">
  <aside className="sidebar simplifiedSidebar">
   <div className="sideBrand"><FastLink href="/app" className="brand"><img className="logoMark" src="/icons/icon-192.png" alt="PlanDan"/><span>PlanDan<small>{t('appTagline')}</small></span></FastLink></div>
   <nav className="sideNav">{nav.map(({href,key,icon:Icon})=><FastLink key={href} href={href} className={`navLink ${active(href)?'active':''}`}><Icon size={20}/><span>{t(key)}</span></FastLink>)}</nav>
   <div className="sideBottom"><OfflineStatus/><div className="userPill"><div className="avatar">{initials}</div><div><strong>{user.name}</strong><span>{user.email}</span></div></div><button className="navLink" onClick={logout} style={{border:0,width:'100%',background:'transparent',cursor:'pointer'}}><LogOut size={19}/>{t('logout')}</button></div>
  </aside>
  <header className="mobileHeader simplifiedHeader"><FastLink href="/app" className="brand"><img className="logoMark" src="/icons/icon-192.png" alt="PlanDan"/><span>PlanDan</span></FastLink><div className="mobileSync"><OfflineStatus/></div></header>
  <main className="appMain simpleAppMain">
   {(warmPrimary||primaryPath)&&<>
    <div hidden={primaryPath!=='/app'}><CalendarClient/></div>
    <div hidden={primaryPath!=='/app/habits'}><HabitsClient/></div>
    <div hidden={primaryPath!=='/app/more'}><MoreClient/></div>
   </>}
   {!primaryPath&&children}
  </main>
  <nav className="bottomNav simpleBottomNav">{nav.map(({href,key,icon:Icon})=><FastLink key={href} href={href} className={`bottomLink ${active(href)?'active':''}`}><Icon size={21}/><span>{t(key)}</span></FastLink>)}</nav>
  <QuickAddModal/>
 </div>
}

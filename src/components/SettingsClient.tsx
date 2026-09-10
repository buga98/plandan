'use client'
import { Bell, BellRing, Download, Globe2, KeyRound, Send, Smartphone, SunMoon, TimerReset } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Lang, useI18n } from '@/lib/i18n'
import { deviceTimeZone, safeTimeZone, validTimeZone } from '@/lib/timezone-client'
import LanguageSwitch from './LanguageSwitch'
import FastLink from './FastLink'

type Settings={language:Lang;theme:'SYSTEM'|'LIGHT'|'DARK';timezone:string;focusMinutes:number;breakMinutes:number;weekStartsMonday:boolean}
function b64ToUint8(base64:string){const padding='='.repeat((4-base64.length%4)%4);const base=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
export default function SettingsClient(){
 const {t,setLang}=useI18n();const [settings,setSettings]=useState<Settings|null>(null);const [pushEnabled,setPushEnabled]=useState(false);const [message,setMessage]=useState('');const [saving,setSaving]=useState(false);const [currentPassword,setCurrentPassword]=useState('');const [newPassword,setNewPassword]=useState('');const [nativeIos,setNativeIos]=useState(false);const [nativeTesting,setNativeTesting]=useState(false);const [lastSavedTimezone,setLastSavedTimezone]=useState('Europe/Zagreb')
 useEffect(()=>{
  fetch('/api/settings',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d.settings){const tz=safeTimeZone(d.settings.timezone);setSettings({...d.settings,timezone:tz});setLastSavedTimezone(tz)}}).catch(()=>undefined);void readPush()
  const detectNative=()=>setNativeIos(Boolean((window as any).PlanDanNative?.isNative&&((window as any).PlanDanNative?.platform==='ios')))
  const onNativeResult=(event:Event)=>{
   const detail=(event as CustomEvent).detail||{}
   setNativeTesting(false)
   if(detail.status==='scheduled')setMessage(t('nativeWatchScheduled'))
   else if(detail.status==='denied')setMessage(t('nativeWatchDenied'))
   else if(detail.status==='error')setMessage(t('error'))
  }
  detectNative()
  window.addEventListener('plandan-native-ready',detectNative)
  window.addEventListener('plandan-native-notification-result',onNativeResult)
  return()=>{window.removeEventListener('plandan-native-ready',detectNative);window.removeEventListener('plandan-native-notification-result',onNativeResult)}
 },[t])
 async function readPush(){if(!('serviceWorker'in navigator)||!('PushManager'in window))return;try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();setPushEnabled(Boolean(sub))}catch{}}
 async function update(patch:Partial<Settings>){if(!settings)return;if(patch.timezone&&!validTimeZone(patch.timezone)){setSettings({...settings,timezone:lastSavedTimezone});setMessage(`${t('timezone')}: IANA`);setTimeout(()=>setMessage(''),2000);return}const next={...settings,...patch};setSettings(next);if(patch.language)setLang(patch.language);if(patch.theme){if(patch.theme==='SYSTEM')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=patch.theme.toLowerCase()}if(patch.timezone){setLastSavedTimezone(patch.timezone);window.dispatchEvent(new CustomEvent('plandan:settings-changed',{detail:{timezone:patch.timezone}}))}setSaving(true);try{const r=await fetch('/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});if(!r.ok)throw new Error();setMessage(t('saved'));setTimeout(()=>setMessage(''),1500)}catch{if(patch.timezone){setSettings({...next,timezone:lastSavedTimezone});setLastSavedTimezone(lastSavedTimezone)}setMessage(t('error'))}finally{setSaving(false)}}
 async function enablePush(){setMessage('');try{if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('unsupported');const permission=await Notification.requestPermission();if(permission!=='granted'){setMessage(t('notificationsNeeded'));return}const [reg,keyRes]=await Promise.all([navigator.serviceWorker.ready,fetch('/api/push/key')]);if(!keyRes.ok)throw new Error();const {publicKey}=await keyRes.json();let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(publicKey)});const json=sub.toJSON();const r=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:json.endpoint,keys:json.keys})});if(!r.ok)throw new Error();setPushEnabled(true);setMessage(t('pushOn'))}catch{setMessage(t('error'))}}
 async function disablePush(){try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){await fetch('/api/push/subscribe',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe()}setPushEnabled(false)}catch{setMessage(t('error'))}}
 async function testPush(){const r=await fetch('/api/push/test',{method:'POST'});const d=await r.json().catch(()=>({}));setMessage(r.ok?`Push: ${d.sent||0}`:t('error'))}
 function testNativeWatch(){
  const bridge=(window as any).PlanDanNative
  if(!bridge?.isNative||bridge?.platform!=='ios'||typeof bridge?.testNotification!=='function'){
   setMessage(t('nativeWatchRequiresApp'));return
  }
  setNativeTesting(true);setMessage('')
  try{bridge.testNotification()}catch{setNativeTesting(false);setMessage(t('error'))}
 }
 async function changePassword(e:FormEvent){e.preventDefault();setMessage('');const r=await fetch('/api/account/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword})});if(r.ok){setCurrentPassword('');setNewPassword('');setMessage(t('saved'))}else setMessage(t('error'))}
 if(!settings)return <div className="card skeleton" style={{height:360}}/>
 return <>
  <div className="appTop"><div className="pageTitle"><h1>{t('settings')}</h1><p>{t('settingsSubtitle')}</p></div>{message&&<span className="badge">{message}</span>}</div>
  <div className="settingsGrid">
   <section className="card settingCard"><h2><Globe2 size={18} style={{verticalAlign:-3,marginRight:7}}/>{t('language')}</h2><p>{t('languageHint')}</p><div className="settingsLanguagePicker"><LanguageSwitch compact={false} value={settings.language} onChange={language=>void update({language})}/></div><div className="settingRow"><div className="meta"><strong>{t('timezone')}</strong><span>{t('timezoneHint')}</span></div><div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}><input className="input" style={{width:190}} value={settings.timezone} onChange={e=>setSettings({...settings,timezone:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur()}}} onBlur={()=>void update({timezone:settings.timezone.trim()})}/><button className="btn btnSoft btnTiny" type="button" onClick={()=>void update({timezone:deviceTimeZone()})}>Auto</button></div></div></section>
   <section className="card settingCard"><h2><SunMoon size={18} style={{verticalAlign:-3,marginRight:7}}/>{t('theme')}</h2><p>{t('themeHint')}</p><div className="segmented"><button className={settings.theme==='SYSTEM'?'active':''} onClick={()=>void update({theme:'SYSTEM'})}>{t('system')}</button><button className={settings.theme==='LIGHT'?'active':''} onClick={()=>void update({theme:'LIGHT'})}>{t('light')}</button><button className={settings.theme==='DARK'?'active':''} onClick={()=>void update({theme:'DARK'})}>{t('dark')}</button></div></section>
   <section className="card settingCard"><h2><BellRing size={18} style={{verticalAlign:-3,marginRight:7}}/>{t('push')}</h2><p>{t('enablePushHint')}</p><div className="settingRow"><div className="meta"><strong>{pushEnabled?t('pushOn'):t('pushOff')}</strong><span>{t('pushDevice')}</span></div><button className={`btn ${pushEnabled?'btnSoft':'btnPrimary'}`} onClick={pushEnabled?disablePush:enablePush}>{pushEnabled?<Bell size={16}/>:<BellRing size={16}/>} {pushEnabled?t('disable'):t('enable')}</button></div>{pushEnabled&&<button className="btn btnSoft" style={{width:'100%',marginTop:10}} onClick={testPush}><Send size={16}/>{t('notificationTest')}</button>}<FastLink href="/info" className="btn btnGhost"><Smartphone size={16}/>{t('install')}</FastLink></section>
   {nativeIos&&<section className="card settingCard nativeWatchCard"><h2><Smartphone size={18} style={{verticalAlign:-3,marginRight:7}}/>{t('nativeWatchTitle')}</h2><p>{t('nativeWatchHintReady')}</p><div className="settingRow"><div className="meta"><strong>{t('nativeWatchDetected')}</strong><span>{t('nativeWatchHuawei')}</span></div><span className="badge successBadge">iOS native</span></div><button className="btn btnPrimary" style={{width:'100%',marginTop:10}} onClick={testNativeWatch} disabled={nativeTesting}>{nativeTesting?t('nativeWatchWaiting'):t('nativeWatchTest')}</button></section>}
   <section className="card settingCard"><h2><TimerReset size={18} style={{verticalAlign:-3,marginRight:7}}/>{t('focus')}</h2><p>{t('focusDefaults')}</p><div className="formGrid"><label className="label">{t('focus')}<input className="input" type="number" min={5} max={180} value={settings.focusMinutes} onChange={e=>setSettings({...settings,focusMinutes:Number(e.target.value)})} onBlur={()=>void update({focusMinutes:settings.focusMinutes})}/></label><label className="label">{t('breakLabel')}<input className="input" type="number" min={1} max={60} value={settings.breakMinutes} onChange={e=>setSettings({...settings,breakMinutes:Number(e.target.value)})} onBlur={()=>void update({breakMinutes:settings.breakMinutes})}/></label></div></section>
   <section className="card settingCard"><h2><Download size={18} style={{verticalAlign:-3,marginRight:7}}/>{t('privacy')}</h2><p>{t('privacyHint')}</p><a className="btn btnSoft" style={{width:'100%'}} href="/api/account/export"><Download size={16}/>{t('exportData')}</a></section>
   <section className="card settingCard"><h2><KeyRound size={18} style={{verticalAlign:-3,marginRight:7}}/>{t('changePassword')}</h2><p>{t('passwordHint')}</p><form className="formStack" onSubmit={changePassword}><label className="label">{t('currentPassword')}<input className="input" type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password"/></label><label className="label">{t('newPassword')}<input className="input" type="password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password"/></label><button className="btn btnPrimary" disabled={!currentPassword||newPassword.length<8}>{t('update')}</button></form></section>
  </div>
 </>
}

const CACHE = 'plandan-v2-shell-v2'
const DB_NAME = 'plandan-local-first-v1'
const DB_VERSION = 1
const SHELL = ['/v2/index.html', '/v2/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

let dbPromise
function openDb(){
  if(dbPromise)return dbPromise
  dbPromise=new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION)
    r.onupgradeneeded=()=>{
      const db=r.result
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})
      if(!db.objectStoreNames.contains('queue'))db.createObjectStore('queue',{keyPath:'id',autoIncrement:true})
      if(!db.objectStoreNames.contains('idMap'))db.createObjectStore('idMap',{keyPath:'localId'})
      if(!db.objectStoreNames.contains('apiCache'))db.createObjectStore('apiCache',{keyPath:'key'})
    }
    r.onsuccess=()=>resolve(r.result)
    r.onerror=()=>reject(r.error)
  })
  return dbPromise
}
async function get(store,key){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
async function put(store,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error)})}
async function add(store,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite'),r=tx.objectStore(store).add(value);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function del(store,key){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function all(store){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
async function boot(){return (await get('meta','bootstrap'))?.value||null}
async function setBoot(value){if(value)await put('meta',{key:'bootstrap',value,updatedAt:Date.now()})}
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','X-PlanDan-V2':'local'}})}
function localId(prefix){return `local-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function dayKey(value){return String(value||'').slice(0,10)}
async function broadcast(data){const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients)client.postMessage(data)}

async function applyLocalMutation(path,method,body){
  const data=await boot();if(!data)return
  const now=new Date().toISOString()

  if(path==='/api/items'&&method==='POST'){
    const id=localId('item')
    data.items=[...(data.items||[]),{id,userId:data.profile?.id,type:body?.type||'TASK',title:body?.title||'',description:body?.description||null,startAt:body?.startAt||null,endAt:body?.endAt||null,dueAt:body?.dueAt||null,allDay:Boolean(body?.allDay),completedAt:null,priority:body?.priority||'MEDIUM',category:body?.category||null,color:body?.color||'#6f5cff',isInbox:Boolean(body?.isInbox),repeatType:body?.repeatType||'NONE',repeatInterval:Number(body?.repeatInterval||1),repeatUntil:body?.repeatUntil||null,createdAt:now,updatedAt:now,reminders:(body?.reminderOffsets||[]).map(offsetMinutes=>({id:localId('reminder'),offsetMinutes})),occurrenceStates:[]}]
  }

  const occurrenceMatch=path.match(/^\/api\/items\/([^/]+)\/occurrence$/)
  if(occurrenceMatch&&method==='POST'){
    const id=occurrenceMatch[1],at=body?.occurrenceAt,done=Boolean(body?.completed)
    data.items=(data.items||[]).map(item=>{
      if(item.id!==id)return item
      if(item.repeatType==='NONE')return {...item,completedAt:done?now:null,updatedAt:now}
      const states=[...(item.occurrenceStates||[])],idx=states.findIndex(x=>new Date(x.occurrenceAt).getTime()===new Date(at).getTime()),next={...(idx>=0?states[idx]:{}),id:idx>=0?states[idx].id:localId('occurrence'),occurrenceAt:at,completedAt:done?now:null,skippedAt:null}
      if(idx>=0)states[idx]=next;else states.push(next)
      return {...item,occurrenceStates:states,updatedAt:now}
    })
  }

  if(path==='/api/habits'&&method==='POST'){
    data.habits=[...(data.habits||[]),{id:localId('habit'),userId:data.profile?.id,name:body?.name||'',emoji:body?.emoji||'✓',color:body?.color||'#6f5cff',targetPerWeek:Number(body?.targetPerWeek||7),targetPerDay:Number(body?.targetPerDay||1),reminderMode:body?.reminderMode||'NONE',reminderTime:body?.reminderTime||null,reminderIntervalMinutes:body?.reminderIntervalMinutes||null,reminderStartTime:body?.reminderStartTime||null,reminderEndTime:body?.reminderEndTime||null,archived:false,checkins:[]}]
  }

  const habitCheck=path.match(/^\/api\/habits\/([^/]+)\/checkin$/)
  if(habitCheck&&method==='POST'){
    const id=habitCheck[1],key=body?.date,count=Math.max(0,Number(body?.count||0))
    data.habits=(data.habits||[]).map(h=>{
      if(h.id!==id)return h
      const checkins=[...(h.checkins||[])].filter(c=>dayKey(c.date)!==key)
      if(count>0)checkins.push({id:localId('checkin'),date:`${key}T00:00:00.000Z`,count})
      return {...h,checkins}
    })
  }

  if(path==='/api/reflection'&&method==='PUT'){
    const key=body?.date,row={id:localId('reflection'),userId:data.profile?.id,date:`${key}T00:00:00.000Z`,mood:body?.mood??null,energy:body?.energy??null,gratitude:body?.gratitude||null,note:body?.note||null,createdAt:now,updatedAt:now}
    data.reflections=[...(data.reflections||[]).filter(x=>dayKey(x.date)!==key),row]
  }

  if(path==='/api/settings'&&method==='PATCH')data.settings={...(data.settings||{}),...(body||{}),updatedAt:now}

  if(path==='/api/day-offs'&&method==='POST'){
    const key=body?.date,row={id:localId('dayoff'),userId:data.profile?.id,date:`${key}T00:00:00.000Z`,label:body?.label||'',color:body?.color||'#ef5da8',createdAt:now,updatedAt:now}
    data.dayOffs=[...(data.dayOffs||[]).filter(x=>dayKey(x.date)!==key),row]
  }

  if(path==='/api/focus'&&method==='POST')data.focusSessions=[...(data.focusSessions||[]),{id:localId('focus'),userId:data.profile?.id,...body,createdAt:now}]

  await setBoot(data)
}

async function refresh(){
  try{
    const r=await fetch('/api/sync/bootstrap',{credentials:'include',cache:'no-store'})
    if(!r.ok)return false
    const data=await r.json();await setBoot(data);await broadcast({type:'PLANDAN_DATA_REFRESHED'});return true
  }catch{return false}
}
let processing=false
async function processQueue(){
  if(processing)return
  processing=true
  try{
    const queue=(await all('queue')).sort((a,b)=>Number(a.id)-Number(b.id))
    if(!queue.length){await refresh();await broadcast({type:'PLANDAN_SYNC_STATUS',status:'synced'});return}
    await broadcast({type:'PLANDAN_SYNC_STATUS',status:'syncing'})
    for(const entry of queue){
      try{
        const r=await fetch(entry.url,{method:entry.method,credentials:'include',headers:entry.bodyText?{'Content-Type':'application/json'}:undefined,body:entry.bodyText||undefined})
        if(r.status===401){await broadcast({type:'PLANDAN_SYNC_STATUS',status:'auth'});return}
        if(!r.ok&&r.status>=500)throw new Error('server')
        if(r.ok||r.status<500)await del('queue',entry.id)
      }catch{await broadcast({type:'PLANDAN_SYNC_STATUS',status:'pending'});return}
    }
    await refresh();await broadcast({type:'PLANDAN_SYNC_COMPLETE'});await broadcast({type:'PLANDAN_SYNC_STATUS',status:'synced'})
  }finally{processing=false}
}

self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>undefined));self.skipWaiting()})
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('plandan-v2-shell-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())})

self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url)
  if(url.origin!==self.location.origin)return

  if(req.method==='GET'&&url.pathname==='/api/sync/bootstrap'){
    event.respondWith((async()=>{
      const local=await boot()
      if(local){event.waitUntil(refresh());return json(local)}
      try{const r=await fetch(req.clone());if(r.ok){const data=await r.clone().json();await setBoot(data)}return r}catch{return json({error:'OFFLINE_NO_DATA'},503)}
    })());return
  }

  if(url.pathname.startsWith('/api/')&&req.method!=='GET'&&url.pathname!=='/api/auth/logout'){
    event.respondWith((async()=>{
      const bodyText=await req.clone().text().catch(()=>''),body=bodyText?JSON.parse(bodyText):null
      await applyLocalMutation(url.pathname,req.method,body).catch(()=>undefined)
      await add('queue',{method:req.method,url:url.pathname+url.search,bodyText,createdAt:Date.now()})
      await broadcast({type:'PLANDAN_LOCAL_CHANGE'});await broadcast({type:'PLANDAN_SYNC_STATUS',status:self.navigator.onLine===false?'pending':'syncing'})
      event.waitUntil(processQueue())
      try{if('sync' in self.registration)await self.registration.sync.register('plandan-v2-sync')}catch{}
      return json({ok:true,queued:true},202)
    })());return
  }

  if(req.method==='GET'&&(url.pathname==='/v2/'||url.pathname==='/v2/index.html')){
    event.respondWith((async()=>{const c=await caches.open(CACHE),cached=await c.match('/v2/index.html');try{const r=await fetch(req);if(r.ok)event.waitUntil(c.put('/v2/index.html',r.clone()));return r}catch{return cached||Response.error()}})());return
  }

  if(req.method==='GET'&&url.pathname.startsWith('/v2/')){
    event.respondWith((async()=>{const c=await caches.open(CACHE),cached=await c.match(req);if(cached)return cached;try{const r=await fetch(req);if(r.ok)event.waitUntil(c.put(req,r.clone()));return r}catch{return Response.error()}})());return
  }
})

self.addEventListener('message',event=>{
  const type=event.data?.type
  if(type==='PLANDAN_SYNC_NOW')event.waitUntil(processQueue())
  if(type==='PLANDAN_REFRESH_DATA')event.waitUntil(refresh())
  if(type==='PLANDAN_CLEAR_PRIVATE')event.waitUntil(caches.delete(CACHE))
})
self.addEventListener('sync',event=>{if(event.tag==='plandan-v2-sync')event.waitUntil(processQueue())})

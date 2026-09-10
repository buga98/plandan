const CACHE='plandan-v2-shell-v2'
const DB_NAME='plandan-v2-local-first-v1'
const DB_VERSION=1
const SHELL=['/v2','/manifest-v2.webmanifest','/icons/icon-192.png','/icons/icon-512.png']

let dbPromise=null
function openDb(){
  if(dbPromise)return dbPromise
  dbPromise=new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,DB_VERSION)
    r.onupgradeneeded=()=>{
      const db=r.result
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})
      if(!db.objectStoreNames.contains('queue'))db.createObjectStore('queue',{keyPath:'id',autoIncrement:true})
    }
    r.onsuccess=()=>resolve(r.result)
    r.onerror=()=>reject(r.error)
  })
  return dbPromise
}
function tx(store,mode,fn){return openDb().then(db=>new Promise((resolve,reject)=>{const t=db.transaction(store,mode);const s=t.objectStore(store);let out;try{out=fn(s)}catch(e){reject(e);return}t.oncomplete=()=>resolve(out);t.onerror=()=>reject(t.error)}))}
async function get(store,key){const db=await openDb();return new Promise((resolve,reject)=>{const t=db.transaction(store,'readonly');const r=t.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
async function all(store){const db=await openDb();return new Promise((resolve,reject)=>{const t=db.transaction(store,'readonly');const r=t.objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
async function put(store,value){await tx(store,'readwrite',s=>s.put(value))}
async function add(store,value){await tx(store,'readwrite',s=>s.add(value))}
async function del(store,key){await tx(store,'readwrite',s=>s.delete(key))}
async function boot(){return (await get('meta','bootstrap'))?.value||null}
async function setBoot(value){if(value)await put('meta',{key:'bootstrap',value,updatedAt:Date.now()})}
async function broadcast(data){for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))client.postMessage(data)}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','X-PlanDan-V2':'local'}})}

async function refresh(){
  try{
    const r=await fetch('/api/sync/bootstrap',{credentials:'include',cache:'no-store'})
    if(!r.ok)return false
    const data=await r.json()
    await setBoot(data)
    await broadcast({type:'PLANDAN_DATA_REFRESHED'})
    return true
  }catch{return false}
}

let processing=false
async function processQueue(){
  if(processing)return
  processing=true
  try{
    const queue=(await all('queue')).sort((a,b)=>Number(a.id)-Number(b.id))
    if(!queue.length){
      await refresh()
      await broadcast({type:'PLANDAN_SYNC_STATUS',status:'synced'})
      return
    }
    await broadcast({type:'PLANDAN_SYNC_STATUS',status:'syncing'})
    for(const entry of queue){
      try{
        const r=await fetch(entry.url,{method:entry.method,credentials:'include',headers:entry.bodyText?{'Content-Type':'application/json'}:undefined,body:entry.bodyText||undefined})
        if(r.status===401){await broadcast({type:'PLANDAN_SYNC_STATUS',status:'auth'});return}
        if(!r.ok&&r.status>=500)throw new Error('server')
        await del('queue',entry.id)
      }catch{
        await broadcast({type:'PLANDAN_SYNC_STATUS',status:'pending'})
        return
      }
    }
    await refresh()
    await broadcast({type:'PLANDAN_SYNC_COMPLETE'})
    await broadcast({type:'PLANDAN_SYNC_STATUS',status:'synced'})
  }finally{processing=false}
}

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>undefined))
  self.skipWaiting()
})
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys()
    await Promise.all(keys.filter(k=>k.startsWith('plandan-v2-shell-')&&k!==CACHE).map(k=>caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch',event=>{
  const req=event.request
  const url=new URL(req.url)
  if(url.origin!==self.location.origin)return

  if(req.method==='GET'&&url.pathname==='/api/sync/bootstrap'){
    event.respondWith((async()=>{
      const local=await boot()
      if(local){event.waitUntil(refresh());return json(local)}
      try{
        const r=await fetch(req.clone())
        if(r.ok)await setBoot(await r.clone().json())
        return r
      }catch{return json({error:'OFFLINE_NO_DATA'},503)}
    })())
    return
  }

  if(url.pathname.startsWith('/api/')&&req.method!=='GET'&&url.pathname!=='/api/auth/logout'){
    event.respondWith((async()=>{
      const bodyText=await req.clone().text().catch(()=>'')
      await add('queue',{method:req.method,url:url.pathname+url.search,bodyText,createdAt:Date.now()})
      await broadcast({type:'PLANDAN_LOCAL_CHANGE'})
      await broadcast({type:'PLANDAN_SYNC_STATUS',status:self.navigator.onLine===false?'pending':'syncing'})
      event.waitUntil(processQueue())
      try{if('sync'in self.registration)await self.registration.sync.register('plandan-v2-sync')}catch{}
      return json({ok:true,queued:true},202)
    })())
    return
  }

  if(req.method==='GET'&&req.mode==='navigate'&&(url.pathname==='/v2'||url.pathname==='/v2/')){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE)
      const cached=await cache.match('/v2')
      try{
        const r=await fetch(req)
        if(r.ok)event.waitUntil(cache.put('/v2',r.clone()))
        return r
      }catch{return cached||Response.error()}
    })())
    return
  }

  if(req.method==='GET'&&(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/icons/')||url.pathname==='/manifest-v2.webmanifest'||url.pathname==='/sw-v2.js')){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE)
      const cached=await cache.match(req)
      if(cached)return cached
      try{
        const r=await fetch(req)
        if(r.ok)event.waitUntil(cache.put(req,r.clone()))
        return r
      }catch{return Response.error()}
    })())
  }
})

self.addEventListener('message',event=>{
  const type=event.data?.type
  if(type==='PLANDAN_SYNC_NOW')event.waitUntil(processQueue())
  if(type==='PLANDAN_REFRESH_DATA')event.waitUntil(refresh())
})
self.addEventListener('sync',event=>{if(event.tag==='plandan-v2-sync')event.waitUntil(processQueue())})

const CACHE = 'plandan-v2-shell-v1'
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
async function broadcast(data){const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients)client.postMessage(data)}
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
      const bodyText=await req.clone().text().catch(()=>'')
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
  if(type==='PLANDAN_CLEAR_PRIVATE')event.waitUntil((async()=>{await caches.delete(CACHE)})())
})
self.addEventListener('sync',event=>{if(event.tag==='plandan-v2-sync')event.waitUntil(processQueue())})

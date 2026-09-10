const CACHE = 'plandan-v2-app-shell-v1'
const DB_NAME = 'plandan-v2-local-first-v1'
const DB_VERSION = 1
const STATIC_SHELL = ['/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest']

let dbPromise
function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

async function get(store, key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const request = tx.objectStore(store).get(key)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

async function put(store, value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value)
    tx.oncomplete = () => resolve(value)
    tx.onerror = () => reject(tx.error)
  })
}

async function add(store, value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const request = tx.objectStore(store).add(value)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function del(store, key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function all(store) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const request = tx.objectStore(store).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

async function getBootstrap() {
  return (await get('meta', 'bootstrap'))?.value || null
}

async function setBootstrap(value) {
  if (value) await put('meta', { key: 'bootstrap', value, updatedAt: Date.now() })
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-PlanDan-V2': 'local' }
  })
}

async function broadcast(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) client.postMessage(data)
}

async function refreshBootstrap() {
  try {
    const response = await fetch('/api/sync/bootstrap', { credentials: 'include', cache: 'no-store' })
    if (!response.ok) return false
    const data = await response.json()
    await setBootstrap(data)
    await broadcast({ type: 'PLANDAN_DATA_REFRESHED' })
    return true
  } catch {
    return false
  }
}

let processing = false
async function processQueue() {
  if (processing) return
  processing = true
  try {
    const queue = (await all('queue')).sort((a, b) => Number(a.id) - Number(b.id))
    if (!queue.length) {
      await refreshBootstrap()
      await broadcast({ type: 'PLANDAN_SYNC_STATUS', status: 'synced' })
      return
    }

    await broadcast({ type: 'PLANDAN_SYNC_STATUS', status: 'syncing' })
    for (const entry of queue) {
      try {
        const response = await fetch(entry.url, {
          method: entry.method,
          credentials: 'include',
          headers: entry.bodyText ? { 'Content-Type': 'application/json' } : undefined,
          body: entry.bodyText || undefined
        })
        if (response.status === 401) {
          await broadcast({ type: 'PLANDAN_SYNC_STATUS', status: 'auth' })
          return
        }
        if (!response.ok && response.status >= 500) throw new Error('SERVER')
        await del('queue', entry.id)
      } catch {
        await broadcast({ type: 'PLANDAN_SYNC_STATUS', status: 'pending' })
        return
      }
    }

    await refreshBootstrap()
    await broadcast({ type: 'PLANDAN_SYNC_COMPLETE' })
    await broadcast({ type: 'PLANDAN_SYNC_STATUS', status: 'synced' })
  } finally {
    processing = false
  }
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC_SHELL)).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('plandan-v2-app-shell-') && key !== CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.method === 'GET' && url.pathname === '/api/sync/bootstrap') {
    event.respondWith((async () => {
      const local = await getBootstrap()
      if (local) {
        event.waitUntil(refreshBootstrap())
        return json(local)
      }
      try {
        const response = await fetch(request.clone())
        if (response.ok) {
          const data = await response.clone().json()
          await setBootstrap(data)
        }
        return response
      } catch {
        return json({ error: 'OFFLINE_NO_DATA' }, 503)
      }
    })())
    return
  }

  if (url.pathname.startsWith('/api/') && request.method !== 'GET' && url.pathname !== '/api/auth/logout') {
    event.respondWith((async () => {
      const bodyText = await request.clone().text().catch(() => '')
      await add('queue', {
        method: request.method,
        url: url.pathname + url.search,
        bodyText,
        createdAt: Date.now()
      })
      await broadcast({ type: 'PLANDAN_LOCAL_CHANGE' })
      await broadcast({ type: 'PLANDAN_SYNC_STATUS', status: self.navigator.onLine === false ? 'pending' : 'syncing' })
      event.waitUntil(processQueue())
      try {
        if ('sync' in self.registration) await self.registration.sync.register('plandan-v2-sync')
      } catch {}
      return json({ ok: true, queued: true }, 202)
    })())
    return
  }

  if (request.method === 'GET' && request.mode === 'navigate' && url.pathname.startsWith('/app')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) event.waitUntil(cache.put('/app-shell', response.clone()))
        return response
      } catch {
        return (await cache.match('/app-shell')) || Response.error()
      }
    })())
    return
  }

  if (request.method === 'GET' && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) event.waitUntil(cache.put(request, response.clone()))
        return response
      } catch {
        return Response.error()
      }
    })())
  }
})

self.addEventListener('message', event => {
  const type = event.data?.type
  if (type === 'PLANDAN_SYNC_NOW') event.waitUntil(processQueue())
  if (type === 'PLANDAN_REFRESH_DATA') event.waitUntil(refreshBootstrap())
  if (type === 'PLANDAN_WARM_APP') event.waitUntil(refreshBootstrap())
  if (type === 'PLANDAN_CLEAR_PRIVATE') {
    event.waitUntil((async () => {
      await caches.delete(CACHE)
      const db = await openDb()
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['meta', 'queue'], 'readwrite')
        tx.objectStore('meta').clear()
        tx.objectStore('queue').clear()
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
    })())
  }
})

self.addEventListener('sync', event => {
  if (event.tag === 'plandan-v2-sync') event.waitUntil(processQueue())
})

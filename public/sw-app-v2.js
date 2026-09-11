const CACHE = 'plandan-direct-shell-v1'
const DB_NAME = 'plandan-v2-local-first-v1'
const DB_VERSION = 1
const APP_SHELL = '/app/'
const STATIC_SHELL = [APP_SHELL, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

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
async function clearPrivate() {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['meta', 'queue'], 'readwrite')
    tx.objectStore('meta').clear()
    tx.objectStore('queue').clear()
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}
async function getBootstrap() { return (await get('meta', 'bootstrap'))?.value || null }
async function setBootstrap(value) { if (value) await put('meta', { key: 'bootstrap', value, updatedAt: Date.now() }) }
function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-PlanDan-Local': '1' } })
}
async function broadcast(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) client.postMessage(data)
}

async function warmShell() {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(APP_SHELL, { cache: 'no-store' })
    if (!response.ok) return false
    const cachedResponse = response.clone()
    const html = await response.text()
    await cache.put(APP_SHELL, cachedResponse)
    const assetUrls = [...html.matchAll(/(?:src|href)=["'](\/app\/assets\/[^"']+)["']/g)].map(match => match[1])
    const urls = [...new Set([...STATIC_SHELL.slice(1), ...assetUrls])]
    await Promise.all(urls.map(async url => {
      try {
        const r = await fetch(url, { cache: 'no-store' })
        if (r.ok) await cache.put(url, r)
      } catch {}
    }))
    return true
  } catch {
    return false
  }
}

async function refreshBootstrap() {
  try {
    const response = await fetch('/api/sync/bootstrap', { credentials: 'include', cache: 'no-store' })
    if (response.status === 401) {
      await clearPrivate()
      await broadcast({ type: 'PLANDAN_SYNC_STATUS', status: 'auth' })
      return false
    }
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
          await clearPrivate()
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
  event.waitUntil(warmShell())
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => (key.startsWith('plandan-direct-shell-') || key.startsWith('plandan-v2-app-shell-')) && key !== CACHE).map(key => caches.delete(key)))
    await warmShell()
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request.clone())
        if (response.ok) await clearPrivate()
        return response
      } catch {
        await clearPrivate()
        return json({ ok: true, offlineLogout: true }, 200)
      }
    })())
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/sync/bootstrap') {
    event.respondWith((async () => {
      const local = await getBootstrap()
      if (local) {
        event.waitUntil(refreshBootstrap())
        return json(local)
      }
      try {
        const response = await fetch(request.clone())
        if (response.ok) await setBootstrap(await response.clone().json())
        return response
      } catch {
        return json({ error: 'OFFLINE_NO_DATA' }, 503)
      }
    })())
    return
  }

  if (url.pathname.startsWith('/api/') && request.method !== 'GET') {
    event.respondWith((async () => {
      const bodyText = await request.clone().text().catch(() => '')
      await add('queue', { method: request.method, url: url.pathname + url.search, bodyText, createdAt: Date.now() })
      await broadcast({ type: 'PLANDAN_LOCAL_CHANGE' })
      await broadcast({ type: 'PLANDAN_SYNC_STATUS', status: self.navigator.onLine === false ? 'pending' : 'syncing' })
      event.waitUntil(processQueue())
      try { if ('sync' in self.registration) await self.registration.sync.register('plandan-direct-sync') } catch {}
      return json({ ok: true, queued: true }, 202)
    })())
    return
  }

  if (request.method === 'GET' && request.mode === 'navigate' && url.pathname.startsWith('/app')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(APP_SHELL)
      if (cached) {
        event.waitUntil(warmShell())
        return cached
      }
      try {
        const response = await fetch(APP_SHELL, { cache: 'no-store' })
        if (response.ok) event.waitUntil(cache.put(APP_SHELL, response.clone()))
        return response
      } catch {
        return Response.error()
      }
    })())
    return
  }

  if (request.method === 'GET' && (url.pathname.startsWith('/app/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/languages/') || url.pathname === '/manifest.webmanifest')) {
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
  if (type === 'PLANDAN_WARM_APP') event.waitUntil(Promise.all([warmShell(), refreshBootstrap()]))
  if (type === 'PLANDAN_CLEAR_PRIVATE') event.waitUntil(clearPrivate())
})

self.addEventListener('sync', event => {
  if (event.tag === 'plandan-direct-sync') event.waitUntil(processQueue())
})

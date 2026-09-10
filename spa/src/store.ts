import type { Bootstrap } from './types'

const DB_NAME = 'plandan-local-first-v1'
const DB_VERSION = 1
const BOOTSTRAP_KEY = 'bootstrap'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      if (!db.objectStoreNames.contains('idMap')) db.createObjectStore('idMap', { keyPath: 'localId' })
      if (!db.objectStoreNames.contains('apiCache')) db.createObjectStore('apiCache', { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function readBootstrap(): Promise<Bootstrap | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly')
      const request = tx.objectStore('meta').get(BOOTSTRAP_KEY)
      request.onsuccess = () => resolve((request.result?.value as Bootstrap | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

export async function writeBootstrap(value: Bootstrap): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite')
      tx.objectStore('meta').put({ key: BOOTSTRAP_KEY, value, updatedAt: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Server remains the source of truth if IndexedDB is unavailable.
  }
}

export async function fetchInitialBootstrap(): Promise<Bootstrap> {
  const local = await readBootstrap()
  if (local) return local
  const response = await fetch('/api/sync/bootstrap', { credentials: 'include', cache: 'no-store' })
  if (response.status === 401) {
    window.location.assign('/login')
    throw new Error('UNAUTHORIZED')
  }
  if (!response.ok) throw new Error(`BOOTSTRAP_${response.status}`)
  const data = await response.json() as Bootstrap
  await writeBootstrap(data)
  return data
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register('/v2/sw-v2.js', { scope: '/v2/' })
    await registration.update().catch(() => undefined)
    await navigator.serviceWorker.ready
    return registration
  } catch {
    return null
  }
}

export function postToWorker(type: string, extra: Record<string, unknown> = {}) {
  const worker = navigator.serviceWorker?.controller
  worker?.postMessage({ type, ...extra })
}

export async function mutate(path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

export function subscribeWorker(onRefresh: () => void, onStatus: (status: string) => void) {
  if (!('serviceWorker' in navigator)) return () => undefined
  const handler = (event: MessageEvent) => {
    const type = event.data?.type
    if (type === 'PLANDAN_SYNC_COMPLETE' || type === 'PLANDAN_DATA_REFRESHED' || type === 'PLANDAN_LOCAL_CHANGE') onRefresh()
    if (type === 'PLANDAN_SYNC_STATUS') onStatus(String(event.data?.status || 'synced'))
  }
  navigator.serviceWorker.addEventListener('message', handler)
  return () => navigator.serviceWorker.removeEventListener('message', handler)
}

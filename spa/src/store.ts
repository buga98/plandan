import type { Bootstrap } from './types'

const DB_NAME = 'plandan-v2-local-first-v1'
const DB_VERSION = 1
const BOOTSTRAP_KEY = 'bootstrap'
let appRegistration: ServiceWorkerRegistration | null = null

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
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

export async function clearLocalData(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['meta', 'queue'], 'readwrite')
      tx.objectStore('meta').clear()
      tx.objectStore('queue').clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Nothing else to clear.
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
    appRegistration = await navigator.serviceWorker.register('/sw-app-v2.js', { scope: '/app/' })
    await appRegistration.update().catch(() => undefined)
    return appRegistration
  } catch {
    return null
  }
}

export function postToWorker(type: string, extra: Record<string, unknown> = {}) {
  const controller = navigator.serviceWorker?.controller
  const worker = controller?.scriptURL.endsWith('/sw-app-v2.js')
    ? controller
    : appRegistration?.active || appRegistration?.waiting || appRegistration?.installing
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

export function subscribeWorker(onRefresh: () => void, onStatus: (status: string) => void): () => undefined {
  if (!('serviceWorker' in navigator)) return () => undefined
  const handler = (event: MessageEvent) => {
    const type = event.data?.type
    if (type === 'PLANDAN_SYNC_COMPLETE' || type === 'PLANDAN_DATA_REFRESHED' || type === 'PLANDAN_LOCAL_CHANGE') onRefresh()
    if (type === 'PLANDAN_SYNC_STATUS') onStatus(String(event.data?.status || 'synced'))
  }
  navigator.serviceWorker.addEventListener('message', handler)
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler)
    return undefined
  }
}

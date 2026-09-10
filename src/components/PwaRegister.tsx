'use client'

import { useEffect } from 'react'

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let active = true
    let registration: ServiceWorkerRegistration | null = null
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const worker = () => navigator.serviceWorker.controller || registration?.active || registration?.waiting || registration?.installing || null
    const send = (type: string, extra: Record<string, unknown> = {}) => worker()?.postMessage({ type, ...extra })
    const isApp = () => location.pathname === '/app' || location.pathname.startsWith('/app/')
    const notifyRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => window.dispatchEvent(new Event('plandan:refresh')), 40)
    }

    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      registration = reg
      void reg.update().catch(() => undefined)
      if (!active) return
      registration = await navigator.serviceWorker.ready
      if (isApp()) send('PLANDAN_WARM_APP', { force: true })
      if (navigator.onLine) send('PLANDAN_SYNC_NOW')
    }).catch(() => undefined)

    const online = () => {
      send('PLANDAN_SYNC_NOW')
      if (isApp()) send('PLANDAN_WARM_APP')
    }
    const visible = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      send('PLANDAN_REFRESH_DATA')
      if (isApp()) send('PLANDAN_WARM_APP')
      void registration?.update().catch(() => undefined)
    }
    const controllerChange = () => {
      if (isApp()) send('PLANDAN_WARM_APP', { force: true })
      if (navigator.onLine) send('PLANDAN_SYNC_NOW')
    }
    const message = (event: MessageEvent) => {
      const type = event.data?.type
      if (type === 'PLANDAN_SYNC_COMPLETE' || type === 'PLANDAN_DATA_REFRESHED' || type === 'PLANDAN_LOCAL_CHANGE') notifyRefresh()
    }
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', visible)
    navigator.serviceWorker.addEventListener('controllerchange', controllerChange)
    navigator.serviceWorker.addEventListener('message', message)
    return () => {
      active = false
      if (refreshTimer) clearTimeout(refreshTimer)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', visible)
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChange)
      navigator.serviceWorker.removeEventListener('message', message)
    }
  }, [])
  return null
}

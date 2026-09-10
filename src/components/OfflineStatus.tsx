'use client'

import { CheckCircle2, CloudOff, RefreshCw, Wifi } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'

type SyncState = 'online' | 'offline' | 'pending' | 'syncing' | 'auth-required'

export default function OfflineStatus() {
  const { t } = useI18n()
  const [state, setState] = useState<SyncState>(() => typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online')
  const [pending, setPending] = useState(0)
  const pendingRef = useRef(0)

  useEffect(() => {
    const controller = () => navigator.serviceWorker?.controller
    const onOnline = () => {
      setState('syncing')
      controller()?.postMessage({ type: 'PLANDAN_SYNC_NOW' })
    }
    const onOffline = () => setState(pendingRef.current > 0 ? 'pending' : 'offline')
    const onMessage = (event: MessageEvent) => {
      const data = event.data || {}
      if (data.type !== 'PLANDAN_SYNC_STATUS') return
      const count = Number(data.pending || 0)
      pendingRef.current = count
      setPending(count)
      if (!navigator.onLine) setState(count > 0 ? 'pending' : 'offline')
      else if (data.status === 'syncing') setState('syncing')
      else if (data.status === 'auth-required') setState('auth-required')
      else if (count > 0) setState('pending')
      else setState('online')
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    controller()?.postMessage({ type: 'PLANDAN_GET_STATUS' })
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [])

  const label = state === 'syncing' ? t('syncing')
    : state === 'pending' ? t('waitingSync').replace('{count}', String(pending))
    : state === 'offline' ? t('offlineReady')
    : state === 'auth-required' ? t('syncLoginNeeded')
    : t('synced')

  const Icon = state === 'syncing' ? RefreshCw : state === 'offline' || state === 'pending' ? CloudOff : state === 'online' ? CheckCircle2 : Wifi

  return <div className={`syncPill sync-${state}`} title={label}>
    <Icon size={14} className={state === 'syncing' ? 'spin' : ''}/>
    <span>{label}</span>
  </div>
}

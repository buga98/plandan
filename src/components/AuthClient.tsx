'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import LanguageSwitch from './LanguageSwitch'

async function resetPlannerLocalState() {
  if (!('indexedDB' in window)) return
  for (const name of ['plandan-v2-local-first-v1', 'plandan-local-first-v1']) {
    await new Promise<void>(resolve => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  }
}

export default function AuthClient({ mode }: { mode: 'login' | 'register' }) {
  const { t, lang, setLang } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, email, password, language: lang } : { email, password })
      })
      if (!response.ok) throw new Error()
      await resetPlannerLocalState()
      window.location.assign('/app/')
    } catch {
      setError(t(mode === 'register' ? 'registerError' : 'loginError'))
    } finally {
      setLoading(false)
    }
  }

  return <div className="authWrap">
    <section className="authVisual">
      <Link href="/" className="brand" style={{ color: 'white', position: 'relative', zIndex: 1 }}>
        <img className="logoMark" src="/icons/icon-192.png" />
        <span>PlanDan<small style={{ color: 'rgba(255,255,255,.7)' }}>{t('appTagline')}</small></span>
      </Link>
      <div className="authQuote">{mode === 'register' ? t('registerTitle') : t('homeHeadline')}</div>
      <div style={{ position: 'relative', zIndex: 1, opacity: .78 }}>{t('authModules')}</div>
    </section>
    <section className="authFormSide">
      <form className="authCard" onSubmit={submit}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <img className="logoMark" src="/icons/icon-192.png" />
          <LanguageSwitch value={lang} onChange={setLang} />
        </div>
        <h1>{mode === 'login' ? t('welcomeBack') : t('createAccount')}</h1>
        <p className="sub">{mode === 'login' ? t('appTagline') : t('registerTitle')}</p>
        <div className="formStack">
          {mode === 'register' && <label className="label">{t('name')}<input className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required minLength={2} /></label>}
          <label className="label">{t('email')}<input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label className="label">{t('password')}<input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : 1} /></label>
          {error && <div className="errorBox">{error}</div>}
          <button className="btn btnPrimary" disabled={loading}>{loading ? t('saving') : mode === 'login' ? t('signIn') : t('createAccount')}</button>
        </div>
        <div className="authFooter">{mode === 'login' ? t('noAccount') : t('alreadyAccount')} <Link href={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? t('register') : t('signIn')}</Link></div>
      </form>
    </section>
  </div>
}

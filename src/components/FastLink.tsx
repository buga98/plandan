'use client'

import Link from 'next/link'
import { MouseEvent, ReactNode } from 'react'

type Props = {
  href: string
  className?: string
  children: ReactNode
  title?: string
}

const primaryPaths = new Set(['/app', '/app/habits', '/app/more'])

export default function FastLink({ href, className, children, title }: Props) {
  function click(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (typeof window === 'undefined') return

    const target = new URL(href, window.location.href)
    if (target.origin !== window.location.origin) return

    if (primaryPaths.has(target.pathname) && !target.search && !target.hash) {
      event.preventDefault()
      const next = target.pathname
      if (window.location.pathname !== next || window.location.search || window.location.hash) {
        window.history.pushState({ plandan: true }, '', next)
      }
      window.dispatchEvent(new CustomEvent('plandan:navigate', { detail: { href: next } }))
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine && target.pathname.startsWith('/app')) {
      event.preventDefault()
      window.location.assign(target.pathname + target.search + target.hash)
    }
  }

  return <Link href={href} prefetch onClick={click} className={className} title={title}>{children}</Link>
}

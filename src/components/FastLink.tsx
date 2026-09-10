'use client'

import Link from 'next/link'
import { MouseEvent, ReactNode } from 'react'

type Props = {
  href: string
  className?: string
  children: ReactNode
  title?: string
}

export default function FastLink({ href, className, children, title }: Props) {
  function click(event: MouseEvent<HTMLAnchorElement>) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      event.preventDefault()
      window.location.assign(href)
    }
  }
  return <Link href={href} prefetch onClick={click} className={className} title={title}>{children}</Link>
}

import type { Metadata, Viewport } from 'next'
import '../../../spa/src/styles.css'

export const metadata: Metadata = {
  title: 'PlanDan v2',
  description: 'PlanDan local-first planner',
  manifest: '/manifest-v2.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0f14'
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return children
}

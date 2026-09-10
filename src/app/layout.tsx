import type { Metadata, Viewport } from 'next'
import './globals.css'
import { I18nProvider } from '@/lib/i18n'
import PwaRegister from '@/components/PwaRegister'

export const metadata: Metadata = {
  title: { default: 'PlanDan — Life Planner', template: '%s · PlanDan' },
  description: 'Kalendar, zadaci, podsjetnici, navike, fokus i dnevni check-in u jednom osobnom planeru.',
  applicationName: 'PlanDan',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'PlanDan' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0f1b' }
  ]
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hr" suppressHydrationWarning>
      <body>
        <I18nProvider>
          <PwaRegister />
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}

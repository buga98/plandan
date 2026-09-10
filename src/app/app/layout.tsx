import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import AppShell from '@/components/AppShell'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return (
    <AppShell user={{
      id: user.id,
      name: user.name,
      email: user.email,
      settings: user.settings ? {
        language: user.settings.language,
        theme: user.settings.theme,
        timezone: user.settings.timezone,
        focusMinutes: user.settings.focusMinutes,
        breakMinutes: user.settings.breakMinutes
      } : null
    }}>
      {children}
    </AppShell>
  )
}

import { getCurrentUser } from '@/lib/auth'
import LandingClient from '@/components/LandingClient'
export default async function Home(){const user=await getCurrentUser();return <LandingClient loggedIn={Boolean(user)}/>}

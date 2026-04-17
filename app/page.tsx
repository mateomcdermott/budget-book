import { redirect } from 'next/navigation'

// Root redirect: send visitors straight to login
export default function Home() {
  redirect('/login')
}

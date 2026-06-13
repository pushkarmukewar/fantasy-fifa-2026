import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Navbar({ user }) {
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="border-b border-white/10 bg-black/30 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-black tracking-tight">
          ⚽ <span className="text-fifa-gold">Fantasy FIFA 2026</span>
        </Link>

        <div className="flex items-center gap-6 text-sm">
          <Link href="/dashboard"
            className={`hover:text-fifa-gold transition ${router.pathname === '/dashboard' ? 'text-fifa-gold' : 'text-gray-300'}`}>
            Dashboard
          </Link>
          <Link href="/team"
            className={`hover:text-fifa-gold transition ${router.pathname === '/team' ? 'text-fifa-gold' : 'text-gray-300'}`}>
            My Team
          </Link>
          <Link href="/matches"
            className={`hover:text-fifa-gold transition ${router.pathname === '/matches' ? 'text-fifa-gold' : 'text-gray-300'}`}>
            Matches
          </Link>
          <Link href="/leaderboard"
            className={`hover:text-fifa-gold transition ${router.pathname === '/leaderboard' ? 'text-fifa-gold' : 'text-gray-300'}`}>
            Leaderboard
          </Link>
          <button onClick={handleSignOut}
            className="text-gray-500 hover:text-white transition text-xs">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}

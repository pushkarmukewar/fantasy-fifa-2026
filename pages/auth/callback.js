import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

/**
 * Supabase redirects here after clicking the magic link.
 * The URL contains the session tokens as hash params.
 * Supabase JS picks them up automatically via onAuthStateChange.
 */
export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/dashboard')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-spin">⚽</div>
        <p className="text-gray-400">Signing you in…</p>
      </div>
    </div>
  )
}

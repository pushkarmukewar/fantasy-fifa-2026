import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

/**
 * Supabase redirects here after clicking the magic link.
 *
 * Two possible flows:
 *  - PKCE (default in supabase-js v2.39+): URL has ?code=xxx query param
 *    → we must call exchangeCodeForSession(code) manually
 *  - Implicit (legacy): URL has #access_token=xxx hash
 *    → supabase-js picks it up automatically via onAuthStateChange
 */
export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState(null)

  useEffect(() => {
    // router.query is empty on first render in Next.js pages router.
    // Wait until it's hydrated.
    if (!router.isReady) return

    const { code, error: errorCode, error_description } = router.query

    // Supabase passes error details in the URL if something went wrong
    if (errorCode) {
      setError(error_description || errorCode)
      return
    }

    if (code) {
      // PKCE flow: exchange the one-time code for a session
      supabase.auth.exchangeCodeForSession(String(code))
        .then(({ data, error: exchangeErr }) => {
          if (exchangeErr) {
            setError(exchangeErr.message)
          } else if (data?.session) {
            router.replace('/dashboard')
          }
        })
      return
    }

    // Implicit flow fallback: already signed in or hash-based token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/dashboard')
      }
    })
    return () => subscription.unsubscribe()
  }, [router.isReady, router.query])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-400 font-semibold mb-2">Sign-in link failed</p>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <p className="text-gray-500 text-sm mb-4">
            Magic links expire after 1 hour and can only be used once.
            Please request a new one.
          </p>
          <a
            href="/"
            className="inline-block bg-yellow-400 text-gray-950 font-bold px-6 py-2.5 rounded-full text-sm hover:bg-yellow-300 transition">
            Request a new link →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-spin">⚽</div>
        <p className="text-gray-400">Signing you in…</p>
      </div>
    </div>
  )
}

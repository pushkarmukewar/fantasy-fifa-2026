import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function LandingPage() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const signInRef             = useRef(null)
  const router                = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })
  }, [])

  function scrollToSignIn() {
    signInRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-lg tracking-tight">
            <span className="text-2xl">⚽</span>
            <span>Fantasy <span className="text-yellow-400">FIFA 2026</span></span>
          </div>
          <button
            onClick={scrollToSignIn}
            className="bg-yellow-400 text-gray-950 font-bold px-5 py-2 rounded-full text-sm hover:bg-yellow-300 transition">
            Play Free →
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-16">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                          w-[600px] h-[600px] bg-yellow-400/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-green-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30
                          text-yellow-400 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            FIFA World Cup 2026 • Now Live
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none mb-6">
            Build Your<br />
            <span className="text-yellow-400">Dream Squad.</span><br />
            Rule the World.
          </h1>

          <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Pick 5 players from all 48 nations. Stay within budget.
            Watch your points climb as your players light up the World Cup.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={scrollToSignIn}
              className="bg-yellow-400 text-gray-950 font-black px-8 py-4 rounded-full text-lg
                         hover:bg-yellow-300 transition transform hover:scale-105 shadow-lg shadow-yellow-400/20">
              Start for Free →
            </button>
            <a href="#how-it-works"
               className="border border-white/20 text-white font-bold px-8 py-4 rounded-full text-lg
                          hover:bg-white/10 transition">
              How it works
            </a>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-8 mt-16 text-center">
            {[
              { num: '48', label: 'Nations' },
              { num: '646', label: 'Real Players' },
              { num: '$50M', label: 'Budget' },
              { num: '🏆', label: 'Global Leaderboard' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-3xl font-black text-yellow-400">{s.num}</p>
                <p className="text-gray-500 text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">How it works</h2>
            <p className="text-gray-400 text-lg">Up and running in 60 seconds.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: '✉️',
                title: 'Sign in with email',
                desc: 'No password needed. Enter your email, click the magic link, and you\'re in.',
                color: 'from-blue-500/20 to-blue-500/5',
                border: 'border-blue-500/30',
              },
              {
                step: '02',
                icon: '⚽',
                title: 'Pick your 5 players',
                desc: 'Browse all 646 real FIFA 2026 players. Stay within your $50M budget.',
                color: 'from-yellow-400/20 to-yellow-400/5',
                border: 'border-yellow-400/30',
              },
              {
                step: '03',
                icon: '🏆',
                title: 'Earn points & climb',
                desc: 'Goals, assists, clean sheets — your players score, you score. Watch the leaderboard live.',
                color: 'from-green-500/20 to-green-500/5',
                border: 'border-green-500/30',
              },
            ].map(card => (
              <div key={card.step}
                className={`relative bg-gradient-to-b ${card.color} border ${card.border}
                            rounded-2xl p-8 overflow-hidden`}>
                <span className="absolute top-4 right-5 text-5xl font-black text-white/5">
                  {card.step}
                </span>
                <div className="text-4xl mb-4">{card.icon}</div>
                <h3 className="text-xl font-bold mb-2">{card.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POINTS SYSTEM ── */}
      <section className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">Points System</h2>
            <p className="text-gray-400 text-lg">Every touch counts.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '⚽', label: 'Goal (FWD/MID)', pts: '+6', color: 'text-yellow-400' },
              { icon: '⚽', label: 'Goal (DEF/GK)', pts: '+10', color: 'text-yellow-400' },
              { icon: '🎯', label: 'Assist', pts: '+4', color: 'text-green-400' },
              { icon: '🧤', label: 'Clean Sheet', pts: '+4', color: 'text-blue-400' },
              { icon: '🏃', label: 'Played 60+ min', pts: '+2', color: 'text-gray-300' },
              { icon: '🟨', label: 'Yellow Card', pts: '−1', color: 'text-yellow-600' },
              { icon: '🟥', label: 'Red Card', pts: '−3', color: 'text-red-400' },
              { icon: '😬', label: 'Own Goal', pts: '−2', color: 'text-red-400' },
            ].map(p => (
              <div key={p.label}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <span className="text-2xl">{p.icon}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-400">{p.label}</p>
                </div>
                <span className={`text-xl font-black ${p.color}`}>{p.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLAYER PREVIEW ── */}
      <section className="py-24 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">Real Players. Real Stakes.</h2>
            <p className="text-gray-400 text-lg">All 646 official FIFA 2026 World Cup players, priced by rating.</p>
          </div>

          {/* Sample player cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { name: 'Kylian Mbappé',    pos: 'FWD', country: 'France',      price: '$15M', rating: 95, color: 'border-yellow-400/60 bg-yellow-400/10' },
              { name: 'Erling Haaland',   pos: 'FWD', country: 'Norway',      price: '$15M', rating: 94, color: 'border-yellow-400/60 bg-yellow-400/10' },
              { name: 'Jude Bellingham',  pos: 'MID', country: 'England',     price: '$15M', rating: 91, color: 'border-yellow-400/40 bg-yellow-400/5' },
              { name: 'Mohamed Salah',    pos: 'FWD', country: 'Egypt',       price: '$12M', rating: 90, color: 'border-green-400/40 bg-green-400/5' },
              { name: 'Kim Min-jae',      pos: 'DEF', country: 'South Korea', price: '$12M', rating: 87, color: 'border-blue-400/40 bg-blue-400/5' },
              { name: 'Robert Lewandowski', pos: 'FWD', country: 'Poland',   price: '$10M', rating: 88, color: 'border-green-400/30 bg-green-400/5' },
              { name: 'Son Heung-min',    pos: 'FWD', country: 'South Korea', price: '$12M', rating: 87, color: 'border-green-400/30 bg-green-400/5' },
              { name: 'Patrik Schick',    pos: 'FWD', country: 'Czech Rep.',  price: '$7M',  rating: 83, color: 'border-white/20 bg-white/5' },
              { name: 'Raúl Jiménez',     pos: 'FWD', country: 'Mexico',      price: '$7M',  rating: 83, color: 'border-white/20 bg-white/5' },
              { name: 'Tomáš Souček',     pos: 'MID', country: 'Czech Rep.',  price: '$7M',  rating: 83, color: 'border-white/20 bg-white/5' },
            ].map(p => (
              <div key={p.name}
                className={`border ${p.color} rounded-xl p-3 transition hover:scale-105 cursor-default`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 bg-white/10 px-1.5 py-0.5 rounded">
                    {p.pos}
                  </span>
                  <span className="text-xs font-black text-yellow-400">{p.price}</span>
                </div>
                <p className="font-bold text-sm leading-tight">{p.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">{p.country}</p>
                <div className="flex items-center gap-1 mt-2">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full"
                         style={{ width: `${((p.rating - 70) / 30) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-400">{p.rating}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-600 text-sm mt-6">+ 636 more players from 48 nations</p>
        </div>
      </section>

      {/* ── SIGN IN ── */}
      <section ref={signInRef} className="py-24 px-6">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-black mb-3">
              Ready to <span className="text-yellow-400">play?</span>
            </h2>
            <p className="text-gray-400">Enter your email to get started — no password needed.</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            {sent ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">📬</div>
                <h3 className="text-xl font-bold mb-2">Check your inbox!</h3>
                <p className="text-gray-400 text-sm">
                  Magic link sent to <span className="text-white font-medium">{email}</span>.
                  Click it to sign in and build your squad.
                </p>
                <p className="text-gray-600 text-xs mt-4">
                  Local dev? Check{' '}
                  <a href="http://localhost:54324" target="_blank" rel="noreferrer"
                     className="text-yellow-400 underline">localhost:54324</a>
                </p>
                <button onClick={() => setSent(false)}
                  className="mt-6 text-sm text-gray-500 hover:text-white transition underline">
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3
                               text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400
                               transition"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full bg-yellow-400 text-gray-950 font-black py-3.5 rounded-xl
                             hover:bg-yellow-300 transition disabled:opacity-50 text-lg">
                  {loading ? 'Sending…' : 'Send my magic link →'}
                </button>
                <p className="text-center text-gray-600 text-xs">
                  Free to play • No credit card • No password
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-gray-600 text-sm">
          ⚽ Fantasy FIFA 2026 — Built for the beautiful game
        </p>
      </footer>
    </div>
  )
}

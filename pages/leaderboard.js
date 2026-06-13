import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function LeaderboardPage() {
  const router = useRouter()
  const [user, setUser]       = useState(null)
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      setUser(session.user)

      const { data } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(100)

      setRows(data || [])
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Loading leaderboard…</p>
    </div>
  )

  return (
    <div className="min-h-screen">
      <Navbar user={user} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black mb-2">
          🏆 Leaderboard
        </h1>
        <p className="text-gray-400 mb-8">Rankings update after each match.</p>

        {rows.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            No teams yet — be the first to join!
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => {
              const isMe = row.user_id === user?.id
              return (
                <div key={row.user_id}
                  className={`flex items-center gap-4 rounded-xl px-4 py-3 transition ${
                    isMe
                      ? 'bg-fifa-gold/10 border border-fifa-gold/40'
                      : 'bg-white/5 border border-white/10'
                  }`}>
                  {/* Rank */}
                  <div className="w-10 text-center">
                    {MEDALS[row.rank] ? (
                      <span className="text-2xl">{MEDALS[row.rank]}</span>
                    ) : (
                      <span className="text-gray-500 font-bold text-sm">#{row.rank}</span>
                    )}
                  </div>

                  {/* Team info */}
                  <div className="flex-1">
                    <p className="font-bold text-sm">
                      {row.team_name}
                      {isMe && <span className="ml-2 text-xs text-fifa-gold">(you)</span>}
                    </p>
                    <p className="text-gray-500 text-xs">{row.email}</p>
                  </div>

                  {/* Points */}
                  <div className="text-right">
                    <p className={`text-xl font-black ${isMe ? 'text-fifa-gold' : ''}`}>
                      {row.total_points}
                    </p>
                    <p className="text-gray-500 text-xs">pts</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

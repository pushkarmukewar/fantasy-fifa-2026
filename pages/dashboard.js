import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import { getOpenWindow, getNextWindow, countdownToEndOf, daysUntil } from '../lib/transferWindows'

const POSITION_COLORS = {
  GK:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  DEF: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  MID: 'bg-green-500/20 text-green-300 border-green-500/30',
  FWD: 'bg-red-500/20 text-red-300 border-red-500/30',
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [team, setTeam]         = useState(null)
  const [players, setPlayers]   = useState([])  // now includes joinedAt per player
  const [totalPts, setTotalPts] = useState(0)
  const [rank, setRank]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [openWindow, setOpenWindow] = useState(null)
  const [nextWindow, setNextWindow] = useState(null)
  const [countdown, setCountdown]   = useState('')

  // Live transfer window countdown
  useEffect(() => {
    function tick() {
      const open = getOpenWindow()
      const next = getNextWindow()
      setOpenWindow(open)
      setNextWindow(next)
      if (open) {
        setCountdown(countdownToEndOf(open.end))
      } else if (next) {
        const d = daysUntil(next.start)
        if (d === 0) setCountdown('Opens today!')
        else if (d === 1) setCountdown('Opens tomorrow')
        else {
          const target = new Date(next.start + 'T00:00:00')
          const diff = target - new Date()
          if (diff > 0) {
            const days = Math.floor(diff / 86400000)
            const h = Math.floor((diff % 86400000) / 3600000).toString().padStart(2,'0')
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2,'0')
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2,'0')
            setCountdown(days > 0 ? `${days}d ${h}:${m}:${s}` : `${h}:${m}:${s}`)
          }
        }
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      setUser(session.user)

      // FIX: also select joined_at so we can filter per-player points correctly
      const { data: teamData } = await supabase
        .from('fantasy_teams')
        .select('id, name, locked, fantasy_team_players(joined_at, players(*))')
        .eq('user_id', session.user.id)
        .single()

      if (teamData) {
        setTeam(teamData)
        // FIX: attach joined_at to each player object
        const teamPlayers = teamData.fantasy_team_players.map(r => ({
          ...r.players,
          joinedAt: r.joined_at,
        }))
        setPlayers(teamPlayers)

        const { data: lb } = await supabase
          .from('leaderboard')
          .select('total_points, rank')
          .eq('user_id', session.user.id)
          .single()
        if (lb) {
          setTotalPts(lb.total_points)
          setRank(lb.rank)
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Loading…</p>
    </div>
  )

  return (
    <div className="min-h-screen">
      <Navbar user={user} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-black">
            Welcome, <span className="text-fifa-gold">{user?.email?.split('@')[0]}</span>
          </h1>
          <p className="text-gray-400 mt-1">FIFA World Cup 2026 Fantasy</p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-gray-400 text-sm">Total Points</p>
            <p className="text-4xl font-black text-fifa-gold mt-1">{totalPts}</p>
          </div>
          <div className="card text-center">
            <p className="text-gray-400 text-sm">Global Rank</p>
            <p className="text-4xl font-black mt-1">
              {rank ? `#${rank}` : '—'}
            </p>
          </div>
          <div className="card text-center">
            <p className="text-gray-400 text-sm">Players Picked</p>
            <p className="text-4xl font-black mt-1">{players.length} / 5</p>
          </div>
        </div>

        {/* Transfer window countdown */}
        {openWindow ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 mb-8 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-green-400 font-black text-sm uppercase tracking-wide mb-0.5">🟢 Transfer Window Open</p>
              <p className="text-gray-300 text-sm">{openWindow.label} — make your changes now</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs mb-0.5">Closes in</p>
              <p className="text-green-400 font-black text-3xl tabular-nums">{countdown}</p>
            </div>
          </div>
        ) : nextWindow ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-yellow-400 font-black text-sm uppercase tracking-wide mb-0.5">🔒 Next Transfer Window</p>
              <p className="text-gray-300 text-sm">{nextWindow.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{nextWindow.start} → {nextWindow.end}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs mb-0.5">Opens in</p>
              <p className="text-yellow-400 font-black text-3xl tabular-nums">{countdown}</p>
            </div>
          </div>
        ) : null}

        {/* My team */}
        {players.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-3xl mb-3">🏟️</p>
            <p className="text-gray-300 font-medium mb-2">You haven't built your team yet</p>
            <p className="text-gray-500 text-sm mb-6">Pick 5 players within a $50M budget</p>
            <Link href="/team" className="btn-primary">Build my team →</Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{team?.name}</h2>
              {!team?.locked && (
                <Link href="/team" className="btn-secondary text-sm">Edit team</Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* FIX: pass joinedAt so the card only counts points after the player joined */}
              {players.map(player => (
                <PlayerPointsCard key={player.id} player={player} joinedAt={player.joinedAt} />
              ))}
            </div>
          </>
        )}

        {/* Quick links */}
        <div className="flex gap-3 mt-8">
          <Link href="/leaderboard" className="btn-secondary flex-1 text-center">
            View Leaderboard
          </Link>
        </div>
      </div>
    </div>
  )
}

function PlayerPointsCard({ player, joinedAt }) {
  const [pts, setPts] = useState(null)

  useEffect(() => {
    async function fetchPoints() {
      // Get all points rows for this player
      const { data: pointsData } = await supabase
        .from('player_points')
        .select('points, api_fixture_id')
        .eq('player_id', player.id)

      if (!pointsData?.length) { setPts(0); return }

      // FIX: also fetch match dates so we can exclude pre-transfer matches
      const { data: statsData } = await supabase
        .from('player_match_stats')
        .select('api_fixture_id, match_date')
        .eq('player_id', player.id)

      const statsMap = Object.fromEntries(
        (statsData || []).map(s => [String(s.api_fixture_id), s.match_date])
      )

      const joinedDate = joinedAt ? joinedAt.split('T')[0] : null

      const total = pointsData.reduce((sum, r) => {
        const matchDate = statsMap[String(r.api_fixture_id)]
        // Include if: no match date (old data), no join date, or match happened on/after joined date
        if (!matchDate || !joinedDate || matchDate >= joinedDate) {
          return sum + r.points
        }
        return sum
      }, 0)

      setPts(total)
    }
    fetchPoints()
  }, [player.id, joinedAt])

  return (
    <div className={`border rounded-xl p-4 ${POSITION_COLORS[player.position]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-sm">{player.name}</p>
          <p className="text-xs opacity-70 mt-0.5">{player.country} · {player.position}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black">{pts ?? '…'}</p>
          <p className="text-xs opacity-70">pts</p>
        </div>
      </div>
    </div>
  )
}

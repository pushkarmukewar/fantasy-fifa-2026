import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const POSITION_COLORS = {
  GK:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  DEF: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  MID: 'bg-green-500/20 text-green-300 border-green-500/30',
  FWD: 'bg-red-500/20 text-red-300 border-red-500/30',
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser]           = useState(null)
  const [team, setTeam]           = useState(null)
  const [players, setPlayers]     = useState([])
  const [pointsMap, setPointsMap] = useState({})   // player_id → total points
  const [totalPts, setTotalPts]   = useState(0)
  const [rank, setRank]           = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      setUser(session.user)

      const { data: teamData, error: teamErr } = await supabase
        .from('fantasy_teams')
        .select('id, name, locked, fantasy_team_players(players(*))')
        .eq('user_id', session.user.id)
        .single()

      if (teamErr) console.error('team fetch error:', teamErr)

      if (teamData) {
        setTeam(teamData)
        const teamPlayers = teamData.fantasy_team_players.map(r => r.players).filter(Boolean)
        setPlayers(teamPlayers)

        // Fetch ALL points for this team's players in ONE query
        const playerIds = teamPlayers.map(p => p.id)
        if (playerIds.length > 0) {
          const { data: pointsRows, error: ptsErr } = await supabase
            .from('player_points')
            .select('player_id, points')
            .in('player_id', playerIds)

          if (ptsErr) {
            console.error('player_points fetch error:', ptsErr)
          } else {
            console.log('player_points rows fetched:', pointsRows?.length, pointsRows)
          }

          // Sum per player
          const map = {}
          for (const row of (pointsRows || [])) {
            map[row.player_id] = (map[row.player_id] || 0) + (row.points || 0)
          }
          setPointsMap(map)
        }

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
              <span className="text-yellow-400 text-sm">🔒 Locked</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {players.map(player => (
                <PlayerPointsCard key={player.id} player={player} pts={pointsMap[player.id] ?? null} />
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

function PlayerPointsCard({ player, pts }) {
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

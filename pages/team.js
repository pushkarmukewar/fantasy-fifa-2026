import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import PlayerCard from '../components/PlayerCard'

const BUDGET = 50
const MAX_PLAYERS = 5
const POSITIONS = ['All', 'GK', 'DEF', 'MID', 'FWD']
const PRICE_RANGES = [
  { label: 'All prices', min: 0,  max: Infinity },
  { label: '≤ $3M',     min: 0,  max: 3000000  },
  { label: '$3M–$6M',   min: 3000001, max: 6000000  },
  { label: '$6M–$10M',  min: 6000001, max: 10000000 },
  { label: '$10M+',     min: 10000001, max: Infinity },
]

export default function TeamPage() {
  const router = useRouter()
  const [user, setUser]               = useState(null)
  const [players, setPlayers]         = useState([])
  const [selected, setSelected]       = useState([])
  const [captainId, setCaptainId]     = useState(null)
  const [teamId, setTeamId]           = useState(null)
  const [search, setSearch]           = useState('')
  const [posFilter, setPosFilter]     = useState('All')
  const [priceFilter, setPriceFilter] = useState(0)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [locked, setLocked]           = useState(false)
  const [loading, setLoading]         = useState(true)
  const [hasTeam, setHasTeam]         = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      setUser(session.user)

      const { data: playerData, error: playerErr } = await supabase
        .from('players')
        .select('*')
        .order('rating', { ascending: false })
      if (playerErr) console.error('players fetch error:', playerErr)
      setPlayers(playerData || [])

      const { data: teamData } = await supabase
        .from('fantasy_teams')
        .select('id, locked, fantasy_team_players(player_id, is_captain)')
        .eq('user_id', session.user.id)
        .single()

      if (teamData) {
        setLocked(true)   // team always locked once saved
        setHasTeam(true)
        setTeamId(teamData.id)
        const rows = teamData.fantasy_team_players
        const ids  = rows.map(r => r.player_id)
        const picked = (playerData || []).filter(p => ids.includes(p.id))
        setSelected(picked)
        const cap = rows.find(r => r.is_captain)
        if (cap) setCaptainId(cap.player_id)
      }

      setLoading(false)
    }
    init()
  }, [])

  const spent     = selected.reduce((sum, p) => sum + p.price / 1000000, 0)
  const remaining = BUDGET - spent
  const budgetOk  = remaining >= 0
  const canSave   = selected.length === MAX_PLAYERS && budgetOk && !hasTeam && !!captainId

  function togglePlayer(player) {
    if (locked || hasTeam) return
    const isIn = selected.find(p => p.id === player.id)
    if (isIn) {
      setSelected(selected.filter(p => p.id !== player.id))
      if (captainId === player.id) setCaptainId(null)
    } else {
      if (selected.length >= MAX_PLAYERS) return
      setSelected([...selected, player])
    }
  }

  function toggleCaptain(playerId) {
    if (locked || hasTeam) return
    setCaptainId(prev => prev === playerId ? null : playerId)
  }

  async function saveTeam() {
    setSaving(true)
    try {
      const { data: team, error: teamErr } = await supabase
        .from('fantasy_teams')
        .upsert(
          { user_id: user.id, name: `${user.email.split('@')[0]}'s Team` },
          { onConflict: 'user_id' }
        )
        .select('id')
        .single()

      if (teamErr) throw teamErr

      await supabase.from('fantasy_team_players').delete().eq('fantasy_team_id', team.id)
      await supabase.from('fantasy_team_players').insert(
        selected.map(p => ({
          fantasy_team_id: team.id,
          player_id: p.id,
          is_captain: p.id === captainId,
          joined_at: new Date().toISOString(),
        }))
      )

      setTeamId(team.id)
      setHasTeam(true)
      setLocked(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Error saving team: ' + err.message)
    }
    setSaving(false)
  }

  const { min: priceMin, max: priceMax } = PRICE_RANGES[priceFilter]
  const filteredPlayers = players.filter(p => {
    const matchPos    = posFilter === 'All' || p.position === posFilter
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.country.toLowerCase().includes(search.toLowerCase()) ||
                        p.club.toLowerCase().includes(search.toLowerCase())
    const matchPrice  = p.price >= priceMin && p.price <= priceMax
    return matchPos && matchSearch && matchPrice
  })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Loading squad…</p>
    </div>
  )

  return (
    <div className="min-h-screen">
      <Navbar user={user} />

      {/* Banner */}
      {hasTeam ? (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            <span className="text-yellow-400 text-lg">🔒</span>
            <span className="text-yellow-400 font-bold text-sm">Team locked</span>
            <span className="text-gray-400 text-sm">— your squad is set for the tournament. No changes allowed.</span>
          </div>
        </div>
      ) : (
        <div className="bg-blue-500/15 border-b border-blue-500/30 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            <span className="text-blue-400 text-lg">🔵</span>
            <span className="text-blue-400 font-bold text-sm">Build your team</span>
            <span className="text-gray-400 text-sm">— once saved, your squad is locked for the entire tournament.</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* === Left: Player catalog === */}
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-4">Player Catalog</h2>

            <div className="flex flex-col gap-3 mb-5">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, country, club…"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2
                           text-white placeholder-gray-500 focus:outline-none focus:border-fifa-gold"
              />
              <div className="flex gap-2 flex-wrap">
                {POSITIONS.map(pos => (
                  <button key={pos} onClick={() => setPosFilter(pos)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      posFilter === pos ? 'bg-fifa-gold text-fifa-blue' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}>
                    {pos}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {PRICE_RANGES.map((range, i) => (
                  <button key={range.label} onClick={() => setPriceFilter(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      priceFilter === i ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}>
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredPlayers.map(player => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  selected={!!selected.find(p => p.id === player.id)}
                  onToggle={togglePlayer}
                  disabled={hasTeam || (selected.length >= MAX_PLAYERS && !selected.find(p => p.id === player.id))}
                />
              ))}
            </div>
          </div>

          {/* === Right: My squad === */}
          <div className="lg:w-72 space-y-4">
            <div className="card sticky top-20">
              <h2 className="text-lg font-bold mb-1">My Squad</h2>

              {/* Captain rule — only shown before team is saved */}
              {!hasTeam && (
                <div className="flex items-start gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2 mb-4">
                  <span className="text-yellow-400 text-base leading-none mt-0.5">⭐</span>
                  <p className="text-xs text-yellow-300 leading-snug">
                    <span className="font-bold">Pick a captain</span> — required before saving.
                    Your captain earns <span className="font-bold">2× points</span> every match.
                    Tap <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-yellow-400 text-gray-900 font-black text-xs">C</span> next to any player to assign them.
                  </p>
                </div>
              )}

              {/* Budget bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Budget</span>
                  <span className={budgetOk ? 'text-green-400' : 'text-red-400'}>
                    ${remaining.toFixed(1)}M remaining
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${budgetOk ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, (spent / BUDGET) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">${spent.toFixed(1)}M / ${BUDGET}M spent</p>
              </div>

              {/* Player slots */}
              <div className="space-y-2 mb-4">
                {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
                  const p = selected[i]
                  const isCap = p && p.id === captainId
                  return (
                    <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      p ? (isCap ? 'bg-yellow-400/15 border border-yellow-400/40' : 'bg-white/10')
                        : 'bg-white/5 border border-dashed border-white/20'
                    }`}>
                      {p ? (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              onClick={() => toggleCaptain(p.id)}
                              disabled={hasTeam}
                              title={isCap ? 'Remove captain' : 'Make captain'}
                              className={`shrink-0 w-5 h-5 rounded text-xs font-black flex items-center justify-center transition ${
                                isCap
                                  ? 'bg-yellow-400 text-gray-900'
                                  : 'bg-white/20 text-gray-500 hover:bg-yellow-400/40 hover:text-yellow-300'
                              } ${hasTeam ? 'cursor-default opacity-50' : 'cursor-pointer'}`}>
                              C
                            </button>
                            <div className="min-w-0">
                              <span className="font-medium truncate block">{p.name}</span>
                              <span className="text-gray-500 text-xs">{p.position}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-fifa-gold text-xs">${(p.price / 1000000).toFixed(0)}M</span>
                            {!hasTeam && (
                              <button onClick={() => togglePlayer(p)}
                                className="text-gray-500 hover:text-red-400 text-xs transition">
                                ✕
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-600">Player {i + 1}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Captain status */}
              {captainId && selected.find(p => p.id === captainId) ? (
                <p className="text-xs text-center text-green-400 mb-3">
                  ✅ Captain: <span className="font-bold">{selected.find(p => p.id === captainId).name}</span> (2× points)
                </p>
              ) : !hasTeam && selected.length > 0 && (
                <p className="text-xs text-center text-yellow-400 mb-3 animate-pulse">
                  ⚠️ No captain selected — required to save
                </p>
              )}

              {hasTeam ? (
                <div className="text-center text-sm text-yellow-400 bg-yellow-400/10 rounded-lg p-3">
                  🔒 Squad locked for the tournament
                </div>
              ) : (
                <button
                  onClick={saveTeam}
                  disabled={!canSave || saving}
                  className="btn-primary w-full">
                  {saving ? 'Saving…' : saved ? '✓ Saved!' : !captainId && selected.length === MAX_PLAYERS ? '⭐ Pick a captain first' : 'Save Team'}
                </button>
              )}

              {!hasTeam && selected.length < MAX_PLAYERS && (
                <p className="text-xs text-center text-gray-500 mt-2">
                  Pick {MAX_PLAYERS - selected.length} more player{MAX_PLAYERS - selected.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

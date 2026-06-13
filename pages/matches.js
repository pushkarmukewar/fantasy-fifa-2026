import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const FLAG = {
  'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷', 'Czech Republic': '🇨🇿',
  'Canada': '🇨🇦', 'Bosnia and Herzegovina': '🇧🇦', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭',
  'United States': '🇺🇸', 'Paraguay': '🇵🇾', 'Australia': '🇦🇺', 'Turkey': '🇹🇷',
  'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Haiti': '🇭🇹', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Germany': '🇩🇪', 'Curaçao': '🇨🇼', 'Netherlands': '🇳🇱', 'Japan': '🇯🇵',
  'Ivory Coast': '🇨🇮', 'Ecuador': '🇪🇨', 'Sweden': '🇸🇪', 'Tunisia': '🇹🇳',
  'Spain': '🇪🇸', 'Cape Verde': '🇨🇻', 'Belgium': '🇧🇪', 'Egypt': '🇪🇬',
  'Saudi Arabia': '🇸🇦', 'Uruguay': '🇺🇾', 'Iran': '🇮🇷', 'New Zealand': '🇳🇿',
  'France': '🇫🇷', 'Senegal': '🇸🇳', 'Argentina': '🇦🇷', 'Algeria': '🇩🇿',
  'Iraq': '🇮🇶', 'Norway': '🇳🇴', 'Austria': '🇦🇹', 'Jordan': '🇯🇴',
  'Portugal': '🇵🇹', 'DR Congo': '🇨🇩', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷',
  'Uzbekistan': '🇺🇿', 'Colombia': '🇨🇴', 'Ghana': '🇬🇭', 'Panama': '🇵🇦',
}

function getFlag(team) {
  return FLAG[team] || '🏳️'
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10)
}

function daysFromNow(dateStr) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.round((d - now) / 86400000)
}

const GROUP_COLORS = {
  'Group A': 'border-red-500/40 bg-red-500/5',
  'Group B': 'border-orange-500/40 bg-orange-500/5',
  'Group C': 'border-yellow-500/40 bg-yellow-500/5',
  'Group D': 'border-green-500/40 bg-green-500/5',
  'Group E': 'border-teal-500/40 bg-teal-500/5',
  'Group F': 'border-cyan-500/40 bg-cyan-500/5',
  'Group G': 'border-blue-500/40 bg-blue-500/5',
  'Group H': 'border-indigo-500/40 bg-indigo-500/5',
  'Group I': 'border-violet-500/40 bg-violet-500/5',
  'Group J': 'border-purple-500/40 bg-purple-500/5',
  'Group K': 'border-pink-500/40 bg-pink-500/5',
  'Group L': 'border-rose-500/40 bg-rose-500/5',
}

export default function MatchesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [matches, setMatches] = useState([])
  const [filter, setFilter] = useState('week') // 'week' | 'all'
  const [groupFilter, setGroupFilter] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/'); return }
      setUser(session.user)

      const { data } = await supabase
        .from('matches')
        .select('*')
        .order('match_date', { ascending: true })
        .order('stage', { ascending: true })

      setMatches(data || [])
      setLoading(false)
    }
    init()
  }, [])

  const groups = ['All', ...Array.from(new Set(matches.map(m => m.stage))).sort()]

  const filtered = matches.filter(m => {
    const days = daysFromNow(m.match_date)
    const inWeek = filter === 'week' ? (days >= 0 && days <= 7) : true
    const inGroup = groupFilter === 'All' || m.stage === groupFilter
    return inWeek && inGroup
  })

  // Group by date
  const byDate = filtered.reduce((acc, m) => {
    const d = m.match_date
    if (!acc[d]) acc[d] = []
    acc[d].push(m)
    return acc
  }, {})

  const today = new Date().toISOString().slice(0, 10)
  const nextMatch = matches.find(m => daysFromNow(m.match_date) >= 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Loading schedule…</p>
    </div>
  )

  return (
    <div className="min-h-screen">
      <Navbar user={user} />

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-1">
            ⚽ Match Schedule
          </h1>
          <p className="text-gray-400">FIFA World Cup 2026 · Jun 11 – Jul 19</p>
        </div>

        {/* Next match countdown */}
        {nextMatch && daysFromNow(nextMatch.match_date) <= 1 && (
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-5 mb-6 flex items-center gap-4">
            <div className="text-3xl">🔔</div>
            <div>
              <p className="text-yellow-400 font-bold text-sm mb-0.5">
                {daysFromNow(nextMatch.match_date) === 0 ? 'TODAY' : 'TOMORROW'}
              </p>
              <p className="font-bold text-lg">
                {getFlag(nextMatch.team_a)} {nextMatch.team_a}
                <span className="text-gray-500 mx-2">vs</span>
                {getFlag(nextMatch.team_b)} {nextMatch.team_b}
              </p>
              <p className="text-gray-400 text-sm">{nextMatch.venue} · {nextMatch.kickoff_time || ''}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-2">
            {[['week', 'Next 7 days'], ['all', 'Full schedule']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === val
                    ? 'bg-yellow-400 text-gray-950'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white
                       focus:outline-none focus:border-yellow-400">
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* Match list */}
        {Object.keys(byDate).length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📅</p>
            <p>No matches in this window.</p>
            <button onClick={() => setFilter('all')}
              className="mt-4 text-yellow-400 underline text-sm">
              View full schedule
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayMatches]) => {
              const days = daysFromNow(date)
              return (
                <div key={date}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="font-bold text-lg">{formatDate(date)}</h2>
                    {date === today && (
                      <span className="bg-yellow-400 text-gray-950 text-xs font-black px-2 py-0.5 rounded-full">
                        TODAY
                      </span>
                    )}
                    {days === 1 && (
                      <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">
                        TOMORROW
                      </span>
                    )}
                    {days > 1 && days <= 7 && (
                      <span className="text-gray-500 text-xs">in {days} days</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {dayMatches.map(m => (
                      <div key={m.id}
                        className={`border rounded-xl p-4 flex items-center gap-4 ${
                          GROUP_COLORS[m.stage] || 'border-white/10 bg-white/5'
                        } ${m.played ? 'opacity-60' : ''}`}>

                        {/* Stage badge */}
                        <span className="hidden sm:block text-xs font-bold text-gray-500 w-16 shrink-0 text-center">
                          {m.stage}
                        </span>

                        {/* Teams */}
                        <div className="flex-1 flex items-center justify-center gap-3 sm:gap-6">
                          <div className="flex items-center gap-2 justify-end flex-1">
                            <span className="font-bold text-sm sm:text-base text-right">{m.team_a}</span>
                            <span className="text-2xl">{getFlag(m.team_a)}</span>
                          </div>
                          <div className="text-center shrink-0">
                            {m.played ? (
                              <span className="text-xs font-bold text-gray-400 bg-white/10 px-2 py-1 rounded">
                                FT
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-yellow-400">
                                {m.kickoff_time || 'TBC'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-2xl">{getFlag(m.team_b)}</span>
                            <span className="font-bold text-sm sm:text-base">{m.team_b}</span>
                          </div>
                        </div>

                        {/* Venue */}
                        <p className="hidden lg:block text-xs text-gray-500 w-40 shrink-0 text-right truncate">
                          📍 {m.venue}
                        </p>
                      </div>
                    ))}
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

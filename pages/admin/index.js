import { useState } from 'react'
import Head from 'next/head'

export default function AdminPage() {
  const [secret, setSecret]           = useState('')
  const [authed, setAuthed]           = useState(false)
  const [syncing, setSyncing]         = useState(false)
  const [result, setResult]           = useState(null)
  const [fixtureId, setFixtureId]     = useState('')
  const [auditing, setAuditing]       = useState(false)
  const [auditResult, setAuditResult] = useState(null)
  const [users, setUsers]             = useState(null)
  const [usersLoading, setUsersLoading] = useState(false)
  const [removingId, setRemovingId]   = useState(null)
  const [generatingLink, setGeneratingLink] = useState(null)
  const [copiedEmail, setCopiedEmail] = useState(null)
  const [matchSyncing, setMatchSyncing] = useState(false)
  const [matchResult, setMatchResult]   = useState(null)

  function login(e) {
    e.preventDefault()
    if (secret === 'supersecret123') setAuthed(true)
    else alert('Wrong secret')
  }

  async function runSync(e) {
    e.preventDefault()
    setSyncing(true)
    setResult(null)
    try {
      const params = new URLSearchParams({ secret: 'supersecret123' })
      if (fixtureId.trim()) params.set('fixtureId', fixtureId.trim())
      const res  = await fetch(`/api/admin/sync-scores?${params}`, { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ error: err.message })
    }
    setSyncing(false)
  }

  async function runAudit() {
    setAuditing(true)
    setAuditResult(null)
    try {
      const res  = await fetch('/api/admin/audit-players?secret=supersecret123')
      const data = await res.json()
      setAuditResult(data)
    } catch (err) {
      setAuditResult({ error: err.message })
    }
    setAuditing(false)
  }

  async function syncMatches() {
    setMatchSyncing(true)
    setMatchResult(null)
    try {
      const res  = await fetch('/api/admin/sync-matches?secret=supersecret123', { method: 'POST' })
      const data = await res.json()
      setMatchResult(data)
    } catch (err) {
      setMatchResult({ error: err.message })
    }
    setMatchSyncing(false)
  }

  async function loadUsers() {
    setUsersLoading(true)
    try {
      const res  = await fetch('/api/admin/users?secret=supersecret123')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      setUsers([])
    }
    setUsersLoading(false)
  }

  async function generateLink(email) {
    setGeneratingLink(email)
    try {
      const res  = await fetch('/api/admin/generate-link?secret=supersecret123', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      await navigator.clipboard.writeText(data.link)
      setCopiedEmail(email)
      setTimeout(() => setCopiedEmail(null), 3000)
    } catch (err) {
      alert('Error generating link: ' + err.message)
    }
    setGeneratingLink(null)
  }

  async function removeUser(userId, email) {
    if (!confirm(`Remove ${email} and their team? This cannot be undone.`)) return
    setRemovingId(userId)
    try {
      const res  = await fetch(`/api/admin/users?secret=supersecret123&userId=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUsers(users.filter(u => u.id !== userId))
    } catch (err) {
      alert('Error removing user: ' + err.message)
    }
    setRemovingId(null)
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <form onSubmit={login} className="card w-80 space-y-4">
          <h1 className="text-xl font-black text-center">🔐 Admin</h1>
          <input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder="Admin secret"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white
                       placeholder-gray-500 focus:outline-none focus:border-fifa-gold"
          />
          <button className="btn-primary w-full">Enter</button>
        </form>
      </div>
    )
  }

  return (
    <>
      <Head><title>Admin — Fantasy FIFA 2026</title></Head>
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-3xl mx-auto space-y-8">

          <div>
            <h1 className="text-3xl font-black mb-1">⚙️ Admin Panel</h1>
            <p className="text-gray-400">Fantasy FIFA 2026</p>
          </div>

          {/* Sync match schedule */}
          <div className="card space-y-4">
            <h2 className="text-lg font-bold">📅 Sync Match Schedule</h2>
            <p className="text-gray-400 text-sm">
              Pulls all FIFA World Cup 2026 fixtures from api-football.com into the match schedule.
              Run once on setup, and again if you need to refresh scores or add new fixtures.
            </p>
            <button
              onClick={syncMatches}
              disabled={matchSyncing}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {matchSyncing ? <><span className="animate-spin">📅</span> Syncing…</> : '📅 Sync Match Schedule'}
            </button>
            {matchResult && (
              <div className={`rounded-xl p-4 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-40 ${
                matchResult.error ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                                  : 'bg-green-500/10 border border-green-500/30 text-green-300'
              }`}>
                {matchResult.error ? `Error: ${matchResult.error}` : `✅ Synced ${matchResult.synced} fixtures`}
              </div>
            )}
          </div>

          {/* Sync scores */}
          <div className="card space-y-4">
            <h2 className="text-lg font-bold">🔄 Sync Match Scores</h2>
            <p className="text-gray-400 text-sm">
              Fetches finished World Cup matches from api-football.com and
              auto-calculates fantasy points for all players. Run after any match ends.
            </p>
            <form onSubmit={runSync} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Fixture ID (optional — leave blank to sync all finished matches)
                </label>
                <input
                  type="text"
                  value={fixtureId}
                  onChange={e => setFixtureId(e.target.value)}
                  placeholder="e.g. 1234567"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2
                             text-white placeholder-gray-500 focus:outline-none focus:border-fifa-gold"
                />
              </div>
              <button
                type="submit"
                disabled={syncing}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {syncing ? <><span className="animate-spin">⚙️</span> Syncing…</> : '▶ Run Score Sync'}
              </button>
            </form>
            {result && (
              <div className={`rounded-xl p-4 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96 ${
                result.error ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                             : 'bg-green-500/10 border border-green-500/30 text-green-300'
              }`}>
                {result.error ? `Error: ${result.error}` : JSON.stringify(result, null, 2)}
              </div>
            )}
          </div>

          {/* Player name audit */}
          <div className="card space-y-4">
            <h2 className="text-lg font-bold">🔍 Player Name Audit</h2>
            <p className="text-gray-400 text-sm">
              Fetches every World Cup team's squad (~48 teams) and checks each player
              against your database using the same fuzzy matching as sync. Shows any names
              that won't match so you can fix them before they play.
            </p>
            <p className="text-yellow-400 text-xs">
              ⏱ Takes ~30–60s — makes one API call per team.
            </p>
            <button
              onClick={runAudit}
              disabled={auditing}
              className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                         text-white font-bold transition flex items-center justify-center gap-2">
              {auditing ? <><span className="animate-spin">🔍</span> Auditing all teams…</> : '🔍 Run Player Audit'}
            </button>

            {auditResult && !auditResult.error && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ['Teams',     auditResult.summary?.teams],
                    ['API Players', auditResult.summary?.totalApiPlayers],
                    ['Matched',   auditResult.summary?.totalMatched],
                    ['Unmatched', auditResult.summary?.totalUnmatched],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
                      <div className={`text-xl font-black ${
                        label === 'Unmatched' && val > 0 ? 'text-red-400' :
                        label === 'Matched'              ? 'text-green-400' : 'text-white'
                      }`}>{val ?? '—'}</div>
                      <div className="text-xs text-gray-500 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="text-center text-sm font-bold text-fifa-gold">
                  Match rate: {auditResult.summary?.matchRate}
                </div>

                {/* Teams with unmatched players */}
                {auditResult.report?.filter(t => t.unmatched > 0).length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-red-400">
                      ⚠️ Teams with unmatched players
                    </h3>
                    {auditResult.report
                      .filter(t => t.unmatched > 0)
                      .map(t => (
                        <div key={t.team} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm">{t.team}</span>
                            <span className="text-xs text-red-400">{t.unmatched} unmatched / {t.apiCount} total</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {t.unmatchedNames.map(name => (
                              <span key={name} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-mono">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center text-green-400 font-bold py-4">
                    ✅ All players matched! No fixes needed.
                  </div>
                )}
              </div>
            )}

            {auditResult?.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
                Error: {auditResult.error}
              </div>
            )}
          </div>

          {/* User Management */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">👥 User Management</h2>
                <p className="text-gray-400 text-sm mt-0.5">All users who have been sent a magic link.</p>
              </div>
              <button
                onClick={loadUsers}
                disabled={usersLoading}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm font-bold transition">
                {usersLoading ? '⏳ Loading…' : users ? '↻ Refresh' : 'Load Users'}
              </button>
            </div>

            {users && (
              <div className="space-y-2">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3 mb-2">
                  {[
                    ['Total users',    users.length],
                    ['Confirmed',      users.filter(u => u.status === 'confirmed').length],
                    ['Have a team',    users.filter(u => u.teamName).length],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
                      <div className="text-xl font-black text-white">{val}</div>
                      <div className="text-xs text-gray-500 mt-1">{label}</div>
                    </div>
                  ))}
                </div>

                {/* User rows */}
                {users.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No users yet.</p>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/5 text-gray-400 text-xs">
                          <th className="text-left px-3 py-2">Email</th>
                          <th className="text-left px-3 py-2">Status</th>
                          <th className="text-left px-3 py-2">Team</th>
                          <th className="text-right px-3 py-2">Pts</th>
                          <th className="text-right px-3 py-2">Rank</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u, i) => (
                          <tr key={u.id} className={`border-t border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-200">{u.email}</td>
                            <td className="px-3 py-2.5">
                              {u.status === 'confirmed' ? (
                                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">✓ confirmed</span>
                              ) : (
                                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">⏳ pending</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-300">
                              {u.teamName || <span className="text-gray-600">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs">
                              {u.totalPoints !== null ? u.totalPoints : <span className="text-gray-600">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-gray-400">
                              {u.rank !== null ? `#${u.rank}` : <span className="text-gray-600">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right flex items-center justify-end gap-3">
                              <button
                                onClick={() => generateLink(u.email)}
                                disabled={generatingLink === u.email}
                                className="text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50 transition">
                                {generatingLink === u.email ? '…' : copiedEmail === u.email ? '✅ Copied!' : '🔗 Get Link'}
                              </button>
                              <button
                                onClick={() => removeUser(u.id, u.email)}
                                disabled={removingId === u.id}
                                className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50 transition">
                                {removingId === u.id ? '…' : 'Remove'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="card space-y-3 text-sm text-gray-400">
            <h2 className="text-base font-bold text-white">📋 How sync works</h2>
            <ul className="space-y-2 list-none">
              <li>✅ Calls api-football.com for all FT World Cup matches</li>
              <li>✅ For each match: fetches per-player stats (goals, assists, cards, minutes)</li>
              <li>✅ Matches API player names to your database using fuzzy name matching</li>
              <li>✅ Inserts into <code className="bg-white/10 px-1 rounded">player_match_stats</code>, calculates <code className="bg-white/10 px-1 rounded">player_points</code></li>
              <li>✅ Captain gets double points automatically</li>
              <li>⚡ Already-synced matches are skipped (no duplicates)</li>
            </ul>
          </div>

          {/* Points breakdown */}
          <div className="card space-y-2 text-sm">
            <h2 className="text-base font-bold">⭐ Points System</h2>
            <table className="w-full text-gray-300">
              <tbody>
                {[
                  ['Playing 60+ mins',               '+2 pts'],
                  ['Playing 1–59 mins',              '+1 pt'],
                  ['Goal (FWD)',                     '+4 pts'],
                  ['Goal (MID)',                     '+5 pts'],
                  ['Goal (DEF/GK)',                  '+6 pts'],
                  ['Assist',                         '+3 pts'],
                  ['Clean sheet (GK/DEF, 60+ mins)', '+4 pts'],
                  ['Clean sheet (MID, 60+ mins)',    '+1 pt'],
                  ['Yellow card',                    '−1 pt'],
                  ['Red card / 2nd yellow',          '−3 pts'],
                  ['Captain',                        '×2 all points'],
                ].map(([action, pts]) => (
                  <tr key={action} className="border-b border-white/5">
                    <td className="py-1.5">{action}</td>
                    <td className="py-1.5 text-right font-mono text-fifa-gold">{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </>
  )
}

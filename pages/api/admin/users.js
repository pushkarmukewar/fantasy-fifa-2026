/**
 * GET  /api/admin/users?secret=...  — list all users with team + points status
 * DELETE /api/admin/users?secret=...&userId=...  — remove a user and their team
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'supersecret123'))
    return res.status(401).json({ error: 'Unauthorized' })

  // Create inside handler so env vars are guaranteed to be available
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ── DELETE: remove a user ──────────────────────────────────────
  if (req.method === 'DELETE') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId required' })

    // Delete fantasy team first (cascade handles team_players)
    await supabaseAdmin.from('fantasy_teams').delete().eq('user_id', userId)

    // Delete auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ deleted: userId })
  }

  // ── GET: list all users ────────────────────────────────────────
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET or DELETE only' })

  // 1. All auth users
  const { data: { users }, error: usersErr } = await supabaseAdmin.auth.admin.listUsers()
  if (usersErr) return res.status(500).json({ error: usersErr.message })

  // 2. All fantasy teams (to know who has one)
  const { data: teams, error: teamsErr } = await supabaseAdmin
    .from('fantasy_teams')
    .select('id, user_id, name')

  // Also grab team_id → user_id map from teams
  const teamByUser = Object.fromEntries((teams || []).map(t => [t.user_id, t]))
  const teamById   = Object.fromEntries((teams || []).map(t => [t.id, t]))

  // 3. All team-player rows so we know which player_ids belong to which team
  const { data: teamPlayers, error: teamPlayersErr } = await supabaseAdmin
    .from('fantasy_team_players')
    .select('fantasy_team_id, player_id')

  // 4. All player_points rows
  const { data: allPoints } = await supabaseAdmin
    .from('player_points')
    .select('player_id, points')

  // Build player_id → total points map
  const ptsByPlayerId = {}
  for (const row of (allPoints || [])) {
    ptsByPlayerId[row.player_id] = (ptsByPlayerId[row.player_id] || 0) + (row.points || 0)
  }

  // Sum points per team_id
  const ptsByTeamId = {}
  for (const row of (teamPlayers || [])) {
    const playerPts = ptsByPlayerId[row.player_id] || 0
    ptsByTeamId[row.fantasy_team_id] = (ptsByTeamId[row.fantasy_team_id] || 0) + playerPts
  }

  // Map team points to user_id
  const ptsByUser = {}
  for (const [teamId, pts] of Object.entries(ptsByTeamId)) {
    const team = teamById[teamId]
    if (team) ptsByUser[team.user_id] = pts
  }

  // Compute ranks
  const sortedPts = Object.entries(ptsByUser).sort((a, b) => b[1] - a[1])
  const rankByUser = {}
  sortedPts.forEach(([uid, pts], i) => {
    const rank = i === 0 ? 1 : (pts === sortedPts[i - 1][1] ? rankByUser[sortedPts[i - 1][0]] : i + 1)
    rankByUser[uid] = rank
  })

  const result = users.map(u => {
    const team = teamByUser[u.id] || null
    const pts  = ptsByUser[u.id]  || null
    return {
      id:          u.id,
      email:       u.email,
      status:      u.email_confirmed_at ? 'confirmed' : 'pending',
      createdAt:   u.created_at,
      lastSignIn:  u.last_sign_in_at || null,
      teamName:    team?.name ?? null,
      totalPoints: ptsByUser[u.id] ?? null,
      rank:        rankByUser[u.id] ?? null,
    }
  })

  // Sort: confirmed + team first, then confirmed no team, then pending
  result.sort((a, b) => {
    const score = x => (x.status === 'confirmed' ? 2 : 0) + (x.teamName ? 1 : 0)
    return score(b) - score(a)
  })

  return res.status(200).json({
    users: result,
    _debug: {
      serviceKeyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      teamsCount:        (teams || []).length,
      teamsError:        teamsErr?.message || null,
      teamPlayersCount:  (teamPlayers || []).length,
      teamPlayersError:  teamPlayersErr?.message || null,
      pointRowsCount:    (allPoints || []).length,
      sampleTeam:        (teams || [])[0] || null,
      ptsByUser,
      rankByUser,
    }
  })
}

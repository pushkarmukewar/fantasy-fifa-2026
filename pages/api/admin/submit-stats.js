/**
 * POST /api/admin/submit-stats
 *
 * Body: {
 *   secret: string,
 *   match_id: string,
 *   stats: [
 *     {
 *       player_id: string,
 *       minutes_played: number,
 *       goals: number,
 *       assists: number,
 *       clean_sheet: boolean,
 *       yellow_cards: number,
 *       red_cards: number,
 *       own_goals: number,
 *     }
 *   ]
 * }
 */

import { createClient } from '@supabase/supabase-js'
import { calculatePoints } from '../../../lib/points'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { secret, match_id, stats } = req.body

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!match_id || !Array.isArray(stats) || stats.length === 0) {
    return res.status(400).json({ error: 'match_id and stats[] are required' })
  }

  try {
    // Fetch player positions
    const playerIds = stats.map(s => s.player_id)
    const { data: playerData, error: pErr } = await supabase
      .from('players')
      .select('id, position')
      .in('id', playerIds)
    if (pErr) throw pErr
    const posMap = Object.fromEntries(playerData.map(p => [p.id, p.position]))

    // Fetch match date so points can be date-gated correctly
    const { data: matchData } = await supabase
      .from('matches')
      .select('match_date')
      .eq('id', match_id)
      .single()
    const matchDate = matchData?.match_date || null

    // FIX: fetch all captains so we can apply 2x multiplier
    const { data: captainRows } = await supabase
      .from('fantasy_team_players')
      .select('player_id')
      .eq('is_captain', true)
    const captainIds = new Set((captainRows || []).map(r => r.player_id))

    const statsRows  = []
    const pointsRows = []

    for (const s of stats) {
      const position = posMap[s.player_id]
      if (!position) continue

      statsRows.push({
        player_id:      s.player_id,
        match_id,
        match_date:     matchDate,
        minutes_played: s.minutes_played ?? 0,
        goals:          s.goals ?? 0,
        assists:        s.assists ?? 0,
        clean_sheet:    s.clean_sheet ?? false,
        yellow_cards:   s.yellow_cards ?? 0,
        red_cards:      s.red_cards ?? 0,
        own_goals:      s.own_goals ?? 0,
      })

      const isCaptain = captainIds.has(s.player_id)
      const { total, breakdown } = calculatePoints(s, position)

      // FIX: apply 2x multiplier for captain
      const finalPoints = isCaptain ? total * 2 : total

      pointsRows.push({
        player_id:      s.player_id,
        match_id,
        points:         finalPoints,
        breakdown:      { ...breakdown, is_captain: isCaptain },
        is_captain_pts: isCaptain,
      })
    }

    // Upsert stats
    const { error: statsErr } = await supabase
      .from('player_match_stats')
      .upsert(statsRows, { onConflict: 'player_id,match_id' })
    if (statsErr) throw statsErr

    // Upsert points
    const { error: ptsErr } = await supabase
      .from('player_points')
      .upsert(pointsRows, { onConflict: 'player_id,match_id' })
    if (ptsErr) throw ptsErr

    // Mark match as played
    await supabase.from('matches').update({ played: true }).eq('id', match_id)

    return res.status(200).json({
      success: true,
      processed: statsRows.length,
      points: pointsRows.map(r => ({ player_id: r.player_id, points: r.points, is_captain: r.is_captain_pts }))
    })

  } catch (err) {
    console.error('submit-stats error:', err)
    return res.status(500).json({ error: err.message })
  }
}

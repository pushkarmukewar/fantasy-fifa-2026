/**
 * POST /api/admin/submit-stats
 *
 * Body: {
 *   secret: string,         // must match ADMIN_SECRET env var
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
 *
 * Creates/updates player_match_stats rows,
 * then (re)calculates and upserts player_points rows.
 */

import { createClient } from '@supabase/supabase-js'
import { calculatePoints } from '../../../lib/points'

// Use service role key so we can bypass RLS for admin writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { secret, match_id, stats } = req.body

  // Auth check
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!match_id || !Array.isArray(stats) || stats.length === 0) {
    return res.status(400).json({ error: 'match_id and stats[] are required' })
  }

  try {
    // Fetch player positions in one query
    const playerIds = stats.map(s => s.player_id)
    const { data: playerData, error: pErr } = await supabase
      .from('players')
      .select('id, position')
      .in('id', playerIds)

    if (pErr) throw pErr
    const posMap = Object.fromEntries(playerData.map(p => [p.id, p.position]))

    const statsRows  = []
    const pointsRows = []

    for (const s of stats) {
      const position = posMap[s.player_id]
      if (!position) continue

      statsRows.push({
        player_id:      s.player_id,
        match_id,
        minutes_played: s.minutes_played ?? 0,
        goals:          s.goals ?? 0,
        assists:        s.assists ?? 0,
        clean_sheet:    s.clean_sheet ?? false,
        yellow_cards:   s.yellow_cards ?? 0,
        red_cards:      s.red_cards ?? 0,
        own_goals:      s.own_goals ?? 0,
      })

      const { total, breakdown } = calculatePoints(s, position)
      pointsRows.push({
        player_id: s.player_id,
        match_id,
        points:    total,
        breakdown,
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
      points: pointsRows.map(r => ({ player_id: r.player_id, points: r.points }))
    })

  } catch (err) {
    console.error('submit-stats error:', err)
    return res.status(500).json({ error: err.message })
  }
}

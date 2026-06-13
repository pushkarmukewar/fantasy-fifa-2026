/**
 * POST /api/admin/sync-matches?secret=...
 * Fetches the full FIFA World Cup 2026 fixture list from api-football
 * and upserts all matches into the local matches table.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const API_KEY  = process.env.API_FOOTBALL_KEY
const BASE_URL = 'https://v3.football.api-sports.io'
const LEAGUE   = 1
const SEASON   = 2026

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY }
  })
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`)
  return res.json()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'supersecret123'))
    return res.status(401).json({ error: 'Unauthorized' })
  if (!API_KEY)
    return res.status(500).json({ error: 'API_FOOTBALL_KEY not set' })

  try {
    const data = await apiFetch(`/fixtures?league=${LEAGUE}&season=${SEASON}`)
    const fixtures = data.response || []

    if (fixtures.length === 0)
      return res.status(200).json({ message: 'No fixtures returned from API', synced: 0 })

    const rows = fixtures.map(f => ({
      api_fixture_id: f.fixture.id,
      match_date:     f.fixture.date.slice(0, 10),
      kickoff_time:   f.fixture.date.slice(11, 16) + ' UTC',
      stage:          f.league.round,
      team_a:         f.teams.home.name,
      team_b:         f.teams.away.name,
      score_a:        f.goals.home,
      score_b:        f.goals.away,
      venue:          f.fixture.venue?.name || null,
      played:         ['FT', 'AET', 'PEN'].includes(f.fixture.status.short),
    }))

    // Upsert all fixtures — need api_fixture_id column on matches table
    const { error } = await supabase
      .from('matches')
      .upsert(rows, { onConflict: 'api_fixture_id', ignoreDuplicates: false })

    if (error) throw new Error(error.message)

    return res.status(200).json({ synced: rows.length, sample: rows[0] })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

/**
 * GET /api/admin/test-fixture?secret=...&fixtureId=...
 * Returns raw api-football data for a fixture so we can verify
 * what stats are coming in and how scoring will work.
 */

const API_KEY  = process.env.API_FOOTBALL_KEY
const BASE_URL = 'https://v3.football.api-sports.io'

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY }
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export default async function handler(req, res) {
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'supersecret123'))
    return res.status(401).json({ error: 'Unauthorized' })

  try {
    // If no fixtureId given, find the most recently finished WC match
    let fixtureId = req.query.fixtureId ? parseInt(req.query.fixtureId) : null

    if (!fixtureId) {
      const data = await apiFetch(`/fixtures?league=1&season=2026&status=FT&last=1`)
      const fixture = data.response?.[0]
      if (!fixture) return res.status(200).json({ message: 'No finished matches found yet' })
      fixtureId = fixture.fixture.id
    }

    // Fetch fixture info + player stats in parallel
    const [fixtureData, statsData] = await Promise.all([
      apiFetch(`/fixtures?id=${fixtureId}`),
      apiFetch(`/fixtures/players?fixture=${fixtureId}`),
    ])

    const fixture = fixtureData.response?.[0]
    const teams   = statsData.response || []

    // Build a clean summary of what each player scored
    const summary = teams.map(team => ({
      team: team.team.name,
      players: team.players.map(p => {
        const s = p.statistics?.[0]
        return {
          name:         p.player.name,
          minutes:      s?.games?.minutes ?? null,
          goals:        s?.goals?.total   ?? 0,
          assists:      s?.goals?.assists ?? 0,
          yellow_cards: s?.cards?.yellow  ?? 0,
          red_cards:    (s?.cards?.red ?? 0) + (s?.cards?.yellowred ?? 0),
          // What our scoring algorithm would give (rough)
          _estimated_pts: estimatePoints(s, team.team.id === fixture?.teams?.home?.id
            ? (fixture?.goals?.away ?? 0) === 0
            : (fixture?.goals?.home ?? 0) === 0),
        }
      }).filter(p => p.minutes !== 0),
    }))

    return res.status(200).json({
      fixture: {
        id:    fixtureId,
        home:  fixture?.teams?.home?.name,
        away:  fixture?.teams?.away?.name,
        score: `${fixture?.goals?.home ?? '?'} - ${fixture?.goals?.away ?? '?'}`,
        date:  fixture?.fixture?.date,
      },
      teams: summary,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

function estimatePoints(s, cleanSheet) {
  if (!s) return 0
  const mins    = s.games?.minutes ?? 0
  const goals   = s.goals?.total   ?? 0
  const assists = s.goals?.assists ?? 0
  const yellow  = s.cards?.yellow  ?? 0
  const red     = (s.cards?.red ?? 0) + (s.cards?.yellowred ?? 0)
  const pos     = s.games?.position ?? 'F'

  let pts = 0
  if (mins >= 60) pts += 2
  else if (mins > 0) pts += 1

  if (pos === 'G' || pos === 'D') pts += goals * 6
  else if (pos === 'M') pts += goals * 5
  else pts += goals * 4

  pts += assists * 3
  if (cleanSheet && mins >= 60 && (pos === 'G' || pos === 'D')) pts += 4
  pts -= yellow
  pts -= red * 3
  return pts
}

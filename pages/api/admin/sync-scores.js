/**
 * POST /api/admin/sync-scores
 *
 * Fetches recently finished World Cup matches from api-football.com,
 * pulls player stats for each match, and updates fantasy points.
 *
 * Query params:
 *   ?secret=ADMIN_SECRET   — required
 *   ?fixtureId=12345       — optional: sync one specific fixture only
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const API_KEY  = process.env.API_FOOTBALL_KEY
const BASE_URL = 'https://v3.football.api-sports.io'
const LEAGUE   = 1        // FIFA World Cup
const SEASON   = 2026

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY }
  })
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`)
  return res.json()
}

// ──────────────────────────────────────────
// Manual aliases for players whose names have
// different romanizations between api-football
// and our DB. Key = API name (lowercased),
// Value = DB name (lowercased).
// ──────────────────────────────────────────
const NAME_ALIASES = {
  // South Korea
  'gi-hyuk lee':       'lee ki-hyuk',
  'gihyuk lee':        'lee ki-hyuk',
  'park jin-seop':     'park jin-seob',
  // Spain
  'álex grimaldo':     'alejandro grimaldo',
  'alex grimaldo':     'alejandro grimaldo',
  // Australia
  'a. o neill':        'oneill',
  // Ghana
  'a. baba':           'abdul baba rahman',
  // Iran
  'd. eckert ayensa':  'danial eckert',
  'm. ghaedi':         'saman ghoddos',
  // Norway
  'h. falchener':      'håkon evjen',
  // Turkey
  'k. yildiz':         'kenan yıldız',
  'b. yilmaz':         'burak yılmaz',
}

function normalizeName(name) {
  return name
    .toLowerCase()
    // Map special chars that don't decompose via NFD
    .replace(/ø|ö/g, 'o').replace(/å/g, 'a').replace(/æ/g, 'ae')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's')
    .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove remaining accents
    .replace(/-/g, ' ')            // hyphens → spaces
    .replace(/[^a-z\s]/g, '')      // remove remaining non-alpha
    .replace(/\s+/g, ' ')          // collapse multiple spaces
    .trim()
}

function namesMatch(dbName, apiName) {
  const db  = normalizeName(dbName)
  const api = normalizeName(apiName)
  if (db === api) return true

  const dbParts  = db.split(' ').filter(Boolean)
  const apiParts = api.split(' ').filter(Boolean)
  const dbLast   = dbParts[dbParts.length - 1]
  const apiLast  = apiParts[apiParts.length - 1]

  // Last name match (for single last names longer than 3 chars)
  if (dbLast.length > 3 && dbLast === apiLast) return true

  // Reversed name order: "lee kangin" ↔ "kangin lee"
  const dbSorted  = [...dbParts].sort().join(' ')
  const apiSorted = [...apiParts].sort().join(' ')
  if (dbSorted === apiSorted) return true

  // Initial + last name — works whichever side is abbreviated.
  // After normalization dots are gone, so a single-char part is an initial.
  // "b ergashev" ↔ "botirali ergashev" OR "ergashev botirali"
  const isInitial = parts => parts.length >= 2 && parts[0].length === 1
  if (isInitial(apiParts)) {
    const [init, ...rest] = apiParts
    const last = rest[rest.length - 1]
    // DB first name starts with same initial and last names match
    if (dbParts[0]?.[0] === init && dbLast === last) return true
    // DB name in any order: has a word starting with initial AND contains last name
    if (dbParts.some(p => p[0] === init) && dbParts.includes(last)) return true
  }
  if (isInitial(dbParts)) {
    const [init, ...rest] = dbParts
    const last = rest[rest.length - 1]
    if (apiParts[0]?.[0] === init && apiLast === last) return true
    if (apiParts.some(p => p[0] === init) && apiParts.includes(last)) return true
  }

  // Partial: one name fully contained in the other
  if (api.includes(db) || db.includes(api)) return true

  // Any word overlap of 5+ chars (handles hyphenated names)
  const dbWords  = dbParts.filter(w => w.length >= 5)
  const apiWords = apiParts.filter(w => w.length >= 5)
  if (dbWords.length > 0 && dbWords.some(w => apiWords.includes(w))) return true

  // Spaceless compare: "jo hyeonwoo" ↔ "jo hyeon woo"
  // Strip all spaces and compare the full concatenated string
  const dbNoSpace  = dbParts.join('')
  const apiNoSpace = apiParts.join('')
  if (dbNoSpace === apiNoSpace) return true

  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'supersecret123'))
    return res.status(401).json({ error: 'Unauthorized' })
  if (!API_KEY)
    return res.status(500).json({ error: 'API_FOOTBALL_KEY not set in .env.local' })

  try {
    const specificFixture = req.query.fixtureId ? parseInt(req.query.fixtureId) : null
    let fixtureIds = []

    if (specificFixture) {
      fixtureIds = [specificFixture]
    } else {
      // Get all finished World Cup matches
      const data = await apiFetch(
        `/fixtures?league=${LEAGUE}&season=${SEASON}&status=FT`
      )
      fixtureIds = (data.response || []).map(f => f.fixture.id)
    }

    if (fixtureIds.length === 0) {
      return res.status(200).json({ message: 'No finished matches found', synced: 0 })
    }

    // Check which fixtures we've already synced
    const { data: alreadySynced } = await supabase
      .from('player_match_stats')
      .select('api_fixture_id')
      .in('api_fixture_id', fixtureIds)

    const syncedIds = new Set((alreadySynced || []).map(r => r.api_fixture_id))
    const toSync = specificFixture
      ? fixtureIds  // always re-sync if explicitly requested
      : fixtureIds.filter(id => !syncedIds.has(id))

    if (toSync.length === 0) {
      return res.status(200).json({ message: 'All finished matches already synced', synced: 0 })
    }

    // Load all our players once
    // Load ALL players in two explicit batches (handles Supabase 1000-row cap)
    const [batch1, batch2] = await Promise.all([
      supabase.from('players').select('id, name, country, position').range(0, 999),
      supabase.from('players').select('id, name, country, position').range(1000, 1999),
    ])
    if (batch1.error) return res.status(500).json({ error: 'Failed to load players: ' + batch1.error.message })
    const dbPlayers = [...(batch1.data || []), ...(batch2.data || [])]

    const results = []

    for (const fixtureId of toSync) {
      try {
        // Get player stats for this fixture
        const statsData = await apiFetch(`/fixtures/players?fixture=${fixtureId}`)
        const teams = statsData.response || []

        // Also get events to confirm goals/assists
        const eventsData = await apiFetch(`/fixtures/events?fixture=${fixtureId}`)
        const events = eventsData.response || []

        // Determine clean sheets: did GK's team concede?
        // fixtures endpoint gives us scores
        const fixtureData = await apiFetch(`/fixtures?id=${fixtureId}`)
        const fixture = fixtureData.response?.[0]
        const homeScore = fixture?.goals?.home ?? 0
        const awayScore = fixture?.goals?.away ?? 0
        const homeTeamId = fixture?.teams?.home?.id
        const awayTeamId = fixture?.teams?.away?.id

        let matchedCount = 0
        let unmatchedPlayers = []
        let upsertErrors = []

        for (const team of teams) {
          const isHome = team.team.id === homeTeamId
          const teamConceded = isHome ? awayScore : homeScore
          const cleanSheet = teamConceded === 0

          for (const playerEntry of team.players) {
            const p = playerEntry.player
            const s = playerEntry.statistics?.[0]
            if (!s) continue

            // null minutes = stats not yet loaded (keep them); 0 = didn't play (skip)
            const minutesRaw  = s.games?.minutes ?? null
            if (minutesRaw === 0) continue
            const minutes = minutesRaw ?? 0  // safe default for NOT NULL column

            const goals       = s.goals?.total || 0
            const assists     = s.goals?.assists || 0
            const yellowCards = s.cards?.yellow || 0
            const redCards    = (s.cards?.red || 0) + (s.cards?.yellowred || 0)

            // Check alias table first, then fuzzy match
            const apiLower   = p.name.toLowerCase()
            const aliasedDb  = NAME_ALIASES[apiLower]
            const dbPlayer   = dbPlayers.find(d =>
              aliasedDb
                ? d.name.toLowerCase() === aliasedDb
                : namesMatch(d.name, p.name)
            )

            if (!dbPlayer) {
              unmatchedPlayers.push(p.name)
              continue
            }

            // Upsert stats
            const { error } = await supabase
              .from('player_match_stats')
              .upsert({
                player_id:      dbPlayer.id,
                api_fixture_id: fixtureId,
                goals,
                assists,
                yellow_cards:   yellowCards,
                red_cards:      redCards,
                clean_sheet:    cleanSheet,
                minutes_played: minutes,
              }, { onConflict: 'player_id,api_fixture_id' })

            if (error) {
              upsertErrors.push(`${dbPlayer.name}: ${error.message}`)
            } else {
              // Calculate fantasy points (captain check happens next)
              await supabase.rpc('calculate_fantasy_points', {
                p_player_id:  dbPlayer.id,
                p_fixture_id: fixtureId,
                p_is_captain: false,  // base calculation; captain boost applied below
              })
              matchedCount++
            }
          }
        }

        // Apply captain double: find all fantasy teams that have a captain in this fixture
        // Get all team players who played in this fixture and are captains
        const { data: captainRows } = await supabase
          .from('fantasy_team_players')
          .select('player_id')
          .eq('is_captain', true)

        if (captainRows?.length) {
          const captainPlayerIds = captainRows.map(r => r.player_id)
          // Re-calculate points for captains with the multiplier
          for (const cpId of captainPlayerIds) {
            await supabase.rpc('calculate_fantasy_points', {
              p_player_id:  cpId,
              p_fixture_id: fixtureId,
              p_is_captain: true,
            })
          }
        }

        results.push({
          fixtureId,
          home: fixture?.teams?.home?.name,
          away: fixture?.teams?.away?.name,
          matched: matchedCount,
          unmatched: unmatchedPlayers.length,
          unmatchedNames: unmatchedPlayers,
          ...(upsertErrors.length ? { upsertErrors } : {}),
        })
      } catch (fixtureErr) {
        results.push({ fixtureId, error: fixtureErr.message })
      }
    }

    return res.status(200).json({ synced: results.length, results })
  } catch (err) {
    console.error('sync-scores error:', err)
    return res.status(500).json({ error: err.message })
  }
}

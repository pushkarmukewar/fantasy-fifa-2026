/**
 * GET /api/admin/audit-players?secret=...
 *
 * Fetches every World Cup team's squad from api-football.com and
 * checks each player name against our DB using the same fuzzy
 * matching logic as sync-scores. Returns a full report of which
 * players will NOT match so we can pre-emptively fix them.
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

// ── Same matching logic as sync-scores.js ──────────────────────

const NAME_ALIASES = {
  // South Korea
  'gi-hyuk lee':   'lee ki-hyuk',
  'gihyuk lee':    'lee ki-hyuk',
  'park jin-seop': 'park jin-seob',

  // Uzbekistan — API uses "X. Lastname" initial format
  'b. ergashev':   'botirali ergashev',
  'a. nematov':    'abduvohid nematov',
  'u. yusupov':    'utkir yusupov',
  'k. alijonov':   'khojiakbar alijonov',
  'r. ashurmatov': 'rustam ashurmatov',
  'u. eshmurodov': 'umar eshmurodov',
  'b. karimov':    'bekhruz karimov',
  'a. khusanov':   'abdukodir khusanov',
  's. nasrullayev':'sherzod nasrullaev',   // different spelling
  'f. sayfiev':    'farrukh sayfiev',
  'j. urozov':     'jakhongir urozov',
  'a. ganiev':     'azizjon ganiev',
  'j. iskanderov': 'jamshid iskanderov',
  'o. hamrobekov': 'odiljon hamrobekov',
  'a. mozgovoy':   'akmal mozgovoy',
  'o. shukurov':   'otabek shukurov',
  'o. orunov':     'oston urunov',          // different spelling
  'd. khamdamov':  'dostonbek khamdamov',
  'i. sergeev':    'igor sergeev',
  'e. shomurodov': 'eldor shomurodov',
  // Spain
  'álex grimaldo': 'alejandro grimaldo',
  'alex grimaldo': 'alejandro grimaldo',
  'joan garcia':   'joan garcía',
  'eric garcia':   'eric garcía',
}

function normalizeName(name) {
  return name
    .toLowerCase()
    // Map special chars that don't decompose via NFD
    .replace(/ø|ö/g, 'o').replace(/å/g, 'a').replace(/æ/g, 'ae')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's')
    .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove remaining accents
    .replace(/-/g, ' ')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
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

  if (dbLast.length > 3 && dbLast === apiLast) return true

  const dbSorted  = [...dbParts].sort().join(' ')
  const apiSorted = [...apiParts].sort().join(' ')
  if (dbSorted === apiSorted) return true

  const isInitial = parts => parts.length >= 2 && parts[0].length === 1
  if (isInitial(apiParts)) {
    const [init, ...rest] = apiParts
    const last = rest[rest.length - 1]
    if (dbParts[0]?.[0] === init && dbLast === last) return true
    if (dbParts.some(p => p[0] === init) && dbParts.includes(last)) return true
  }
  if (isInitial(dbParts)) {
    const [init, ...rest] = dbParts
    const last = rest[rest.length - 1]
    if (apiParts[0]?.[0] === init && apiLast === last) return true
    if (apiParts.some(p => p[0] === init) && apiParts.includes(last)) return true
  }

  if (api.includes(db) || db.includes(api)) return true

  const dbWords  = dbParts.filter(w => w.length >= 5)
  const apiWords = apiParts.filter(w => w.length >= 5)
  if (dbWords.length > 0 && dbWords.some(w => apiWords.includes(w))) return true

  const dbNoSpace  = dbParts.join('')
  const apiNoSpace = apiParts.join('')
  if (dbNoSpace === apiNoSpace) return true

  return false
}

function findDbMatch(dbPlayers, apiName) {
  const apiLower  = apiName.toLowerCase()
  const aliasedDb = NAME_ALIASES[apiLower]
  return dbPlayers.find(d =>
    aliasedDb
      ? d.name.toLowerCase() === aliasedDb
      : namesMatch(d.name, apiName)
  ) || null
}

// ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'supersecret123'))
    return res.status(401).json({ error: 'Unauthorized' })
  if (!API_KEY)
    return res.status(500).json({ error: 'API_FOOTBALL_KEY not set' })

  try {
    // ── Sanity-check the matching function itself ──────────────
    const _debug = {
      norm_B_Ergashev:      normalizeName('B. Ergashev'),
      norm_Botirali:        normalizeName('Botirali Ergashev'),
      lastNameMatch:        namesMatch('Botirali Ergashev', 'B. Ergashev'),
      aliasMatch:           findDbMatch(
        [{ id: 'x', name: 'Botirali Ergashev', country: 'Uzbekistan', position: 'FWD' }],
        'B. Ergashev'
      )?.name ?? null,
    }
    // ──────────────────────────────────────────────────────────

    // 1. Load all our DB players once
    const { data: dbPlayersRaw, error: playersErr } = await supabase
      .from('players')
      .select('id, name, country, position')
      .limit(2000)
    if (playersErr) return res.status(500).json({ error: playersErr.message })
    const dbPlayers = dbPlayersRaw || []

    // 2. Get all WC teams
    const teamsData = await apiFetch(`/teams?league=${LEAGUE}&season=${SEASON}`)
    const teams = teamsData.response || []

    if (teams.length === 0) {
      return res.status(200).json({ error: 'No teams found — check league/season config' })
    }

    // 3. For each team, fetch squad and check names
    const report = []
    let totalApi = 0, totalMatched = 0, totalUnmatched = 0

    for (const teamEntry of teams) {
      const teamId   = teamEntry.team.id
      const teamName = teamEntry.team.name

      let squadData
      try {
        squadData = await apiFetch(`/players/squads?team=${teamId}`)
      } catch (e) {
        report.push({ team: teamName, error: e.message })
        continue
      }

      const squadPlayers = squadData.response?.[0]?.players || []
      const unmatched = []
      const matched   = []

      for (const p of squadPlayers) {
        totalApi++
        const dbPlayer = findDbMatch(dbPlayers, p.name)
        if (dbPlayer) {
          totalMatched++
          matched.push({ api: p.name, db: dbPlayer.name })
        } else {
          totalUnmatched++
          unmatched.push(p.name)
        }
      }

      // Only include teams with unmatched players in the main report
      // (always include matched count for visibility)
      report.push({
        team: teamName,
        apiCount: squadPlayers.length,
        matched: matched.length,
        unmatched: unmatched.length,
        unmatchedNames: unmatched,
        // Uncomment below to see all matched pairs too:
        // matchedPairs: matched,
      })
    }

    // Sort: teams with most unmatched first
    report.sort((a, b) => (b.unmatched || 0) - (a.unmatched || 0))

    return res.status(200).json({
      _debug,
      summary: {
        teams: teams.length,
        totalApiPlayers: totalApi,
        totalMatched,
        totalUnmatched,
        matchRate: totalApi > 0
          ? `${Math.round((totalMatched / totalApi) * 100)}%`
          : 'n/a',
      },
      report,
    })
  } catch (err) {
    console.error('audit-players error:', err)
    return res.status(500).json({ error: err.message })
  }
}

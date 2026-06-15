/**
 * POST /api/admin/fix-player-names?secret=...&apply=true
 *
 * For every WC team, fetches the squad from api-football, then finds DB players
 * that are stored as a single last-name only and updates them with the full name.
 *
 * By default (no ?apply=true) it runs as a DRY RUN — returns what it WOULD change.
 * Add ?apply=true to actually write the updates.
 *
 * Skips ambiguous cases (e.g. 3× "Martinez" in Argentina) and reports them separately.
 */

import { createClient } from '@supabase/supabase-js'

const API_KEY  = process.env.API_FOOTBALL_KEY
const BASE_URL = 'https://v3.football.api-sports.io'
const LEAGUE   = 1
const SEASON   = 2026

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`)
  return res.json()
}

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/ø|ö/g, 'o').replace(/å/g, 'a').replace(/æ/g, 'ae')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's')
    .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/-/g, ' ')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// api-football country name → DB country name mapping
const COUNTRY_MAP = {
  'Korea Republic': 'South Korea',
  'USA':            'United States',
  'IR Iran':        'Iran',
  'Côte d\'Ivoire': 'Ivory Coast',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'supersecret123'))
    return res.status(401).json({ error: 'Unauthorized' })

  const dryRun = req.query.apply !== 'true'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    // Load all DB players in two batches
    const [b1, b2] = await Promise.all([
      supabase.from('players').select('id, name, country, position').range(0, 999),
      supabase.from('players').select('id, name, country, position').range(1000, 1999),
    ])
    const dbPlayers = [...(b1.data || []), ...(b2.data || [])]

    // Single-name players only (these are the risky ones)
    const singleNamePlayers = dbPlayers.filter(p => !p.name.trim().includes(' '))

    // Get all WC teams
    const teamsData = await apiFetch(`/teams?league=${LEAGUE}&season=${SEASON}`)
    const teams = teamsData.response || []

    const updates    = []   // { id, oldName, newName, country }
    const ambiguous  = []   // { apiName, country, candidates: [...] }
    const debugTeams = []   // per-team diagnostics

    for (const teamEntry of teams) {
      const apiCountry = teamEntry.team.name
      const dbCountry  = COUNTRY_MAP[apiCountry] || apiCountry

      // DB players for this country that are single-name
      const countryPlayers = singleNamePlayers.filter(
        p => p.country.toLowerCase() === dbCountry.toLowerCase()
      )

      let squadData, squadError
      try {
        squadData = await apiFetch(`/players/squads?team=${teamEntry.team.id}`)
      } catch (e) {
        squadError = e.message
      }

      const squad = squadData?.response?.[0]?.players || []

      debugTeams.push({
        apiCountry,
        dbCountry,
        dbSingleNameCount: countryPlayers.length,
        squadFetched: !squadError,
        squadError: squadError || null,
        squadCount: squad.length,
        sampleApiNames: squad.slice(0, 3).map(p => p.name),
        sampleDbNames: countryPlayers.slice(0, 3).map(p => p.name),
      })

      if (countryPlayers.length === 0 || squad.length === 0) continue

      for (const apiPlayer of squad) {
        const apiNorm  = normalize(apiPlayer.name)
        const apiParts = apiNorm.split(' ')
        const apiLast  = apiParts[apiParts.length - 1]

        // Skip if API name is already single-word (nothing to expand to)
        if (apiParts.length === 1) continue

        // Find DB player(s) whose single name matches the API last name
        const candidates = countryPlayers.filter(dbp => {
          const dbNorm = normalize(dbp.name)
          return dbNorm === apiLast
        })

        if (candidates.length === 0) {
          // Might be a full-name DB entry already — skip
          continue
        }

        if (candidates.length > 1) {
          // Ambiguous: multiple DB players with same last name for this country
          ambiguous.push({
            apiName: apiPlayer.name,
            country: dbCountry,
            candidates: candidates.map(c => ({ id: c.id, name: c.name })),
          })
          continue
        }

        const dbPlayer = candidates[0]

        // Skip if DB already has the full name (or longer)
        if (normalize(dbPlayer.name) === apiNorm) continue

        updates.push({
          id:      dbPlayer.id,
          oldName: dbPlayer.name,
          newName: apiPlayer.name,
          country: dbCountry,
        })
      }
    }

    // Deduplicate updates (same DB player matched by multiple API entries)
    const seen = new Set()
    const uniqueUpdates = updates.filter(u => {
      if (seen.has(u.id)) return false
      seen.add(u.id)
      return true
    })

    if (!dryRun) {
      // Apply updates in batches
      let applied = 0
      const errors = []
      for (const u of uniqueUpdates) {
        const { error } = await supabase
          .from('players')
          .update({ name: u.newName })
          .eq('id', u.id)
        if (error) errors.push(`${u.oldName}: ${error.message}`)
        else applied++
      }

      return res.status(200).json({
        mode:      'APPLIED',
        applied,
        errors,
        ambiguous: ambiguous.length,
        ambiguousList: ambiguous,
      })
    }

    return res.status(200).json({
      mode:            'DRY RUN — add ?apply=true to commit',
      singleNameInDb:  singleNamePlayers.length,
      teamsFromApi:    teams.length,
      wouldUpdate:     uniqueUpdates.length,
      ambiguous:       ambiguous.length,
      updates:         uniqueUpdates,
      ambiguousList:   ambiguous,
      debugTeams,      // shows per-team: dbSingleNameCount, squadCount, sampleNames
    })

  } catch (err) {
    console.error('fix-player-names error:', err)
    return res.status(500).json({ error: err.message })
  }
}

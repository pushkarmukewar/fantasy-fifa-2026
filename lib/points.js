/**
 * Points scoring rules for Fantasy FIFA 2026
 *
 * Appearance:    60+ min → 2pts,  <60 min → 1pt
 * Goal:          FWD/MID → 6pts,  DEF/GK → 10pts
 * Assist:        4pts
 * Clean sheet:   GK/DEF → 4pts   (only if 60+ min played)
 * Yellow card:  -1pt
 * Red card:     -3pts
 * Own goal:     -2pts each
 */
export function calculatePoints(stats, position) {
  const breakdown = {}
  let total = 0

  // Appearance
  if (stats.minutes_played >= 60) {
    breakdown.appearance = 2
  } else if (stats.minutes_played > 0) {
    breakdown.appearance = 1
  } else {
    breakdown.appearance = 0
  }
  total += breakdown.appearance

  // Goals
  const goalPoints = (position === 'DEF' || position === 'GK') ? 10 : 6
  breakdown.goals = stats.goals * goalPoints
  total += breakdown.goals

  // Assists
  breakdown.assists = stats.assists * 4
  total += breakdown.assists

  // Clean sheet (only GK and DEF, only if played 60+ min)
  if ((position === 'GK' || position === 'DEF') && stats.clean_sheet && stats.minutes_played >= 60) {
    breakdown.clean_sheet = 4
  } else {
    breakdown.clean_sheet = 0
  }
  total += breakdown.clean_sheet

  // Yellow cards
  breakdown.yellow_cards = stats.yellow_cards * -1
  total += breakdown.yellow_cards

  // Red cards
  breakdown.red_cards = stats.red_cards * -3
  total += breakdown.red_cards

  // Own goals
  breakdown.own_goals = stats.own_goals * -2
  total += breakdown.own_goals

  return { total, breakdown }
}

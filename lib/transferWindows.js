// Transfer windows — start and end are inclusive (midnight to midnight UTC)
export const TRANSFER_WINDOWS = [
  { label: 'Round 1 → Round 2',         start: '2026-06-19', end: '2026-06-19' },
  { label: 'Round 2 → Round 3',         start: '2026-06-24', end: '2026-06-25' },
  { label: 'Round 3 → Round of 32',     start: '2026-06-29', end: '2026-06-30' },
  { label: 'Round of 32 → Round of 16', start: '2026-07-04', end: '2026-07-05' },
  { label: 'Round of 16 → Quarter-Finals', start: '2026-07-08', end: '2026-07-09' },
  { label: 'Quarter-Finals → Semi-Finals', start: '2026-07-12', end: '2026-07-13' },
  { label: 'Semi-Finals → Final',        start: '2026-07-16', end: '2026-07-17' },
]

// Returns the currently open window, or null
export function getOpenWindow() {
  const today = new Date().toISOString().slice(0, 10)
  return TRANSFER_WINDOWS.find(w => today >= w.start && today <= w.end) || null
}

// Returns the next upcoming window, or null
export function getNextWindow() {
  const today = new Date().toISOString().slice(0, 10)
  return TRANSFER_WINDOWS.find(w => w.start > today) || null
}

// Returns days until a date string
export function daysUntil(dateStr) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target - now) / 86400000)
}

// Returns a live countdown string (HH:MM:SS) until end of current window
export function countdownToEndOf(dateStr) {
  const endOfDay = new Date(dateStr + 'T23:59:59')
  const diff = endOfDay - new Date()
  if (diff <= 0) return '00:00:00'
  const h = Math.floor(diff / 3600000).toString().padStart(2, '0')
  const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
  const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

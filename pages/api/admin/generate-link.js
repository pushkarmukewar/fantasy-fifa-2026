/**
 * POST /api/admin/generate-link?secret=...
 * Body: { email }
 * Returns a magic sign-in link for the given email without sending any email.
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (req.query.secret !== (process.env.ADMIN_SECRET || 'supersecret123'))
    return res.status(401).json({ error: 'Unauthorized' })

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fantasy-fifa-2026.vercel.app'}/auth/callback`,
    },
  })

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ link: data.properties?.action_link })
}

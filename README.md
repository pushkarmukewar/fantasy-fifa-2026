# Fantasy FIFA 2026 ⚽

A fantasy football web app for the 2026 FIFA World Cup. Pick 5 players within a $50M budget, earn points based on real match performances, compete on a global leaderboard.

---

## Local Setup (first time)

### 1. Prerequisites

- **Node.js** 18+ → [nodejs.org](https://nodejs.org)
- **Supabase CLI** → `npm install -g supabase`
- **Docker Desktop** (required by Supabase local) → [docker.com](https://www.docker.com/products/docker-desktop)

---

### 2. Install dependencies

```bash
cd fantasy-fifa-2026
npm install
```

---

### 3. Start Supabase locally

```bash
supabase init        # only needed once — creates supabase/ config
supabase start       # starts Postgres + Auth + local email (Inbucket)
```

After `supabase start`, you'll see output like:

```
API URL:     http://127.0.0.1:54321
anon key:    eyJh...  ← copy this
```

---

### 4. Configure environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and paste the anon key from the previous step:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...your-key-here...
ADMIN_SECRET=supersecret123
```

---

### 5. Run DB migrations + seed players

```bash
supabase db reset    # applies migrations + seed automatically
```

Or manually:

```bash
supabase db push
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/seed/players.sql
```

---

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Testing magic link auth locally

When you enter your email on the login page, Supabase local sends the magic link to **Inbucket** (a fake inbox) instead of a real email server.

Open Inbucket at → [http://localhost:54324](http://localhost:54324)

Find your email, click the magic link, and you'll be signed in.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Login (magic link) |
| `/dashboard` | Your team + points summary |
| `/team` | Pick / edit your 5-player squad |
| `/leaderboard` | Global rankings |
| `/admin` | Enter match stats (password-protected) |

---

## Admin: Submitting match stats

After a World Cup match, go to `/admin`, enter your admin secret, select the match, and fill in each player's stats. On submit, points are calculated and the leaderboard updates automatically.

**Points system:**

| Event | Points |
|-------|--------|
| Appearance (60+ min) | +2 |
| Appearance (<60 min) | +1 |
| Goal (FWD/MID) | +6 |
| Goal (DEF/GK) | +10 |
| Assist | +4 |
| Clean sheet (GK/DEF, 60+ min) | +4 |
| Yellow card | -1 |
| Red card | -3 |
| Own goal | -2 |

---

## Going to Production

1. Create a free project at [supabase.com](https://supabase.com)
2. Push your schema: `supabase db push --db-url <your-project-db-url>`
3. Run player seed SQL in the Supabase dashboard SQL editor
4. Deploy to [Vercel](https://vercel.com): connect your GitHub repo, add env vars
5. Update `.env.local` → Vercel environment variables with production Supabase URLs

That's it — no code changes needed.

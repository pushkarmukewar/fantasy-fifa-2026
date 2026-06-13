-- ============================================================
-- Fantasy FIFA 2026 - Migration 002: API sync + all fixes
-- ============================================================

-- ── 0. matches: add api_fixture_id + extra columns ──────────
ALTER TABLE matches ADD COLUMN IF NOT EXISTS api_fixture_id BIGINT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS kickoff_time   TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue          TEXT;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_api_fixture_id_key;
ALTER TABLE matches ADD CONSTRAINT matches_api_fixture_id_key UNIQUE (api_fixture_id);

-- ── 1. fantasy_team_players: add is_captain ─────────────────
ALTER TABLE fantasy_team_players ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT FALSE;

-- ── 2. player_match_stats: overhaul for api-football sync ───

-- Make match_id nullable (sync doesn't always have a local match row)
ALTER TABLE player_match_stats ALTER COLUMN match_id DROP NOT NULL;

-- Add api_fixture_id (the id from api-football.com)
ALTER TABLE player_match_stats ADD COLUMN IF NOT EXISTS api_fixture_id BIGINT;

-- Add match_date (used to exclude late-joiner retroactive points)
ALTER TABLE player_match_stats ADD COLUMN IF NOT EXISTS match_date DATE;

-- Replace the (player_id, match_id) unique constraint with (player_id, api_fixture_id)
ALTER TABLE player_match_stats DROP CONSTRAINT IF EXISTS player_match_stats_player_id_match_id_key;
ALTER TABLE player_match_stats
  ADD CONSTRAINT player_match_stats_player_id_api_fixture_id_key
  UNIQUE (player_id, api_fixture_id);

-- ── 3. player_points: overhaul for api-football sync ────────

-- Make match_id nullable
ALTER TABLE player_points ALTER COLUMN match_id DROP NOT NULL;

-- Add api_fixture_id
ALTER TABLE player_points ADD COLUMN IF NOT EXISTS api_fixture_id BIGINT;

-- Add is_captain_pts flag
ALTER TABLE player_points ADD COLUMN IF NOT EXISTS is_captain_pts BOOLEAN DEFAULT FALSE;

-- Replace unique constraint
ALTER TABLE player_points DROP CONSTRAINT IF EXISTS player_points_player_id_match_id_key;
ALTER TABLE player_points
  ADD CONSTRAINT player_points_player_id_api_fixture_id_key
  UNIQUE (player_id, api_fixture_id);

-- ── 4. RLS: open up team reads for leaderboard ──────────────

-- fantasy_teams: allow all authenticated users to read (needed for leaderboard view)
DROP POLICY IF EXISTS "Own team read" ON fantasy_teams;
CREATE POLICY "read teams"   ON fantasy_teams FOR SELECT USING (true);
CREATE POLICY "insert teams" ON fantasy_teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update teams" ON fantasy_teams FOR UPDATE USING (auth.uid() = user_id);

-- fantasy_team_players: allow all reads (needed for leaderboard view)
DROP POLICY IF EXISTS "Own team players read" ON fantasy_team_players;
CREATE POLICY "read team players" ON fantasy_team_players FOR SELECT USING (true);

-- ── 5. GRANTs ───────────────────────────────────────────────

-- Table-level grants (required in addition to RLS policies)
GRANT SELECT ON players             TO anon, authenticated;
GRANT SELECT ON matches             TO anon, authenticated;
GRANT SELECT ON player_points       TO anon, authenticated;
GRANT SELECT ON player_match_stats  TO anon, authenticated;
GRANT SELECT ON fantasy_teams       TO anon, authenticated;
GRANT SELECT ON fantasy_team_players TO anon, authenticated;

-- Allow anon/authenticated to write match stats (sync runs as anon key)
GRANT ALL ON player_match_stats TO anon, authenticated;
GRANT ALL ON player_points      TO anon, authenticated;

-- Allow service_role to read teams (for admin users endpoint)
GRANT ALL ON fantasy_teams        TO service_role;
GRANT ALL ON fantasy_team_players TO service_role;
GRANT ALL ON player_points        TO service_role;
GRANT ALL ON player_match_stats   TO service_role;
GRANT ALL ON players              TO service_role;

-- Allow anon/authenticated to write stats policy
CREATE POLICY "anon write stats" ON player_match_stats
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "anon write points" ON player_points
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ── 6. Leaderboard view: date-gated + no auth.users join ────

DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS
SELECT
  ft.user_id,
  ft.name AS team_name,
  COALESCE(SUM(
    CASE WHEN pms.match_date IS NULL OR pms.match_date >= ft.created_at::date
         THEN pp.points ELSE 0 END
  ), 0) AS total_points,
  RANK() OVER (ORDER BY COALESCE(SUM(
    CASE WHEN pms.match_date IS NULL OR pms.match_date >= ft.created_at::date
         THEN pp.points ELSE 0 END
  ), 0) DESC) AS rank
FROM fantasy_teams ft
LEFT JOIN fantasy_team_players ftp ON ftp.fantasy_team_id = ft.id
LEFT JOIN player_points pp         ON pp.player_id = ftp.player_id
LEFT JOIN player_match_stats pms
  ON pms.player_id       = pp.player_id
  AND pms.api_fixture_id = pp.api_fixture_id
GROUP BY ft.user_id, ft.name;

GRANT SELECT ON leaderboard TO authenticated, anon, service_role;

-- ── 7. calculate_fantasy_points function ────────────────────

CREATE OR REPLACE FUNCTION calculate_fantasy_points(
  p_player_id  uuid,
  p_fixture_id bigint,
  p_is_captain boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_position     text;
  v_minutes      integer;
  v_goals        integer;
  v_assists      integer;
  v_yellow_cards integer;
  v_red_cards    integer;
  v_clean_sheet  boolean;
  v_points       integer := 0;
  v_breakdown    jsonb;
BEGIN
  -- Get player position
  SELECT position INTO v_position FROM players WHERE id = p_player_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Get match stats
  SELECT minutes_played, goals, assists, yellow_cards, red_cards, clean_sheet
  INTO v_minutes, v_goals, v_assists, v_yellow_cards, v_red_cards, v_clean_sheet
  FROM player_match_stats
  WHERE player_id = p_player_id AND api_fixture_id = p_fixture_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Appearance points
  IF v_minutes >= 60 THEN
    v_points := v_points + 2;
  ELSIF v_minutes > 0 THEN
    v_points := v_points + 1;
  END IF;

  -- Goal points (vary by position)
  IF v_position = 'FWD' THEN
    v_points := v_points + (v_goals * 4);
  ELSIF v_position = 'MID' THEN
    v_points := v_points + (v_goals * 5);
  ELSE -- DEF or GK
    v_points := v_points + (v_goals * 6);
  END IF;

  -- Assists
  v_points := v_points + (v_assists * 3);

  -- Clean sheet (only counts if played 60+ mins)
  IF v_clean_sheet AND v_minutes >= 60 THEN
    IF v_position IN ('GK', 'DEF') THEN
      v_points := v_points + 4;
    ELSIF v_position = 'MID' THEN
      v_points := v_points + 1;
    END IF;
  END IF;

  -- Card deductions
  v_points := v_points - v_yellow_cards;
  v_points := v_points - (v_red_cards * 3);

  -- Captain multiplier (applied last)
  IF p_is_captain THEN
    v_points := v_points * 2;
  END IF;

  -- Build breakdown JSON for transparency
  v_breakdown := jsonb_build_object(
    'minutes',      v_minutes,
    'goals',        v_goals,
    'assists',      v_assists,
    'clean_sheet',  v_clean_sheet,
    'yellow_cards', v_yellow_cards,
    'red_cards',    v_red_cards,
    'is_captain',   p_is_captain,
    'position',     v_position
  );

  -- Upsert into player_points
  INSERT INTO player_points (player_id, api_fixture_id, points, breakdown, is_captain_pts)
  VALUES (p_player_id, p_fixture_id, v_points, v_breakdown, p_is_captain)
  ON CONFLICT (player_id, api_fixture_id)
  DO UPDATE SET
    points         = EXCLUDED.points,
    breakdown      = EXCLUDED.breakdown,
    is_captain_pts = EXCLUDED.is_captain_pts;

  RETURN v_points;
END;
$$;

-- Allow anon/authenticated to call the function
GRANT EXECUTE ON FUNCTION calculate_fantasy_points(uuid, bigint, boolean) TO anon, authenticated;

-- ============================================================
-- Fantasy FIFA 2026 - Initial Schema
-- ============================================================

-- Players table (populated via seed)
CREATE TABLE players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  position    TEXT NOT NULL CHECK (position IN ('GK','DEF','MID','FWD')),
  country     TEXT NOT NULL,
  club        TEXT NOT NULL,
  rating      INT NOT NULL CHECK (rating BETWEEN 60 AND 99),
  price       INT NOT NULL,  -- in millions (e.g. 15 = $15M)
  photo_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Fantasy teams (one per user)
CREATE TABLE fantasy_teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'My Team',
  locked      BOOLEAN DEFAULT FALSE,  -- locked after tournament starts
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Junction: which players are in each fantasy team (max 5)
CREATE TABLE fantasy_team_players (
  fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id),
  PRIMARY KEY (fantasy_team_id, player_id)
);

-- World Cup matches
CREATE TABLE matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_date  DATE NOT NULL,
  stage       TEXT NOT NULL,  -- 'Group', 'Round of 32', 'QF', 'SF', 'Final'
  team_a      TEXT NOT NULL,
  team_b      TEXT NOT NULL,
  score_a     INT,
  score_b     INT,
  played      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Per-player stats for each match (entered by admin)
CREATE TABLE player_match_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES players(id),
  match_id        UUID NOT NULL REFERENCES matches(id),
  minutes_played  INT NOT NULL DEFAULT 0,
  goals           INT NOT NULL DEFAULT 0,
  assists         INT NOT NULL DEFAULT 0,
  clean_sheet     BOOLEAN DEFAULT FALSE,
  yellow_cards    INT NOT NULL DEFAULT 0,
  red_cards       INT NOT NULL DEFAULT 0,
  own_goals       INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

-- Computed points per player per match
CREATE TABLE player_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   UUID NOT NULL REFERENCES players(id),
  match_id    UUID NOT NULL REFERENCES matches(id),
  points      INT NOT NULL DEFAULT 0,
  breakdown   JSONB,  -- {"goals":12,"assists":4,"appearance":2,...}
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE players             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_match_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_points       ENABLE ROW LEVEL SECURITY;

-- Everyone can read players, matches, stats, points
CREATE POLICY "Public read players"   ON players            FOR SELECT USING (true);
CREATE POLICY "Public read matches"   ON matches            FOR SELECT USING (true);
CREATE POLICY "Public read stats"     ON player_match_stats FOR SELECT USING (true);
CREATE POLICY "Public read points"    ON player_points      FOR SELECT USING (true);

-- Users can only read/write their own fantasy team
CREATE POLICY "Own team read"   ON fantasy_teams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own team insert" ON fantasy_teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own team update" ON fantasy_teams FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Own team players read"   ON fantasy_team_players FOR SELECT
  USING (fantasy_team_id IN (SELECT id FROM fantasy_teams WHERE user_id = auth.uid()));
CREATE POLICY "Own team players insert" ON fantasy_team_players FOR INSERT
  WITH CHECK (fantasy_team_id IN (SELECT id FROM fantasy_teams WHERE user_id = auth.uid()));
CREATE POLICY "Own team players delete" ON fantasy_team_players FOR DELETE
  USING (fantasy_team_id IN (SELECT id FROM fantasy_teams WHERE user_id = auth.uid()));

-- ============================================================
-- Leaderboard view (public)
-- ============================================================

CREATE VIEW leaderboard AS
SELECT
  ft.user_id,
  ft.name AS team_name,
  u.email,
  COALESCE(SUM(pp.points), 0) AS total_points,
  RANK() OVER (ORDER BY COALESCE(SUM(pp.points), 0) DESC) AS rank
FROM fantasy_teams ft
JOIN auth.users u ON ft.user_id = u.id
LEFT JOIN fantasy_team_players ftp ON ftp.fantasy_team_id = ft.id
LEFT JOIN player_points pp ON pp.player_id = ftp.player_id
GROUP BY ft.user_id, ft.name, u.email;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS api_fixture_id BIGINT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS kickoff_time TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue TEXT;
ALTER TABLE matches ADD CONSTRAINT matches_api_fixture_id_key UNIQUE (api_fixture_id);
GRANT SELECT ON matches TO anon, authenticated;
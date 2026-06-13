CREATE POLICY "anon write matches" ON matches
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
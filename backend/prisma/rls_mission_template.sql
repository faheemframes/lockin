-- Optional: enable RLS for mission_template if exposed via Supabase Data API.
-- Prisma (postgres role) continues to manage templates via the Express API.

ALTER TABLE mission_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mission_template_select_active ON mission_template;
CREATE POLICY mission_template_select_active
  ON mission_template
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

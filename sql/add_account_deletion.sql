-- In-app account deletion with a 30-day grace period.
--
-- Deleting is a two-stage process:
--   1. The user requests deletion. A row lands here, their profile is
--      hidden from discovery, and they are signed out. Nothing is
--      destroyed yet - signing back in offers Restore.
--   2. After purge_after passes, the delete-account Edge Function
--      (action "purge", run daily by cron) removes their storage
--      objects, every row keyed to them, and finally the auth user.
--
-- Only the Edge Function (service role) writes here. The client may read
-- its own row so the app can show the countdown.

CREATE TABLE IF NOT EXISTS account_deletions (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at   timestamptz NOT NULL DEFAULT now(),
  purge_after    timestamptz NOT NULL,
  -- is_public as it was before we hid the profile, so Restore puts the
  -- account back exactly how the user left it
  prev_is_public boolean
);

-- The purge job's only query: "who is past their date?"
CREATE INDEX IF NOT EXISTS account_deletions_purge_after_idx
  ON account_deletions (purge_after);

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

-- Read-only, own row only. No INSERT/UPDATE/DELETE policies exist, so
-- clients cannot schedule or cancel a deletion by talking to the table
-- directly - it has to go through the Edge Function.
DROP POLICY IF EXISTS "read own deletion request" ON account_deletions;
CREATE POLICY "read own deletion request" ON account_deletions
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON account_deletions TO authenticated;


-- Delete every row keyed to one user.
--
-- Written as a scan over information_schema rather than a hardcoded list
-- so a table added later cannot silently orphan personal data - the one
-- failure mode that actually matters here. New tables are covered
-- automatically as long as they name their owner column conventionally.
--
-- global_recipes is deliberately excluded: it is the shared, immutable
-- copy other users' saved recipes point at. Removing it would delete
-- recipes out of other people's cookbooks.
CREATE OR REPLACE FUNCTION purge_user_rows(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name  = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type   = 'BASE TABLE'
      AND c.data_type    = 'uuid'
      AND c.column_name IN (
        'user_id', 'from_user_id', 'to_user_id',
        'follower_id', 'following_id',
        'blocker_id', 'blocked_id',
        'reporter_id', 'owner_user_id'
      )
      AND c.table_name <> 'global_recipes'
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.table_name, r.column_name)
      USING p_user_id;
  END LOOP;
END;
$$;

-- Service role only; never callable from the app.
REVOKE ALL ON FUNCTION purge_user_rows(uuid) FROM public, anon, authenticated;

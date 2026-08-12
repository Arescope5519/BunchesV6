-- Realtime for the social features.
--
-- useSocial subscribes to postgres_changes on these three tables so a
-- friend request or a shared recipe appears without waiting for the
-- 10-second poll. Supabase only streams changes for tables that are in
-- the supabase_realtime publication - a subscription to a table outside
-- it connects happily and then never fires, which looks like "realtime
-- just does not work" rather than a missing grant.
--
-- Safe to re-run: adding a table twice raises, so each is guarded.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friend_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shared_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shared_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
  END IF;
END $$;

-- Check what is published:
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' ORDER BY tablename;

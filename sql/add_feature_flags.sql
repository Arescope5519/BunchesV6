-- Per-user feature flags, for shipping features dark and enabling them
-- for select accounts before a general launch.
--
-- Shape: plain jsonb object, e.g. {"discover": true}. Absent key = off.
-- The app reads its own row only; flags are flipped by hand in the
-- dashboard. Admins (is_admin) get flagged features automatically, so
-- the admin account needs no flag row.
--
-- First user of this: the Discover feed. See CLAUDE.md.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Enable Discover for one tester:
--   UPDATE user_profiles
--   SET feature_flags = feature_flags || '{"discover": true}'::jsonb
--   WHERE username = 'their_username';

-- Disable again:
--   UPDATE user_profiles
--   SET feature_flags = feature_flags - 'discover'
--   WHERE username = 'their_username';

-- See who has it:
--   SELECT username, feature_flags FROM user_profiles
--   WHERE feature_flags ? 'discover';

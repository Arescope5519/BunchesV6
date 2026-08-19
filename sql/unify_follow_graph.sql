-- Unify friends onto the follow graph: mutual follows ARE friendship.
--
-- Before this, the app kept two parallel relationship systems:
--   - user_followers (asymmetric follow, used by profiles + Discover)
--   - user_profiles.friends[] (symmetric, maintained by app code that
--     could only write its own row - RLS silently ate the other half,
--     so removeFriend left you in the other person's list)
--
-- After this, user_followers is the single source of truth:
--   - friend request = a request for MUTUAL follow (friendship)
--   - accepting creates both directions at once
--   - one-way follow (public profiles) stays what it was
--   - user_profiles.friends[] becomes a CACHE of mutuals, maintained by
--     a trigger here, so every existing reader (share modal, private
--     profile access, realtime refresh) keeps working unchanged
--
-- Run order matters: preflight, functions, triggers, then migration.

-- ============================================================
-- 0. Preflight: normalize friends to uuid[] so the array operations
-- below are well-typed. The column was only ever written from JS, so
-- it may be text[]; both convert cleanly. Anything else aborts with
-- a clear message instead of half-running.
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t
  FROM pg_attribute a
  WHERE a.attrelid = 'user_profiles'::regclass AND a.attname = 'friends';

  IF t = 'uuid[]' THEN
    NULL; -- already right
  ELSIF t IN ('text[]', 'character varying[]') THEN
    EXECUTE 'ALTER TABLE user_profiles ALTER COLUMN friends DROP DEFAULT';
    EXECUTE 'ALTER TABLE user_profiles ALTER COLUMN friends TYPE uuid[] USING friends::uuid[]';
    EXECUTE 'ALTER TABLE user_profiles ALTER COLUMN friends SET DEFAULT ''{}''::uuid[]';
  ELSE
    RAISE EXCEPTION 'user_profiles.friends is % - expected uuid[] or text[]. Stop and report this type.', t;
  END IF;
END $$;

-- ============================================================
-- 1. Trigger: keep friends[] equal to "users I mutually follow"
-- ============================================================

CREATE OR REPLACE FUNCTION sync_mutual_friends()
RETURNS TRIGGER AS $$
DECLARE
  a uuid;  -- one side of the (possibly ex-)mutual pair
  b uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    a := NEW.follower_id;
    b := NEW.following_id;
    -- Became mutual only if the reverse row already exists
    IF EXISTS (
      SELECT 1 FROM user_followers
      WHERE follower_id = b AND following_id = a
    ) THEN
      UPDATE user_profiles
      SET friends = array_append(friends, b),
          friend_count = COALESCE(array_length(array_append(friends, b), 1), 0),
          updated_at = NOW()
      WHERE user_id = a AND NOT (friends @> ARRAY[b]);

      UPDATE user_profiles
      SET friends = array_append(friends, a),
          friend_count = COALESCE(array_length(array_append(friends, a), 1), 0),
          updated_at = NOW()
      WHERE user_id = b AND NOT (friends @> ARRAY[a]);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    a := OLD.follower_id;
    b := OLD.following_id;
    -- Any break of either direction ends the friendship; removal is
    -- idempotent so no mutual-check is needed
    UPDATE user_profiles
    SET friends = array_remove(friends, b),
        friend_count = COALESCE(array_length(array_remove(friends, b), 1), 0),
        updated_at = NOW()
    WHERE user_id = a AND friends @> ARRAY[b];

    UPDATE user_profiles
    SET friends = array_remove(friends, a),
        friend_count = COALESCE(array_length(array_remove(friends, a), 1), 0),
        updated_at = NOW()
    WHERE user_id = b AND friends @> ARRAY[a];
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_mutuality_change ON user_followers;
CREATE TRIGGER on_follow_mutuality_change
  AFTER INSERT OR DELETE ON user_followers
  FOR EACH ROW EXECUTE FUNCTION sync_mutual_friends();

-- ============================================================
-- 2. Accept a friend request: both follow directions at once.
-- SECURITY DEFINER because the acceptor must create the requester's
-- follow row, which row-level security would otherwise forbid.
-- ============================================================

CREATE OR REPLACE FUNCTION accept_follow_request(p_request_id uuid)
RETURNS void AS $$
DECLARE
  req RECORD;
BEGIN
  SELECT * INTO req FROM friend_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found or not pending';
  END IF;

  IF req.to_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized to accept this request';
  END IF;

  UPDATE friend_requests
  SET status = 'accepted', updated_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO user_followers (follower_id, following_id)
  VALUES (req.from_user_id, req.to_user_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  INSERT INTO user_followers (follower_id, following_id)
  VALUES (req.to_user_id, req.from_user_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_follow_request(uuid) TO authenticated;

-- ============================================================
-- 3. Sever every tie between two users (remove friend, block).
-- SECURITY DEFINER for the same reason: deleting the OTHER user's
-- follow row is a cross-user write.
-- ============================================================

CREATE OR REPLACE FUNCTION sever_follow_pair(p_other uuid)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM user_followers
  WHERE (follower_id = auth.uid() AND following_id = p_other)
     OR (follower_id = p_other AND following_id = auth.uid());

  DELETE FROM friend_requests
  WHERE status = 'pending'
    AND ((from_user_id = auth.uid() AND to_user_id = p_other)
      OR (from_user_id = p_other AND to_user_id = auth.uid()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION sever_follow_pair(uuid) TO authenticated;

-- ============================================================
-- 4. Migration: materialize existing friendships as follow rows.
-- Only SYMMETRIC friendships (both arrays list each other) migrate -
-- an asymmetric entry is the residue of the old removeFriend bug,
-- where the remover's array updated and the other side's write was
-- silently blocked, so honoring the remover's intent means dropping it.
-- The count triggers on user_followers fire per insert and keep
-- follower_count/following_count correct.
-- ============================================================

INSERT INTO user_followers (follower_id, following_id)
SELECT p.user_id, f.friend_id
FROM user_profiles p
CROSS JOIN LATERAL unnest(p.friends) AS f(friend_id)
JOIN user_profiles q ON q.user_id = f.friend_id
WHERE q.friends @> ARRAY[p.user_id]
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- Rebuild every friends[] cache from actual mutuals, clearing any
-- asymmetric residue in the same pass
UPDATE user_profiles p
SET friends = COALESCE(m.mutuals, '{}'::uuid[]),
    friend_count = COALESCE(array_length(m.mutuals, 1), 0)
FROM (
  SELECT p2.user_id,
         ARRAY(
           SELECT uf.following_id
           FROM user_followers uf
           WHERE uf.follower_id = p2.user_id
             AND EXISTS (
               SELECT 1 FROM user_followers r
               WHERE r.follower_id = uf.following_id
                 AND r.following_id = p2.user_id
             )
         ) AS mutuals
  FROM user_profiles p2
) m
WHERE m.user_id = p.user_id;

-- ============================================================
-- Sanity checks
-- ============================================================
-- Mutual pairs:
--   SELECT a.follower_id, a.following_id FROM user_followers a
--   JOIN user_followers b ON b.follower_id = a.following_id
--                        AND b.following_id = a.follower_id
--   WHERE a.follower_id < a.following_id;
--
-- friends[] should equal the mutuals of each user:
--   SELECT username, friend_count, friends FROM user_profiles
--   ORDER BY username;

-- Fix: "username is available" then "duplicate key value" on save.
--
-- isUsernameAvailable() selected from user_profiles and treated "no rows"
-- as available. RLS hides other users' profiles from that query, so a
-- taken username looked free every time - right up until the insert hit
-- the unique index.
--
-- SECURITY DEFINER lets the check see every row while returning only a
-- boolean, so nobody can enumerate profiles with it.

CREATE OR REPLACE FUNCTION username_available(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE lower(username) = lower(btrim(p_username))
  );
$$;

REVOKE ALL ON FUNCTION username_available(text) FROM public;
GRANT EXECUTE ON FUNCTION username_available(text) TO authenticated;

-- Case-insensitive uniqueness, so "Daniel" and "daniel" cannot both
-- exist. The app lowercases before writing, but the database should not
-- depend on the client getting that right.
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_idx
  ON user_profiles (lower(username));

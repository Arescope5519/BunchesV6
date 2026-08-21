-- Server-side enforcement of recipe and folder privacy.
--
-- Before this, per-recipe and per-folder privacy were UI promises only:
-- user_recipes_v2 stored no privacy at all (the flag lived solely on
-- the legacy recipes table), and every cross-user read path - profile
-- viewer, folder contents, favorites, the Feed, shelves - returned
-- private recipes of any public-profile user.
--
-- After this, the DATABASE refuses to serve a private recipe to anyone
-- but its owner (and admins, for moderation of reported content):
--
--   - user_recipes_v2.is_private is a real column, written on every
--     save, backfilled from the legacy table
--   - folder privacy is computed LIVE inside the policy via a
--     SECURITY DEFINER helper reading user_settings.folders, so
--     toggling a folder private/public changes visibility instantly
--     with no bulk updates
--   - the same rules are applied to the legacy recipes table
--
-- The service-layer queries need no privacy filters of their own:
-- rows they may not see simply do not come back.

-- ============================================================
-- 1. The column + backfill
-- ============================================================

ALTER TABLE user_recipes_v2
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Backfill from the legacy table, which was the only place the
-- per-recipe flag was stored until now (same ids in both tables)
UPDATE user_recipes_v2 v
SET is_private = true
FROM recipes r
WHERE r.id = v.id
  AND r.user_id = v.user_id
  AND r.is_private IS TRUE
  AND v.is_private IS DISTINCT FROM true;

-- ============================================================
-- 2. Folder privacy helper - the names of one user's private folders.
-- SECURITY DEFINER because RLS policies run as the QUERYING user, who
-- cannot read other people's user_settings rows.
-- ============================================================

CREATE OR REPLACE FUNCTION private_folder_names(p_owner uuid)
RETURNS text[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT f->>'name'
      FROM user_settings s,
           jsonb_array_elements(s.folders) AS f
      WHERE s.user_id = p_owner
        AND jsonb_typeof(f) = 'object'
        AND (f->>'isPrivate')::boolean IS TRUE
    ),
    '{}'::text[]
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION private_folder_names(uuid) TO authenticated;

-- ============================================================
-- 3. Rebuild SELECT policies on user_recipes_v2.
-- The folders column's type differs between environments (text[] or
-- jsonb) depending on how the table was created, so the policy text
-- is generated to match.
-- ============================================================

DO $$
DECLARE
  pol record;
  ftype text;
  folder_clause text;
BEGIN
  -- Drop every existing SELECT policy; the two below become canonical
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_recipes_v2' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON user_recipes_v2', pol.policyname);
  END LOOP;

  SELECT format_type(a.atttypid, a.atttypmod) INTO ftype
  FROM pg_attribute a
  WHERE a.attrelid = 'user_recipes_v2'::regclass AND a.attname = 'folders';

  IF ftype = 'text[]' OR ftype = 'character varying[]' THEN
    folder_clause := 'NOT (user_recipes_v2.folders && private_folder_names(user_recipes_v2.user_id))';
  ELSIF ftype = 'jsonb' THEN
    folder_clause := 'NOT (ARRAY(SELECT jsonb_array_elements_text(COALESCE(user_recipes_v2.folders, ''[]''::jsonb))) && private_folder_names(user_recipes_v2.user_id))';
  ELSE
    RAISE EXCEPTION 'user_recipes_v2.folders is % - expected text[] or jsonb. Stop and report this type.', ftype;
  END IF;

  EXECUTE 'CREATE POLICY "Owners read their own recipes" ON user_recipes_v2 '
       || 'FOR SELECT TO authenticated USING (auth.uid() = user_id)';

  EXECUTE 'CREATE POLICY "Others read public recipes of visible profiles" ON user_recipes_v2 '
       || 'FOR SELECT TO authenticated USING ('
       || '  is_private = false'
       || '  AND deleted_at IS NULL'
       || '  AND ' || folder_clause
       || '  AND EXISTS ('
       || '    SELECT 1 FROM user_profiles p'
       || '    WHERE p.user_id = user_recipes_v2.user_id'
       || '      AND (p.is_public = true OR p.friends @> ARRAY[auth.uid()])'
       || '  )'
       || ')';

  -- Admins can open reported content regardless (moderation)
  EXECUTE 'CREATE POLICY "Admins read for moderation" ON user_recipes_v2 '
       || 'FOR SELECT TO authenticated USING ('
       || '  EXISTS (SELECT 1 FROM user_profiles ap'
       || '          WHERE ap.user_id = auth.uid() AND ap.is_admin IS TRUE)'
       || ')';
END $$;

-- ============================================================
-- 4. Same rules on the legacy recipes table (still dual-written and
-- still the fallback in several cross-user readers). Its folder info
-- lives inside recipe_data jsonb.
-- ============================================================

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'recipes' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON recipes', pol.policyname);
  END LOOP;

  EXECUTE 'CREATE POLICY "Owners read their own recipes" ON recipes '
       || 'FOR SELECT TO authenticated USING (auth.uid() = user_id)';

  EXECUTE 'CREATE POLICY "Others read public recipes of visible profiles" ON recipes '
       || 'FOR SELECT TO authenticated USING ('
       || '  COALESCE(is_private, false) = false'
       || '  AND deleted_at IS NULL'
       || '  AND NOT ('
       || '    ARRAY(SELECT jsonb_array_elements_text(COALESCE(recipe_data->''folders'', ''[]''::jsonb)))'
       || '    && private_folder_names(recipes.user_id)'
       || '  )'
       || '  AND NOT (COALESCE(recipes.folder, '''') = ANY(private_folder_names(recipes.user_id)))'
       || '  AND EXISTS ('
       || '    SELECT 1 FROM user_profiles p'
       || '    WHERE p.user_id = recipes.user_id'
       || '      AND (p.is_public = true OR p.friends @> ARRAY[auth.uid()])'
       || '  )'
       || ')';

  EXECUTE 'CREATE POLICY "Admins read for moderation" ON recipes '
       || 'FOR SELECT TO authenticated USING ('
       || '  EXISTS (SELECT 1 FROM user_profiles ap'
       || '          WHERE ap.user_id = auth.uid() AND ap.is_admin IS TRUE)'
       || ')';
END $$;

-- ============================================================
-- Sanity checks
-- ============================================================
-- Column and backfill:
--   SELECT count(*) FILTER (WHERE is_private) AS private_rows,
--          count(*) AS total FROM user_recipes_v2;
--
-- Policies in force:
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('user_recipes_v2','recipes') ORDER BY 1, 3;
--
-- A user's private folder names:
--   SELECT private_folder_names('<some-user-uuid>');

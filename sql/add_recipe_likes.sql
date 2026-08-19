-- Likes on recipes, keyed by the GLOBAL recipe id.
--
-- A like targets global_recipes.id rather than a user's own copy, so
-- the same imported recipe accumulates one count no matter how many
-- people saved it, and the feed can fetch a page of like data with a
-- single .in() query. Recipes with no global counterpart (old custom
-- recipes from before the dual-write) simply don't show a like button.
--
-- Counts are read by everyone (they're shown on the public feed);
-- writes are strictly your own like row.

CREATE TABLE IF NOT EXISTS recipe_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  global_recipe_id uuid NOT NULL REFERENCES global_recipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, global_recipe_id)
);

CREATE INDEX IF NOT EXISTS recipe_likes_global_idx
  ON recipe_likes (global_recipe_id);
CREATE INDEX IF NOT EXISTS recipe_likes_user_idx
  ON recipe_likes (user_id);

ALTER TABLE recipe_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Likes are readable" ON recipe_likes;
CREATE POLICY "Likes are readable" ON recipe_likes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users like as themselves" ON recipe_likes;
CREATE POLICY "Users like as themselves" ON recipe_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users unlike their own likes" ON recipe_likes;
CREATE POLICY "Users unlike their own likes" ON recipe_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON recipe_likes TO authenticated;

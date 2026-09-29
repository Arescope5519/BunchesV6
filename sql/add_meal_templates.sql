-- Saved week templates for the Cook schedule: a named set of
-- (weekday, recipe, servings) entries the user can load into any week.
--
-- meals shape: [{ "dayOffset": 0-6, "recipeId": "...", "servings": 4 }]
-- dayOffset is relative to the week's Monday, so a template loads into
-- any week. Templates reference the user's own recipe ids; entries
-- whose recipe has since been deleted are skipped at load time.
--
-- Eat-tab events are deliberately NOT templated: meal_events is the
-- consumption ledger that drives fridge inventory, so copying those
-- would fabricate eaten meals.

CREATE TABLE IF NOT EXISTS meal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  meals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_templates_user_idx ON meal_templates (user_id, created_at DESC);

ALTER TABLE meal_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meal_templates') THEN
    CREATE POLICY "Users manage their own meal templates" ON meal_templates
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

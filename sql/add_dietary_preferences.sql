-- Phase 2: Dietary filters + tags
-- Adds dietary preferences storage to user profiles.
-- Shape: { "diets": ["vegetarian", ...], "avoid": ["dairy", "tree_nuts", ...] }
-- Keys come from DIETS / ALLERGENS in src/utils/dietaryAnalysis.js.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS dietary_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

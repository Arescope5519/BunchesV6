-- Frequently Used tags: per-user tag search counts, synced across devices.
-- Shape: { "dinner": { "display": "Dinner", "count": 5, "lastUsed": 1690000000000 }, ... }
-- Read/written by src/services/supabase/database.js

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS tag_search_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

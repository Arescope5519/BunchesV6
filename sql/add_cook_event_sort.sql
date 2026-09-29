-- Within-day ordering for the Cook schedule, so a day's meals can be
-- arranged in the order you plan to cook them (drag to swap). Existing
-- rows default to 0 and fall back to created_at order until touched.

ALTER TABLE cook_events
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Within-day ordering for the Eat schedule's single meal list per day
-- (the breakfast/lunch/dinner slots left the UI; drag arranges order).
-- Existing rows default to 0 and fall back to created_at order.

ALTER TABLE meal_events
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

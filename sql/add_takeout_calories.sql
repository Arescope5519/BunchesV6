-- Takeout meals can carry a USER-STATED calories-per-serving so they
-- count in the Kitchen Stats tab instead of "no data". Pass-through
-- only: the user types the number (off the receipt/menu), the app
-- never computes it. Null = unknown, excluded from totals as before.

alter table cook_events
  add column if not exists takeout_calories numeric
  check (takeout_calories is null or takeout_calories >= 0);

-- Phase 5: AI recipe scanning - usage tracking for rate limits.
-- Free = 3 scans lifetime, Premium = 30/month, admins unlimited.
-- Only the extract-recipe Edge Function (service role) reads/writes this
-- table, so RLS is enabled with NO client policies.

CREATE TABLE IF NOT EXISTS scan_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  success boolean NOT NULL DEFAULT true,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_usage_user_created_idx
  ON scan_usage (user_id, created_at);

ALTER TABLE scan_usage ENABLE ROW LEVEL SECURITY;

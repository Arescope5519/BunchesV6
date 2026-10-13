-- Extraction-quality reports: users flag recipes whose imported text
-- came out weird (mangled subheadings, grammar artifacts, merged
-- lines). NOT content moderation - that is content_reports.
--
-- The report snapshots the recipe's stored text at report time, so
-- the occasional cleanup session (tools/FIX_EXTRACTION_REPORTS.md)
-- can fix records and improve RecipeExtractor without re-fetching
-- bot-walled HTML.

create table if not exists extraction_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  global_recipe_id uuid references global_recipes (id) on delete set null,
  source_url text,
  recipe_title text,
  issue_note text,
  recipe_snapshot jsonb,
  status text not null default 'open' -- open | fixed | dismissed
);

alter table extraction_reports enable row level security;

-- Users file and see their own reports; the cleanup session reads
-- everything through the dashboard (service role bypasses RLS).
create policy "Users file own extraction reports"
on extraction_reports for insert to authenticated
with check (reporter_id = auth.uid());

create policy "Users read own extraction reports"
on extraction_reports for select to authenticated
using (reporter_id = auth.uid());

-- Lets any signed-in user ask ONE question about extraction_reports -
-- "is there an open report for this source URL?" - without being able
-- to read the reports themselves (RLS keeps those reporter-private).
-- RecipeDetail uses it to swap the report button for a "will be
-- reviewed" notice once anyone has reported the recipe. URL matching
-- ignores protocol and www., the same normalization the app uses.

create or replace function has_open_extraction_report(p_source_url text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from extraction_reports
    where status = 'open'
      and regexp_replace(source_url, '^https?://(www\.)?', '')
        = regexp_replace(p_source_url, '^https?://(www\.)?', '')
  );
$$;

grant execute on function has_open_extraction_report(text) to authenticated;

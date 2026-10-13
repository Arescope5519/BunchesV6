-- Server-side limits on extraction_reports. The app's own checks
-- (button hidden once reported, one report per user per day) are UI
-- conveniences - anyone holding a session token can call the REST API
-- directly, and before this the table took unlimited inserts of up to
-- ~150KB each, with the reporter choosing their own status.
--
-- After this migration:
--   1. ONE user report per recipe, ever. Once a recipe is reported it
--      stays reported - open, fixed or dismissed - and nobody can file
--      it again. (Auto-filed import failures get their own single slot
--      per URL, so a failed import never blocks a later formatting
--      report.) To let a recipe be reported again - say a fix did not
--      stick - delete its report row in the dashboard.
--   2. At most 20 reports per user per 24 hours.
--   3. Status is always 'open' on insert, and oversized fields are
--      trimmed or refused.
--
-- Safe to re-run.

-- Same identity rule the app uses (normalizeRecipeUrl): no protocol,
-- no www., no fragment, no tracking params, no trailing slash. Real
-- query params are kept - "?p=123" identifies a page on some sites.
create or replace function normalize_report_url(u text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  if u is null then return null; end if;
  s := lower(btrim(u));
  s := regexp_replace(s, '#.*$', '');
  s := regexp_replace(s, '^https?://(www\.)?', '');
  s := regexp_replace(s, '([?&])(utm_[a-z_]*|fbclid|gclid|mc_cid|mc_eid)=[^&]*', '\1', 'g');
  s := regexp_replace(s, '&&+', '&', 'g');
  s := regexp_replace(s, '\?&', '?');
  s := regexp_replace(s, '[?&]+$', '');
  s := regexp_replace(s, '/+(\?|$)', '\1');
  return nullif(s, '');
end;
$$;

-- 'failure' = auto-filed by a failed import, 'manual' = a user tapped
-- "Something look wrong?"
alter table extraction_reports
  add column if not exists report_kind text
  generated always as (
    case when issue_note like 'auto:%' then 'failure' else 'manual' end
  ) stored;

-- The recipe's identity: its normalized URL, or the global recipe id
-- for the rare report with no URL
alter table extraction_reports
  add column if not exists report_key text
  generated always as (
    coalesce(normalize_report_url(source_url), 'recipe:' || global_recipe_id::text)
  ) stored;

-- The actual "once per recipe" guarantee. A unique index, not a
-- check-then-insert, so two people reporting at the same instant
-- cannot both get in.
create unique index if not exists extraction_reports_one_per_recipe
  on extraction_reports (report_kind, report_key)
  where report_key is not null;

create or replace function extraction_reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Dashboard / service-role inserts are not limited
  if auth.uid() is null then
    return new;
  end if;

  new.status := 'open';
  new.created_at := now();
  new.issue_note := left(new.issue_note, 500);
  new.recipe_title := left(new.recipe_title, 300);
  new.raw_ld_json := left(new.raw_ld_json, 150000);

  if octet_length(coalesce(new.recipe_snapshot::text, '')) > 100000 then
    raise exception 'snapshot_too_large' using errcode = '22023';
  end if;

  if (
    select count(*) from extraction_reports
    where reporter_id = auth.uid()
      and created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists extraction_reports_limits on extraction_reports;
create trigger extraction_reports_limits
  before insert on extraction_reports
  for each row execute function extraction_reports_before_insert();

-- What the recipe page asks: has this recipe been reported, and where
-- did it get to? Returns 'open' | 'fixed' | 'dismissed', or null when
-- it has never been reported. The reports themselves stay private.
create or replace function extraction_report_status(p_source_url text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select status from extraction_reports
  where report_kind = 'manual'
    and report_key = normalize_report_url(p_source_url)
  limit 1;
$$;

revoke execute on function extraction_report_status(text) from public, anon;
grant execute on function extraction_report_status(text) to authenticated;

-- Older app builds still call this one. It now answers "reported at
-- all", so those builds stop offering the report button once a recipe
-- has been fixed, too.
create or replace function has_open_extraction_report(p_source_url text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select extraction_report_status(p_source_url) is not null;
$$;

revoke execute on function has_open_extraction_report(text) from public, anon;
grant execute on function has_open_extraction_report(text) to authenticated;

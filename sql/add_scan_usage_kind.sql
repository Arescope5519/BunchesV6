-- Free-tier AI allowances split into separate buckets: 5 successful
-- photo scans AND 5 successful Instagram (text) imports, lifetime.
-- The extract-recipe function records which kind each attempt was and
-- counts free usage per kind; premium stays one combined monthly pool.
-- Existing rows predate Instagram imports, so they are all 'photo'.

alter table scan_usage
  add column if not exists kind text not null default 'photo'
  check (kind in ('photo', 'text'));

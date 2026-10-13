# Fixing extraction reports (occasional manual session)

Users flag recipes whose imported text came out weird via "Formatting
look wrong? Report it" on the recipe page (`extraction_reports` table,
`sql/add_extraction_reports.sql`). Nothing processes these
automatically, by design - Claude tokens are only spent when Daniel
starts a session and says something like "work through the extraction
reports".

Each report carries a `recipe_snapshot` of the stored text, so most
fixes need NO page fetch - the mangled formatting is right there in
the snapshot. Only reach for the original HTML (paste it into chat, or
save the page from a browser) when the snapshot is missing content
rather than formatting it badly.

## Session flow

1. Daniel pulls the open reports in the dashboard and pastes them:

```sql
SELECT id, created_at, recipe_title, source_url,
       recipe_snapshot
FROM extraction_reports
WHERE status = 'open'
ORDER BY source_url, created_at;
```

2. For each report, Claude does BOTH halves:
   - **Fix the records**: produce the cleaned recipe JSON, then UPDATE
     SQL for `global_recipes` (title/ingredients/instructions) and the
     affected `user_recipes_v2.local_recipe_data` - always bumping the
     JSON `updatedAt` to epoch-ms-now so the repaired cloud copy wins
     the newer-copy-wins sync merge. SQL goes in chat; Daniel runs it.
   - **Fix the method**: diagnose WHY `src/RecipeExtractor.js` (or the
     extract-recipe Edge Function, for photo scans) produced that
     output, and patch it so future imports of that site family come
     out clean. The report is a free test fixture - quote the failing
     input in the commit message or a code comment.

3. Close what got handled:

```sql
UPDATE extraction_reports SET status = 'fixed'
WHERE id IN ('...');
-- or 'dismissed' for reports that aren't real problems
```

## Judgment calls

- A grammar oddity that faithfully matches the SOURCE site is not an
  extraction bug - dismiss it (we quote sources, we don't edit them).
- Formatting artifacts (schema.org list quirks, HTML entities, merged
  section headings, numbering baked into text) are extraction bugs:
  fix both the records and the extractor.
- Several reports from one domain = prioritize the extractor fix over
  record cleanup; the parser fix is what makes reports converge to
  zero as the same popular sites recur.

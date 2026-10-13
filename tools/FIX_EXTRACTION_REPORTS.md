# Fixing extraction reports (occasional manual session)

Users flag recipes whose imported text came out weird via "Formatting
look wrong? Report it" on the recipe page (`extraction_reports` table,
`sql/add_extraction_reports.sql`). Nothing processes these
automatically, by design - Claude tokens are only spent when Daniel
starts a session and says something like "work through the extraction
reports".

Each report carries a `recipe_snapshot` of the stored text, so most
fixes need NO page fetch - the mangled formatting is right there in
the snapshot. For MISSING-content cases, `raw_ld_json` holds the
source page's raw ld+json blocks, re-fetched by the reporter's phone
at report time (device fetches pass the bot walls that block
servers). Only when that column is null does fixing require Daniel to
paste the page HTML into chat.

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

## Auto-filed failure reports

Total extraction failures file themselves - `issue_note` starts with
`auto: extraction failed`, `recipe_title` is "Extraction failed" and
there is no snapshot. The interesting evidence is `raw_ld_json`:
- **Present** = the device could fetch the page but the parser lost -
  a real extractor bug with the failing input attached. Highest-value
  reports; fix the extractor (there is no record to repair - the user
  never got a recipe).
- **Null** = the device couldn't fetch the page either (bot wall,
  dead link, paywall). Usually dismiss, unless several users hit the
  same popular domain - then it's a fetch-strategy problem worth
  solving (see the WebView precedent for images).
Timeouts are NOT auto-filed (almost always the user's connection).

## Judgment calls

- A grammar oddity that faithfully matches the SOURCE site is not an
  extraction bug - dismiss it (we quote sources, we don't edit them).
- Formatting artifacts (schema.org list quirks, HTML entities, merged
  section headings, numbering baked into text) are extraction bugs:
  fix both the records and the extractor.
- Several reports from one domain = prioritize the extractor fix over
  record cleanup; the parser fix is what makes reports converge to
  zero as the same popular sites recur.
- **Repeated ingredients**: sites that list an ingredient per usage
  point produce duplicate lines. Consolidate to one "TOTAL unit name,
  divided" line - UNLESS the list has subsections ("For the sauce"),
  where repeats across sections are intentional, or the lines differ
  in preparation ("sliced" vs "diced"). The extractor already does the
  conservative version automatically
  (consolidateDuplicateIngredients); a report means it missed a case -
  fix the record AND teach the consolidator the pattern.

# Where We Left Off

**Last updated:** July 30, 2026 (end of long feature/design session)

## Branches
- **All work lives on `master`** (merged from `claude/copy-broken-branch-qQg4U`, which is identical).
- New sessions: base work on `master`. Local machine (Y:\BunchesV6) can pull either branch - they match as of this update.

## Working Name
**Hunii** (tentative - decide before launch).
- "Bunches" is OFF the table: registered trademark (Bunches, Inc., Class 45 social networking).
- "HoneyBun" also blocked (Society Inc., Classes 9 + 45).
- "Hunii" is USPTO-clear but collides practically with a VTuber (@huniibunchesofoats on TikTok, ironically). Accepted tradeoff for now; final call at launch prep.

## Current App State (all built, on master)

### Core
- Recipe extraction from URLs (share intent Android/iOS, quick link) with loading overlay,
  30s timeout, clear failure alerts
- Recipe cards: hero image on top, formatted times ("30 min"), deduped servings ("12 people"),
  nutrition grid at bottom (scaled by recipe multiplier), version picker
- Preview (SaveRecipeScreen) and saved card share formatters via src/utils/recipeFormat.js
- Versions/variants: first content edit auto-snapshots "Original"; picker offers
  Original / My Edits / friends' shared versions (attributed "shared by @user");
  "+ Create New Variant" removed
- Custom recipe creation with photo (moderated), profanity-filtered fields

### Kitchen (bottom nav tab, 4 sub-tabs)
- **Cook** (premium): weekly cook plan, recipe picker w/ cookbook browse, batch multiplier
  (base servings x 0.5/1/2...)
- **Eat** (premium): weekly meal slots (breakfast/lunch/dinner). Add meal from:
  Fridge (capped servings), Cook a Recipe (already-made → cook logged on eat day;
  not-yet → day chips schedule onto Cook plan), Take Out (leftovers → fridge).
  Tap meal = open recipe; long-press = edit servings/delete.
- **Shop** (free): grocery list (existing feature, embedded)
- **Fridge** (premium): computed inventory (cooked minus eaten minus adjustments),
  days-old warnings at 5+, Trash + Adjust portions actions, takeout badges
- Tables: cook_events (is_takeout/takeout_name), meal_events, fridge_adjustments
- Premium gating via user_profiles.is_premium (+premium_until); admins auto-premium

### Social
- Friends, requests, inbox (threaded), Discover placeholder (default tab)
- Profiles: featured carousel, sample recipes, cookbooks + Uncategorized
- Public recipe read-only view (import 📥 excludes My Creations, report 🚩)
- Share recipes with edits → attributed variant; recipient dedupe by URL
  (existing recipe gains the variant, no duplicate)
- Blocking (⋯ menu on profiles; Settings → Privacy → Blocked Users)
- Original-recipe sync for user-imported recipes (silent refresh on open)

### Moderation & Safety
- Image moderation: Sightengine via Edge Function `moderate-image`
  (nudity/offensive/gore/weapons + FACE DETECTION - no people in recipe photos)
- Text moderation: local wordlist + phrases ("kill yourself" etc.) then OpenAI
  omni-moderation via Edge Function `moderate-text`
- Keys live in Supabase env vars (NOT in app). supabase/functions/* in repo.
- Reports: modal w/ reason + 500-char details; rate-limited (10/hr, 24h dedupe)
- Admin: Settings → Moderation Queue (dismiss/delete recipe/ban user + preview)
- Discord webhook notifications via `moderation-webhook` fn + pg trigger
- First-launch disclaimer modal (placeholder ToS/PP URLs - REAL DOCS STILL NEEDED)

### Design (current)
- Theme: **Honey + Forest** - forest green #2D6A4F primary, honey #E9B44C accent,
  off-white bg. All in src/constants/colors.js (single-file swap).
- All 4 top bars standardized: height 100, paddingTop 38, paddingBottom 8.
  Social header = "Social" + profile chip centered on ONE line; Social sub-tabs
  are a LIGHT row (not green) so green thickness matches everywhere.
- Bottom nav: silvery frost bar (navBar tokens), Ionicons vector icons
  (green active / gray inactive)
- Vector icons (Ionicons) throughout chrome: header buttons in white circles,
  modal actions, Kitchen + Social tabs. Grocery buttons follow theme color.

### Known fixes to remember
- Android modal scroll: KAV behavior must be undefined on Android (not "height");
  recipe modal also remounts ScrollView via onShow tick (dead-scroll fix)
- Recipe deletion syncs BOTH recipes + user_recipes_v2 tables; sync respects
  old-table deleted_at (resurrection bug fixed)
- All recipes migrated to user_recipes_v2 (127/127)

## This Session (July 30, 2026 - branch claude/session-setup-y19h2x)
- Recipes page redesigned like Social: green header (title only) → light icon
  actions bar (add/link/search/cookbooks/view toggle) → sort+tags bar; cookbook
  title shows below bars when inside a cookbook; all emoji chrome → Ionicons
- PHASE 2 BUILT (needs testing): dietary analysis engine
  (src/utils/dietaryAnalysis.js - keyword matching, no external service),
  auto-derived diet chips (Vegetarian/Vegan/GF/DF computed from ingredients,
  never stored), categorized tags (src/constants/tags.js TAG_CATEGORIES),
  dietary prefs in Settings (user_profiles.dietary_preferences jsonb - run
  sql/add_dietary_preferences.sql!), Dietary filter section, allergen
  "May contain" row + avoided-line highlighting + conflict banner in
  RecipeDetail, conflict icon on cards

## Immediate Next Steps (per ROADMAP.md)
1. RUN SQL (all three, BEFORE installing the new build):
   sql/add_dietary_preferences.sql, sql/add_tag_search_counts.sql,
   sql/add_global_recipe_tags.sql (global_recipes.tags is REQUIRED -
   the recipe query selects it; backfill statement is optional)
2. Test latest build (recipes page redesign + Phase 2 dietary features,
   plus still-untested: top bars, Cook-from-Eat flow, icons)
3. Phase 2 COMPLETE (dietary filter now in IngredientSearch too)
4. Phase 3: Nutrition API (only if extracted data proves insufficient)
5. Phase 4: Sharing/deep links/Instagram
6. Phase 5: AI recipe scanning (flagship premium)
7. Phase 6: Subscriptions (StoreKit/Play Billing)
8. Phase 7: Launch prep (NAME DECISION, ToS/PP for real, store listings)

## Build (Android, Daniel's PC - project on Y:)
```cmd
Y:
cd Y:\BunchesV6
git pull origin master
taskkill /F /IM java.exe
rmdir /s /q android
npx expo prebuild --clean --platform android
cd android
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot" && gradlew.bat assembleRelease
```
APK: `Y:\BunchesV6\android\app\build\outputs\apk\release\`
(If a session pushes to a different branch, swap the pull accordingly.)

## Accounts / Services
- Supabase project ref: azdhiunzwslogbaiwtgi (see SERVICES.md for full map)
- Test users: angrychef (admin), socci
- secrets.js is gitignored; keys ALSO stored in Supabase env vars + Google
  Password Manager backup. Edge functions: moderate-image, moderate-text,
  moderation-webhook (Verify JWT ON for first two, OFF for webhook).
- SQL history: tables recipes/user_recipes_v2/cook_events/meal_events/
  fridge_adjustments/moderation_flags/content_reports/user_blocks/meal_plans(dropped)

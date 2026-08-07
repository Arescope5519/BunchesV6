# Where We Left Off

**Last updated:** August 7, 2026

## Branches
- **All work lives on `master`.** The session branch
  `claude/session-setup-y19h2x` is pushed to both and they are identical.
- New sessions: base work on `master`, merge back when done.
- NOTE: `origin/master` was force-pushed at some point in the past, so a
  stale local `master` on any machine may point at unrelated Nov 2025
  history. Fix with `git fetch origin master && git branch -f master origin/master`.

## Name and identity: DECIDED

**Melibri** (mel = honey, libri = books). Clean on USPTO across all
classes. The repo is still called BunchesV6; that is cosmetic.

- Domain **melibri.app** owned, on Cloudflare (registered personally -
  move the registrant to the LLC if one is formed).
- Bundle id / Android package: `app.melibri`. **Permanent once
  published**, even if the name changes again later.
- URL scheme `melibri://`, with `bunches://` still accepted on READ -
  see the note at the top of `src/constants/app.js`. Old recipes have
  `bunches://` source URLs persisted in the database.
- Email routing live via Cloudflare: `hello@`, `daniel@`, `privacy@`,
  `abuse@` all forward to `melibriapp@gmail.com`. Receiving only -
  **there is no way to send AS these addresses yet.**
- Avoid hummingbird imagery (see CLAUDE.md).

## Live infrastructure

- **melibri.app** serves `site/` via a Cloudflare Worker named
  `bunchesv6`. Terms and Privacy are up at `/terms` and `/privacy`,
  which is exactly what `TERMS_URL` / `PRIVACY_URL` point at.
  - Deploy is automatic on push to `master`.
  - **Retrying a build replays its pinned commit.** Only a new push
    builds new code. This cost an hour once.
  - The build runs `npm ci`, so `package.json` and `package-lock.json`
    must stay in sync or the site build fails. Always commit the lockfile
    with any dependency change.
- **Account deletion** is live end to end: `account_deletions` table,
  `purge_user_rows()`, the `delete-account` Edge Function, and a daily
  pg_cron job. **The purge path has never been run** - see next steps.

## Current App State (all built, on master)

### Core
- Recipe extraction from URLs (share intent Android/iOS, quick link) with loading overlay,
  30s timeout, clear failure alerts
- Recipe cards: hero image on top, formatted times ("30 min"), deduped servings ("12 people"),
  nutrition grid at bottom (scaled by recipe multiplier), version picker
- Preview (SaveRecipeScreen) and saved card share formatters via src/utils/recipeFormat.js
- Versions/variants: first content edit auto-snapshots "Original"; picker offers
  Original / My Edits / friends' shared versions (attributed "shared by @user")
- Custom recipe creation with photo (moderated), profanity-filtered fields
- Cook Mode: cross off ingredients/steps, hide-done toggle, fade-with-undo,
  screen stays awake
- AI recipe scanning (Gemini via `extract-recipe`), up to 5 recipes per scan,
  rate limited server-side (free 3 lifetime / premium 30 per month / admin unlimited)
- Photos can be added to custom and scanned recipes after creation

### Kitchen (bottom nav tab, 4 sub-tabs)
- **Cook** (premium): weekly cook plan, recipe picker w/ cookbook browse, batch multiplier
- **Eat** (premium): weekly meal slots. Add meal from Fridge, Cook a Recipe, or Take Out
- **Shop** (free): grocery list
- **Fridge** (premium): computed inventory, days-old warnings at 5+, Trash + Adjust
- Tables: cook_events, meal_events, fridge_adjustments
- Premium gating via user_profiles.is_premium (+premium_until); admins auto-premium

### Social
- Friends, requests, inbox (threaded), Discover placeholder
- Profiles: featured carousel, sample recipes, cookbooks + Uncategorized
- Public recipe read-only view, import, report
- Share recipes with edits -> attributed variant; recipient dedupe by URL
- Blocking (profile menu; Settings -> Privacy -> Blocked Users)
- Friend invite links via `buildFriendLink()` / `parseFriendLink()`

### Tags and dietary
- `src/utils/dietaryAnalysis.js` - keyword matching, no external service.
  Diet chips are **computed at render time, never stored**, so they cannot drift.
- `src/utils/autoTag.js` - high-confidence tags for global recipes, stored once.
  Reads the TITLE only (plus instructions for appliance tags). Savory dishes
  suppress Dessert, so shepherd's pie no longer reads as pudding.
- Frequently Used tags ranked by how often you SEARCH a tag, not how many
  recipes carry it. Counts sync to Supabase.

### Moderation & Safety
- Image moderation: Sightengine via `moderate-image` (incl. face detection)
- Text moderation: local wordlist then OpenAI omni-moderation via `moderate-text`
- Reports: modal w/ reason + details; rate-limited (10/hr, 24h dedupe)
- Admin: Settings -> Moderation Queue
- Discord webhook via `moderation-webhook` + pg trigger
- First-launch disclaimer modal - **now points at real, live documents**

### Design
- Theme: **Honey + Forest** - forest green #2D6A4F primary, honey #E9B44C accent,
  off-white bg. All in `src/constants/colors.js`.
- App icon: white M on forest green (YoungSerif), generated by
  `assets/generate-icons.py` along with the web favicon and OG card, so the
  launcher icon and website cannot drift apart. **Placeholder quality** -
  commission real artwork before launch.
- Ionicons throughout. No emoji in UI.

### Known fixes to remember
- Android modal scroll: KAV behavior must be undefined on Android
- Recipe deletion syncs BOTH recipes + user_recipes_v2 tables
- Custom recipes get their internal source URL minted at creation, not after
  the cloud write. Everything that asks "did the user make this?" keys off
  that URL, so minting it late made new recipes read as imported until reload.

## Immediate Next Steps

1. **Test the account purge.** Backdate `purge_after` on a throwaway
   account and fire the function. Deletion is the one feature where
   "probably works" is not good enough, and this path has never run.
   ```sql
   UPDATE account_deletions SET purge_after = now() - interval '1 day'
   WHERE user_id = 'TEST_USER_UUID';
   ```
2. **Store developer accounts** - $25 Play (one-off), $99/yr Apple. Register
   under `melibriapp@gmail.com`. This is also the decision point for whether
   to form the LLC first.
3. **Turn on Gemini billing** before real users scan. The free tier's terms
   allow Google to train on inputs.
4. **Test the feature backlog** - still unverified end to end: dietary
   filters and allergen warnings, share-as-image + QR, letter placeholders,
   Frequently Used tags, Cook Mode.
5. Phase 6: Subscriptions (needs the store accounts above).

## Known tech debt

- `BUNCHES_RECIPE:` / `BUNCHES_BKP_V2:` are still the wire format for shared
  codes and backups, including a user-visible placeholder in the import box.
  Fix the same way as `BACKUP_EXT`: write the new prefix, read both.
- `ios/BunchesV6/` is named for the old project. Nine hand-written native
  files are force-tracked there while `/ios` is gitignored. Prebuild now
  emits `ios/Melibri/`, so **rename this as step one of the iOS revival**,
  once you can see what prebuild actually produces.
- HomeScreen.js ~5.2k lines, RecipeDetail.js ~2.9k. Splitting is invasive;
  do it deliberately between features.
- Legacy `recipes` table is still dual-written alongside `user_recipes_v2`.
- 23 npm audit warnings, all in the React Native tree. **Do not run
  `npm audit fix --force`** - it will upgrade past what SDK 54 supports and
  break the build, exactly like the expo-keep-awake incident.

## iOS (dormant, intentionally preserved)

Needs a Mac or EAS. When reviving:
1. Rename `ios/BunchesV6/` to match what prebuild emits, and the bridging header with it.
2. Create an iOS OAuth client for bundle id `app.melibri`; put its client id in
   `src/services/supabase/auth.js` (IOS_CLIENT_ID) and both spots in `app.json`.
3. The share-extension app group is already correct (`group.app.melibri`) in
   both the plugin and the tracked native files.

## Build (Android, Daniel's PC - project on Y:)
```cmd
Y:
cd Y:\BunchesV6
git pull origin master
npm install
taskkill /F /IM java.exe
rmdir /s /q android
set CI=1
npx expo prebuild --clean --platform android
cd android
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot" && gradlew.bat assembleRelease
```
APK: `Y:\BunchesV6\android\app\build\outputs\apk\release\`

Uninstall first (`adb uninstall app.melibri`) whenever the icon changes -
Android caches launcher icons hard enough to survive an upgrade install.

## Accounts / Services
- Supabase project ref: `azdhiunzwslogbaiwtgi` (see SERVICES.md for the full map).
  The ref is permanent but contains no branding, so there is nothing to migrate.
- Google Cloud project 307694075211. **OAuth clients are bound to package name
  + SHA-1**, which is why sign-in broke on the rename. The Android client for
  `app.melibri` exists; the iOS one does not yet.
- Cloudflare: domain, DNS, email routing, and the site Worker.
- Test users: angrychef (admin), socci
- Edge functions: `moderate-image`, `moderate-text`, `moderation-webhook`,
  `extract-recipe`, `delete-account`. Verify JWT ON except the webhook.
- Secrets live in Supabase env vars, never in the repo.

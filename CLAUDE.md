# Recipe App - Claude Notes

Product name is **Melibri** (mel = honey, libri = books). Repo is still
named BunchesV6 for now. "Bunches" must NOT be used as the product name
(registered trademark, Class 45 social networking).

Identity lives in `src/constants/app.js` - name, scheme, domain, support
email, legal URLs, backup extension. A future rename is a one-file
change there, EXCEPT the bundle id / Android package in app.json, which
are permanent once published.

## Build (Android - Daniel's PC, project on Y:)

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

APK: `Y:\BunchesV6\android\app\build\outputs\apk\release\app-release.apk`

Notes:
- `npm install` matters whenever dependencies changed; `set CI=1` stops
  Expo prompting when the working tree is dirty.
- The build machine should never commit locally - that caused merge
  conflicts before. If the tree gets stuck:
  `git merge --abort && git reset --hard && git fetch origin <branch> && git checkout -B <branch> origin/<branch>`

## Working agreements

- **All work lives on `master`.** Session branches must be created FROM
  master and merged back when done.
- **Show SQL in chat**, never only in a file - Daniel runs it by hand in
  the Supabase dashboard.
- **Give the full build command block after every code change.**
- iOS is dormant but intentionally preserved (ios/ folder, app.json
  config, eas.json). Revive at launch prep; needs a Mac or EAS.

## Versioning

`app.json` is the single source of truth; `src/constants/app.js` reads
it via expo-constants, so never hardcode a version anywhere else.

- `version` ("0.9.0") - marketing version, shown in the stores. Bump for
  a release worth naming. **1.0.0 is reserved for the public launch.**
- `android.versionCode` (integer) and `ios.buildNumber` (string) - the
  upload counters. **Bump BOTH by 1 for every single upload to Play or
  App Store Connect**, even a re-upload of identical code. Neither store
  accepts a repeated value, and neither lets you go backwards.

Local test APKs that never reach a store do not need a bump.

## Adding dependencies

Use `npx expo install <pkg>`, NOT `npm install <pkg>`. Plain npm grabs
the latest version, which can be built for a newer Expo SDK than this
project (SDK 54) and will crash the app at startup - this already
happened once with expo-keep-awake. If the Expo API is unreachable, look
the correct version up in `node_modules/expo/bundledNativeModules.json`.

## Conventions

- **Icons**: Ionicons via `@expo/vector-icons` everywhere. No emoji in
  UI (native `Alert` text is plain too).
- **Colors**: everything from `src/constants/colors.js` (Honey + Forest
  theme). No hardcoded hex in components.
- **Logging**: `import { log } from '../utils/log'` for narration - it is
  a no-op in release builds. Use `console.error` for real failures.
- **Secrets**: never in the repo. API keys live in Supabase Edge Function
  secrets; the app calls the function.
- **App name**: `src/constants/app.js` (`APP_NAME`) - single-file swap
  when the name is finalized.

## Architecture quick map

- `src/screens/HomeScreen.js` - main container, tab switching, most
  modals (5k lines; splitting it is known tech debt)
- `src/components/RecipeDetail.js` - recipe view/edit, variants, photos
- `src/components/CookMode.js` - session cooking view (cross off
  ingredients/steps, hide-done toggle, screen stays awake)
- `src/services/supabase/` - database, social, kitchen, dietary, auth
- `src/utils/dietaryAnalysis.js` - derives diet tags + allergens from
  ingredients (keyword matching, no external service)
- `src/utils/autoTag.js` - high-confidence tags for new global recipes
- Edge Functions in `supabase/functions/` - moderate-image,
  moderate-text, moderation-webhook, extract-recipe (AI scanning)

### Data model
Recipes are stored twice on purpose:
- `global_recipes` - the shared, unchanging version (title, ingredients,
  auto-tags). Deep links and friend imports point here.
- `user_recipes_v2` - each user's own layer (their tags, folders, edits,
  favorites, notes).
The app displays the union. The legacy `recipes` table is still
dual-written.

## Naming (decided: Melibri)

Melibri came back clean on USPTO across all classes. melibri.com is
owned by an unrelated jewelry brand (Class 14) - we use melibri.app.
Avoid hummingbird imagery: that brand's logo is one, and our "libri"
means books, not colibri.

Ruled out: Bunches, HoneyBun, Hunii (phonetic risk vs PayPal's
Honey, plus VTuber SEO collision), Bunchbook, Bunchlist, Hearth (HEARTH
registered Class 9 for software), Mella (MELLA registered Class 9 for a
mobile app), Melora, Melva (Seinfeld "Mulva"), Meloco (VTuber collision).

Process that works: **Google first** - it kills candidates in seconds and
two died to VTubers - then USPTO for Classes **9, 42, 45**. If a name
contains a shorter word, search that root too (Nectary would have
inherited Nectar's conflicts).

Current shortlist: Melibri, Melibee, Melarca, Melcella, Melcori.
Plan is to use Indie Law for a real clearance opinion - ask specifically
for phonetic analysis against famous marks, not just a knockout search.

## See also

- `WHERE_WE_LEFT_OFF.md` - current state snapshot + immediate next steps
- `ROADMAP.md` - phases and what is built
- `SERVICES.md` - accounts, keys, Edge Function map
- `EDGE_FUNCTIONS_SETUP.md` - deploy steps for each Edge Function

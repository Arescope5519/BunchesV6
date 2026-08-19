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

## Release signing (Play uploads)

Expo signs release builds with the DEBUG keystore, which Play rejects.
`plugins/android-release-signing.js` re-applies a real signing config on
every prebuild (writing it into android/ by hand does not survive
`--clean`).

Credentials live in the user-level Gradle file, never in this repo -
`C:\Users\<you>\.gradle\gradle.properties`:

```properties
MELIBRI_UPLOAD_STORE_FILE=C:\\keys\\melibri-upload.keystore
MELIBRI_UPLOAD_STORE_PASSWORD=...
MELIBRI_UPLOAD_KEY_ALIAS=melibri
MELIBRI_UPLOAD_KEY_PASSWORD=...
```

Backslashes must be doubled. With those absent the build falls back to
debug signing, so a local test APK still builds on a machine without the
keystore.

- Play wants an **app bundle**: `gradlew.bat bundleRelease` ->
  `android\app\build\outputs\bundle\release\app-release.aab`.
  Keep `assembleRelease` for installing on your own device.
- **Play re-signs with its own key.** After the first upload, copy the
  SHA-1 from Play Console -> Setup -> App signing and add it as another
  Android OAuth client (package `app.melibri`), or Google Sign-In fails
  for every tester while working perfectly on your machine.
- Losing the upload keystore is recoverable through Google, but slow.
  Back it up somewhere that is not this repo.

## Google Sign-In DEVELOPER_ERROR - urgent fix playbook

DEVELOPER_ERROR (status 10) is thrown on-device by Play Services when
the running app's (package name + signing SHA-1) matches no Android
OAuth client in Cloud project `307694075211`. It is ALWAYS console
config, never app code - the app never references an Android client ID.

**Four keys sign this app**, and each needs its own Android OAuth client
(package `app.melibri`). "It worked earlier with no changes" almost
always means a different install (= different key) is now on the device:

| Key | Where it signs | Where to read its SHA-1 |
|---|---|---|
| Debug | `expo run:android` dev builds | signingReport, debug variant |
| Upload | sideloaded `assembleRelease` APKs | signingReport, release variant |
| Play app signing | every Play Store install | Play Console -> App signing (see below) |
| (rotated/previous) | old installs after a key rotation | "Previous app signing keys" on same page |

Debugging steps, in order - trust the device, not the console:

1. **Identify what is actually installed.** Play installs have
   `split_config.*.apk` files; sideloads are a single base.apk.
   `adb -s <device> shell pm path --user 0 app.melibri`
2. **Read the real signature off the installed APK:**
   `adb pull <base.apk path> installed.apk` then
   `build-tools\<ver>\apksigner.bat verify --print-certs installed.apk`
   (`keytool -printcert -jarfile` says "Not a signed jar file" on modern
   v2/v3-signed APKs - use apksigner.)
3. **Match that SHA-1 against the OAuth clients.** No match = the bug.
   Create a new Android client with that exact fingerprint. ADD clients,
   never edit existing ones - each install path needs its own.
4. Clear Google Play Services cache on the device, reboot, wait 5 min to
   a few hours for propagation.

Traps that burned real time:

- The Play Console App signing page shows the **upload** cert prominently;
  the app-signing cert may be behind Copy buttons (classical vs
  post-quantum: OAuth wants the **classical** key). Cross-check with the
  **Digital Asset Links JSON** on that page - its SHA-256 must equal
  apksigner's SHA-256 for the cert you think is live.
- **Key rotation silently breaks sign-in** (e.g. enrolling in the
  Quantum-ready beta rotated the app signing key on 13 Aug 2026). After
  any rotation, repeat this playbook - the OAuth client must follow the
  new key.
- Old pre-rename installs (`com.bunchesai.v6`) and Samsung Secure Folder
  copies look identical on the launcher. Check `pm list packages` for
  duplicates before debugging config.
- Do NOT debug sign-in on BlueStacks/emulators - nonstandard Play
  Services and missing Play Protect certification fail sign-in for
  reasons unrelated to config. Verify on a real phone's Play install:
  that is the exact tester path.

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

## Store declarations that go stale

Play Console holds declarations that were true when they were filled in
and quietly stop being true as the app changes. Google treats a stale
declaration as a compliance problem, not a paperwork one, so when a
change below lands, update the listing in the same sitting.

The Privacy Policy and Terms are part of this - they live in `site/` and
describe the app in detail, so they go wrong the same way.

| Change | What also has to change |
|---|---|
| Ship subscriptions / any IAP | In-app purchases declaration; content rating "purchase digital goods" -> Yes; Data safety (financial info); **the developer address becomes public on the listing**, which is the real deadline on forming the LLC |
| Add analytics, crash reporting or any tracking SDK | Data safety form; Privacy Policy "no analytics SDK" paragraph becomes FALSE; store listing short description says "no tracking" |
| Add an ad network | Ads declaration -> Yes ("Contains ads" label appears); same listing/policy copy as above |
| Collect location, contacts, or a new permission | Data safety; Privacy Policy "what we collect"; content rating location question |
| Add a new third-party service that receives user data | Privacy Policy processors table |
| Add chat or direct messages | Content rating UGC + chat moderation answers |
| Curate an Explore/Recommended shelf | Curated content is not user-generated, so the age-restriction answers stop being covered by the UGC exclusion. Alcohol content sits badly with the 13+ target audience - see the naming/rating notes |
| Change the account deletion window | Privacy Policy, Terms section 8, and the in-app copy in DisclaimerModal + SettingsScreen |
| Change the age floor | Target audience, content rating, Terms section 1 |
| **Anything nutritional** - see the section below | Health features declaration -> "Nutrition and weight management", which routes the app into Google's health policy review |

Content rating can be re-taken any time from the Content rating page.

### The health-features line (planned work sits right on it)

Play asks separately whether the app has health features. Today the
answer is **No**, and the reasoning is narrow enough to be worth writing
down, because the app is already closer to the line than it looks:

- `RecipeDetail` **displays** a nutrition panel (`recipeFormat.js`
  `NUTRIENT_KEYS` - calories, fat, carbs, protein...), but only passes
  through whatever the source recipe supplied. Nothing is computed.
- The Kitchen `Eat` tab **does log consumption** - `meal_events` records
  what was eaten and `servings_consumed`. That is real meal logging, but
  the servings are arithmetic against fridge inventory
  (`remaining = produced - consumed - adjustments`), for food waste. No
  nutrition is read, summed or shown anywhere in the Kitchen tab.

So: the app tracks *servings of food*, never *nutrition*. That
distinction is the entire basis of the "No" answer.

Ticking "Nutrition and weight management" is not free - it pulls the app
into Google's health policy review with its own requirements. But
declaring late is worse than declaring early. Any of these flips the
answer to Yes, and it should be flipped in the same sitting:

- Daily/weekly nutrition totals, or summing nutrition across meal events
- Calorie, macro, or weight goals and targets
- Nutrition-driven recommendations ("recipes under 500 calories")
- **Computing** nutrition from ingredients rather than passing through
  what the source gave us - that turns a quotation into a health claim
- Anything about body weight at all

Related: Data safety already declares **Health info** (the allergen
settings in `dietary_preferences`). That is a separate question - what
data is *collected* vs what the app *does* - so the two answers can
legitimately differ, and a reviewer seeing Health info declared is not
evidence the health-features answer is wrong.

Keep user-facing copy honest about this too. The Kitchen upsell used to
say "meal tracking", which oversells a leftovers ledger and reads to a
reviewer like diet tracking; it says "leftover tracking" now.

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

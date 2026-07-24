# Bunches V6 - Services & Dependencies

Master reference for every external service and internal module your app depends on. Use this to know what runs where, what breaks what, and what needs a disclaimer to users.

---

## External Services (Third-Party)

### 1. Supabase
**Purpose:** Backend database, auth, storage, RLS

**What it stores:**
- User profiles, usernames, friend connections
- Recipes (both `recipes` and `user_recipes_v2` tables)
- Custom recipe photos (Supabase Storage bucket `recipe-images`)
- Folder/cookbook definitions
- Featured recipes
- Moderation flags (`moderation_flags` table)

**Config:** `src/services/supabase/config.js`
**Credentials:** Supabase URL + anon public key (embedded in app)
**Cost:** Free tier available; scales with usage
**Docs:** https://supabase.com/docs

**Files that depend on it:**
- `src/services/supabase/auth.js` - sign in / sign out
- `src/services/supabase/database.js` - recipe CRUD, dual-write to old + V2 tables
- `src/services/supabase/social.js` - profiles, friends, sharing, featured recipes
- Every screen that reads/saves recipes

---

### 2. Google Sign-In (via @react-native-google-signin/google-signin)
**Purpose:** OAuth user authentication

**Config:** `app.json` (GIDClientID + URL scheme)
**Where used:** `src/services/supabase/auth.js`
**Cost:** Free
**Requires:** iOS URL scheme + Android manifest setup (handled by Expo plugin)

---

### 3. Sightengine (Image Moderation)
**Purpose:** Automatic NSFW/violence detection on recipe photos

**What it sees:** Every recipe photo before it uploads to Supabase Storage

**Access pattern:** App → Supabase Edge Function `moderate-image` → Sightengine
**App-side client:** `src/services/moderation.js`
**Edge function:** `supabase/functions/moderate-image/index.ts`
**Credentials:** API user + API secret in **Supabase env vars** (not in APK)
**Cost:** Free tier = 500 checks/month, then paid
**Docs:** https://sightengine.com/docs

**Categories checked:** Nudity, offensive, gore, weapons
**Threshold config:** `THRESHOLDS` object in the Edge Function's `index.ts`

**⚠️ DISCLAIMER NEEDED:** Users' photos are transmitted to Sightengine's servers for analysis.

---

### 4. OpenAI Moderation API (Text Moderation)
**Purpose:** Second-pass text profanity/harmful content detection

**What it sees:** Recipe titles, ingredients, instructions, cookbook names, usernames (only after they pass the local wordlist)

**Access pattern:** App → Supabase Edge Function `moderate-text` → OpenAI
**App-side client:** `src/services/openaiModeration.js`
**Edge function:** `supabase/functions/moderate-text/index.ts`
**Credentials:** OpenAI API key in **Supabase env vars** (not in APK)
**Cost:** **FREE** for the moderation endpoint (does NOT charge or train on data)
**Docs:** https://platform.openai.com/docs/guides/moderation

**Categories blocked:** hate, harassment, sexual, violence/graphic, self-harm, sexual/minors
**Rate limit:** 50 req/sec (effectively unlimited for this app)

**Data policy:** Per OpenAI's usage policy, Moderation API inputs are NOT used for training. Retained up to 30 days for abuse monitoring, then deleted.

**⚠️ DISCLAIMER NEEDED:** Users' text is transmitted to OpenAI's servers for analysis.

---

### 5. Expo (Framework)
**Purpose:** React Native build/dev tooling, native module wrappers

**Packages used:**
- `expo` - core runtime
- `expo-status-bar`, `expo-navigation-bar` - UI chrome
- `expo-image-picker` - camera + photo library
- `expo-document-picker` - file picking for imports
- `expo-file-system` (deprecated in SDK 54, being phased out)
- `expo-sharing` - share sheet

**Config:** `app.json` (plugins list)

---

### 6. Recipe Extraction Sources (websites)
**Purpose:** Extract recipe data from URLs shared to the app

**Where:** `src/services/recipe-extractor/` (or similar - implemented in-house)
**What it accesses:** Recipe websites via HTTP GET when user shares a URL
**Cost:** Free (no API - direct HTML parsing)

**⚠️ Note:** Some sites may block scraping; extraction relies on schema.org markup.

---

## Internal Services (In-App)

### 7. Content Moderation Pipeline
**Purpose:** Composed filter that combines local wordlist + OpenAI

**Flow:**
```
User submits text
   ↓
[Stage 1] Local wordlist check (profanityFilter.js)
   ↓ passes
[Stage 2] OpenAI Moderation API (openaiModeration.js)
   ↓ passes
Text is saved
```

**Files:**
- `src/services/profanityFilter.js` - local wordlist + two-stage combiner
- `src/services/openaiModeration.js` - OpenAI API wrapper
- `src/services/moderation.js` - Sightengine image moderation

**Called from:**
- `CreateRecipeScreen.handleSave` - recipe title/ingredients/instructions
- `SaveRecipeScreen.handleSave` - extracted recipes
- `social.setupUserProfile` / `social.changeUsername` - usernames
- `useFolders.addFolder` / `useFolders.renameFolder` - cookbook names

---

### 8. Recipe Sync Pipeline
**Purpose:** Keep local recipes in sync with Supabase, dual-write to old + V2 tables

**Flow:**
```
User saves recipe
   ↓
Local AsyncStorage (immediate)
   ↓
saveRecipeWithDualWrite
   ↓
[1] recipes table (old, primary)
[2] global_recipes (if URL exists, shared across users)
[3] user_recipes_v2 (new, references global_recipes)
```

**Files:**
- `src/hooks/useRecipes.js` - save/load orchestration
- `src/services/supabase/database.js` - actual writes
- `src/utils/storage.js` - AsyncStorage wrapper

---

### 9. Original-Recipe Sync (Imported Recipes)
**Purpose:** Keep "original" version of imported recipes fresh from owner

**Flow:**
```
User opens imported recipe
   ↓
useEffect [selectedRecipe.id]
   ↓
refreshOriginalFromOwner(recipeId)
   ↓
Fetches getFullPublicRecipe(ownerId, ownerRecipeId)
   ↓
Updates local originalRecipe field
```

**Files:**
- `src/screens/HomeScreen.js` - trigger on modal open
- `src/hooks/useRecipes.js` - refreshOriginalFromOwner
- `src/services/supabase/social.js` - getFullPublicRecipe

---

### 10. Share Intent Handling (Android)
**Purpose:** Receive URLs shared to app from browser/other apps

**Flow:**
```
User taps "Share to Bunches" in browser
   ↓
Android intent → MainActivity.onNewIntent
   ↓
Emit newShareIntent event via DeviceEventEmitter
   ↓
useShareIntent hook picks up event
   ↓
extractRecipe(url) → parse → SaveRecipeScreen
```

**Files:**
- `plugins/android-share-intent.js` - Manifest config plugin
- `plugins/android-on-new-intent.js` - MainActivity Kotlin injector
- `src/hooks/useShareIntent.js` - JS listener
- `src/screens/HomeScreen.js` - handler that triggers extraction

---

### 11. Share Extension (iOS)
**Purpose:** Same as above, but via iOS Share Extension + App Groups

**Files:**
- `plugins/ios-share-extension.js` - iOS config plugin
- iOS native module `AppGroupStorage` - passes shared data

---

## Data Flow: Where Users' Data Goes

### Photos
Camera/Library → ImagePicker → Sightengine (analysis) → Supabase Storage (recipe-images bucket)

### Recipe text
Input → Local wordlist → OpenAI Moderation → AsyncStorage → Supabase (recipes + user_recipes_v2 + global_recipes)

### Usernames
Input → Local wordlist → OpenAI Moderation → Supabase (user_profiles)

### Auth
Google Sign-In → Supabase Auth → session token stored in AsyncStorage

---

## Costs Summary (Current State)

| Service | Free Tier | When It Costs |
|---------|-----------|---------------|
| Supabase | 500MB DB, 1GB storage, 2GB bandwidth | Beyond free tier |
| Sightengine | 500 image checks/month | Beyond 500 checks |
| OpenAI Moderation | Unlimited (rate-limited) | Never (endpoint is free) |
| Google Sign-In | Free | Never |
| Recipe extraction | Free (direct scraping) | Never |

---

## Security Notes (Pre-Production Checklist)

- [x] Sightengine credentials moved to Supabase Edge Function ✅
- [x] OpenAI API key moved to Supabase Edge Function ✅
- [ ] Supabase anon key in APK - this is OK (it's designed for client-side use, RLS enforces security)
- [ ] User photos routed to Sightengine - needs disclaimer in ToS / Privacy Policy
- [ ] User text routed to OpenAI - needs disclaimer in ToS / Privacy Policy

## Disclaimer Text (Suggested)

Add to your Terms of Service / Privacy Policy:

> **Content Moderation**
>
> To keep the community safe, Bunches uses third-party services to analyze content you submit:
>
> - **Photos**: Recipe photos are analyzed by Sightengine to detect inappropriate content before being stored. Sightengine processes the image and does not retain it beyond the analysis.
>
> - **Text**: Recipe titles, ingredients, instructions, cookbook names, and usernames are analyzed by OpenAI's Moderation API to detect harmful content. Per OpenAI's policy, this data is not used to train AI models and is retained up to 30 days for abuse monitoring before deletion.
>
> By using Bunches, you agree to this content review process.

---

## Interconnection Diagram

```
                        ┌───────────────┐
                        │  React Native │
                        │   Expo App    │
                        └───────┬───────┘
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
       ▼                        ▼                        ▼
┌──────────┐            ┌──────────────┐        ┌──────────────┐
│  Google  │            │   Supabase   │        │  Moderation  │
│ Sign-In  │            │              │        │  Services    │
└──────────┘            │  ┌────────┐  │        │              │
                        │  │  Auth  │  │        │ ┌──────────┐ │
                        │  └────────┘  │        │ │Sightengine│ │
                        │  ┌────────┐  │        │ │  (photos) │ │
                        │  │   DB   │  │◄────┐  │ └──────────┘ │
                        │  └────────┘  │     │  │              │
                        │  ┌────────┐  │     │  │ ┌──────────┐ │
                        │  │Storage │  │◄─┐  │  │ │  OpenAI  │ │
                        │  └────────┘  │  │  │  │ │ (text)   │ │
                        └──────────────┘  │  │  │ └──────────┘ │
                                          │  │  └──────────────┘
                                          │  │
                                          │  │
                        User Photo ───────┘  │
                        User Text  ──────────┘
                        (via moderation gate)
```

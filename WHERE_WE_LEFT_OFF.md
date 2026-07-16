# Where We Left Off

## Current Branch
`claude/copy-broken-branch-qQg4U`

## Last Commit
`7c2bd18` - Show actual error message in sync warning alert

## Active Issue
Custom recipes not persisting after app uninstall/reinstall - cloud sync to Supabase was failing.

## Recent Fixes (last several commits)
1. **`5233690`** - Fix recipe cloud sync: save `recipe_data` and `folders` properly to both `recipes` and `user_recipes_v2` tables
2. **`ba177b0`** - Wait for Supabase sync to complete before returning success (was fire-and-forget)
3. **`7c2bd18`** - Show actual error message in sync warning alert

## Last Error Seen
> "could not find the selected_variant_id column of recipes in the schema cache"

## SQL Ran to Fix
```sql
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS recipe_data JSONB;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS selected_variant_id TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{"likes": 0, "saves": 0, "views": 0}';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS original_recipe JSONB;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS has_edits BOOLEAN DEFAULT false;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS viewing_original BOOLEAN DEFAULT false;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS edited_version JSONB;
```

## SQL That May Still Need Running

### RLS Policies for viewing other users' recipes
```sql
CREATE POLICY "View public profiles recipes"
ON recipes FOR SELECT
USING (
  user_id IN (
    SELECT user_id FROM user_profiles WHERE is_public = true
  )
);

CREATE POLICY "View public profiles user_recipes_v2"
ON user_recipes_v2 FOR SELECT
USING (
  user_id IN (
    SELECT user_id FROM user_profiles WHERE is_public = true
  )
);
```

### Storage bucket for recipe images (may already be done)
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload recipe images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view recipe images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'recipe-images');
```

## Next Steps to Test

1. **Pull latest changes**
   ```
   git pull origin claude/copy-broken-branch-qQg4U
   ```

2. **Rebuild** (Android build commands below)

3. **Test custom recipe persistence:**
   - Create a custom recipe
   - Check console logs for `🔄 Syncing recipe to Supabase` and `✅ Recipe synced to Supabase`
   - If you see a "Sync Warning" alert - the error message will now be shown, note what it says
   - Uninstall and reinstall app - custom recipe should still appear

4. **Test viewing other user's recipes:**
   - Look at another user's profile
   - Check that recipes appear under "Recipes" section and in "[Username]'s Recipes" -> Cookbooks
   - If empty, may need the RLS policies above

## Build Commands (Daniel's PC - Android)

```cmd
cd C:\Users\Daniel\BunchesV6
git pull origin claude/copy-broken-branch-qQg4U
git add -A && git commit -m "local" --allow-empty
taskkill /F /IM java.exe
rmdir /s /q android
rmdir /s /q node_modules
npm install
npx expo prebuild --clean --platform android
cd android
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot" && gradlew.bat assembleRelease
```

APK: `android\app\build\outputs\apk\release\app-release.apk`

## iOS Build Commands (when returning to iOS)

```bash
git pull origin claude/copy-broken-branch-qQg4U
npm install
npx expo prebuild --platform ios
cd ios && pod install && cd ..
```

Then open `ios/BunchesV6.xcworkspace` in Xcode.

## Feature Status

### Completed
- [x] "My Creations" system folder for custom recipes
- [x] Folder persistence to Supabase across reinstalls
- [x] Custom recipe photo upload (via ImagePicker base64 -> Supabase Storage)
- [x] Featured recipes swipeable carousel on user profiles
- [x] Auto-public profile when featuring a recipe
- [x] Sample recipes section (5 random) on user profiles
- [x] Cookbooks view with Uncategorized folder for recipes without a cookbook
- [x] Instruction input text color fix on Android

### Needs Testing (Blocked on Supabase)
- [ ] Custom recipe cloud sync (last known issue: schema cache errors)
- [ ] Custom recipe persistence after uninstall/reinstall
- [ ] Viewing other user's recipes (may need RLS policies)

## Files Most Recently Changed
- `src/hooks/useRecipes.js` - Sync-await for recipe saves
- `src/services/supabase/database.js` - `recipe_data` + `folders` in save payload
- `src/services/supabase/social.js` - Read `folders` column from V2 table
- `src/components/UserProfile.js` - Sample recipes + cookbooks layout
- `src/screens/CreateRecipeScreen.js` - Photo picker UI

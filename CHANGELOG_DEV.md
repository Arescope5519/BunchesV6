# Development Changelog

Base version: 0.0.2 (stable Android build)

## Changes

### Fix: Ingredient count showing "1" on preview screen (ANDROID ONLY)
- **Issue**: Ingredient count in preview stats always showed "1" regardless of actual count
- **Platform**: Android only - iOS works correctly
- **Root cause**: TBD - added debug box to diagnose
- **File**: `src/screens/SaveRecipeScreen.js`
- **Debug**: Pink debug box added to preview screen showing raw ingredient data
- **Status**: Investigating

### Fix: Enable Local Mode for Android users
- **Issue**: After reinstall, Android users stuck on sign-in screen (Google Sign-In not available)
- **File**: `App.js`
- **Fix**: Added `onSkipToLocalMode` prop to AuthScreen so users can use app without cloud sync
- **Status**: Complete

### Re-enable Google Sign-In on Android
- **File**: `src/services/supabase/auth.js`
- **Change**: Removed all Android-specific blocks that disabled Google Sign-In
- **Requires**: `google-services.json` in `android/app/` (already in build process)
- **Status**: Re-enabled - test pending

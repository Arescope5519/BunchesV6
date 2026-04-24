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

### Fix: Friend not showing for request sender after acceptance
- **Issue**: When user A sends friend request to user B, and B accepts, A doesn't see B in their friends list
- **Root cause**: SocialModal wasn't calling refreshSocialData when opened - relied on 10-second polling
- **Files**: `src/screens/HomeScreen.js`, `src/components/SocialModal.js`
- **Fix**: 
  - Pass `onRefresh` prop to SocialModal
  - Auto-refresh when modal opens (`useEffect` with visible dependency)
  - Added manual refresh button (↻) next to "Your Friends" header
- **Status**: Complete

### Fix: Google Sign-In package missing
- **Issue**: "Google Sign-In not available" - package wasn't in package.json
- **Files**: `package.json`, `app.json`
- **Fix**: Added `@react-native-google-signin/google-signin` to dependencies and plugins
- **Status**: Complete

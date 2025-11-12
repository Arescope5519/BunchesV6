# Android Build Fix - Quick Start

## The Problem
Your Android build is failing with errors like:
```
error: resource mipmap/ic_launcher not found
error: resource string/app_name not found
error: resource style/AppTheme not found
```

## Quick Fix (Recommended)

Run this command from the project root:

```powershell
.\fix-android-resources.ps1
```

This automated script will regenerate your Android directory with all required resources.

## What It Does

1. **Backs up** your current android directory (if exists)
2. **Cleans** Expo cache
3. **Regenerates** the android directory using `npx expo prebuild`
4. **Verifies** all resources are present

## Alternative: Manual Fix

If the automated fix doesn't work, see the detailed instructions in:
```
android-resources-manual-fix/README.md
```

## After Running the Fix

Test your build:
```powershell
cd android
.\gradlew clean
.\gradlew assembleRelease
```

## Why This Happened

- The `android/` directory is **auto-generated** by Expo (it's in `.gitignore`)
- It should be regenerated using `npx expo prebuild`
- Sometimes the generation becomes corrupted or incomplete
- Your `app.json` and `assets/` files are used to generate the resources

## Need Help?

1. Make sure you have the latest dependencies: `npm install`
2. Check Expo doctor: `npx expo-doctor`
3. Ensure your `assets/icon.png` exists and is a valid PNG file
4. Check your `app.json` has correct Android configuration

---

**Files Created:**
- `fix-android-resources.ps1` - Automated fix script
- `android-resources-manual-fix/` - Manual resource files (backup solution)

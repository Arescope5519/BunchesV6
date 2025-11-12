# Quick Fix for Android Build (Non-Expo)

Your Android build is missing resources because you're building natively (not using Expo).

## Simple Solution - Use Python Script

Run this Python script to generate all Android resources from your existing `assets/icon.png`:

```powershell
# Install Pillow if you don't have it
pip install Pillow

# Run the script
python generate-android-icons.py
```

This will:
- ✅ Generate all icon sizes (mipmap-mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- ✅ Create both square and round icons
- ✅ Copy XML resources (strings.xml, styles.xml, colors.xml)

Then build:
```powershell
cd android
.\gradlew clean
.\gradlew assembleRelease
```

## What This Fixes

The script converts your `assets/icon.png` into Android's required format:
- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48)
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72)
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96)
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144)
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192)
- Plus `ic_launcher_round.png` versions of each

And copies:
- `strings.xml` - App name
- `styles.xml` - App themes
- `colors.xml` - Theme colors
- `splashscreen.xml` - Splash screen drawable

## Alternative: Manual Copy

If you don't want to use Python, just:

1. Use https://icon.kitchen to generate icons from `assets/icon.png`
2. Download and extract to `android/app/src/main/res/`
3. Copy XML files manually from `android-resources-manual-fix/`

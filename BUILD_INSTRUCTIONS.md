# iOS Build Instructions for Bunches

## Prerequisites (One-Time Setup)

**On Mac:**
```bash
# 1. Install Xcode from App Store (if not already installed)
# 2. Open Xcode once to accept license

# 3. Install Xcode Command Line Tools
xcode-select --install

# 4. Install CocoaPods
sudo gem install cocoapods
```

**On iPhone:**
- Enable Developer Mode (Settings → Privacy & Security → Developer Mode)
- Connect via USB cable

---

## Building & Installing on iPhone

### First Time Build:

```bash
# 1. Navigate to project
cd ~/Documents/BunchesV6.02

# 2. Install dependencies
npm install

# 3. Build and run on connected iPhone
npx expo run:ios --device
```

**In Xcode (when it opens):**
1. Click "BunchesV6" project in left sidebar
2. Select "BunchesV6" under TARGETS
3. Go to "Signing & Capabilities" tab
4. Check ✅ "Automatically manage signing"
5. Select your Apple ID under "Team"
6. Press ▶️ Play button (or Cmd+R)

**On iPhone (first time only):**
1. Go to Settings → General → VPN & Device Management
2. Tap your Apple ID email
3. Tap "Trust [your email]"
4. Tap "Trust" in popup
5. Launch the app!

---

### Rebuilds (After First Build):

**Quick rebuild:**
```bash
cd ~/Documents/BunchesV6.02
npx expo run:ios --device
```

**Or open in Xcode directly:**
```bash
open ios/BunchesV6.xcworkspace
# Then press Play ▶️
```

---

## Starting the App

### Development Mode (with Metro bundler):

**Terminal 1 - Start Metro:**
```bash
cd ~/Documents/BunchesV6.02
npx expo start
```

**Then:** Launch app on iPhone (must be on same WiFi as Mac)

### Release Mode (standalone, no Metro needed):

```bash
cd ~/Documents/BunchesV6.02
rm -rf ios
npx expo run:ios --device --configuration Release
```

---

## Troubleshooting

### "unsanitizedScriptURL=null" Error:
- **Solution:** Start Metro bundler in a separate terminal:
  ```bash
  npx expo start
  ```
- Make sure iPhone and Mac are on same WiFi
- Relaunch the app

### "No devices found":
```bash
# List connected devices
xcrun devicectl list devices

# Reconnect USB cable
# Make sure you tapped "Trust This Computer" on iPhone
```

### "Code signing error":
- Make sure you selected your Team in Xcode
- Try changing bundle ID in `app.json` to something unique

### Build fails:
```bash
# Clean and rebuild
cd ~/Documents/BunchesV6.02
rm -rf ios android node_modules package-lock.json
npm install
npx expo run:ios --device
```

---

## Important Notes

- **Free Apple Account:** App expires after 7 days, rebuild to reset timer
- **Paid Account ($99/year):** No expiration
- **WiFi Required:** iPhone and Mac must be on same network for development builds
- **First build:** ~10 minutes
- **Rebuilds:** ~2 minutes

---

## iOS Share Functionality

### How to Share Recipe URLs to Bunches

**Current Method (URL Scheme):**

Since Bunches doesn't appear in Safari's share sheet yet, use this workaround:

1. **In Safari:** Copy the recipe URL
   - Tap and hold the URL bar
   - Select "Copy"

2. **Open Bunches app**
   - The app will automatically detect the copied URL
   - OR paste it into the URL input field

**Why Bunches Isn't in Safari's Share Sheet:**

The app currently uses URL schemes (`bunches://`) for deep linking, which allows:
- ✅ Opening Bunches via custom URLs
- ✅ Universal Links (applinks:bunches.app)
- ✅ URL detection via clipboard monitoring

However, to appear in Safari's share sheet, you would need:
- ❌ A separate Share Extension target (not yet implemented)
- ❌ Native iOS code (Swift/Objective-C) for the extension
- ❌ Additional configuration in Xcode

**Future Enhancement:**

To add "Share to Bunches" in Safari's share sheet:

1. Create a Share Extension target in Xcode
2. Add Share Extension code (ShareViewController.swift)
3. Configure App Groups for data sharing
4. Update the Share Extension's Info.plist with NSExtension config
5. Rebuild the app with the new extension target

For now, the copy-paste method works reliably on iOS!

---

## Quick Reference Commands

```bash
# Full clean rebuild
cd ~/Documents/BunchesV6.02
rm -rf ios android node_modules package-lock.json
npm install
npx expo run:ios --device

# Just rebuild
npx expo run:ios --device

# Start Metro bundler
npx expo start

# Release build (no Metro needed)
npx expo run:ios --device --configuration Release

# Open in Xcode
open ios/BunchesV6.xcworkspace
```

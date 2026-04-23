# Bunches V6 - Claude Notes

## Build Command (Daniel's PC)

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

---

## Current Task: Fix Broken Copy Functionality

### Problem
`Clipboard` was deprecated and removed from react-native core in newer versions. The app uses react-native 0.81.4 but imports `Clipboard` from 'react-native', which no longer works.

### Solution
1. Install `@react-native-clipboard/clipboard` package
2. Update imports in all files using Clipboard:
   - `src/screens/HomeScreen.js` (line 25, 1330-1349)
   - Any other files using Clipboard

### Files to Modify
- `package.json` - add dependency
- `src/screens/HomeScreen.js` - update Clipboard import

### Changes Made
- [x] Install expo-clipboard (better for Expo projects)
- [x] Update HomeScreen.js imports (use expo-clipboard)
- [x] Update API call (setString -> setStringAsync)
- [x] Verified no other files need updating

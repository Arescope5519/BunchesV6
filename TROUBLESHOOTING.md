# Bunches V6 - Troubleshooting Log

## Android Crashes on Launch (April 2026)

### Issue 1: AsyncStorage crash
- **Symptom**: App crashes immediately on Android launch
- **Cause**: AsyncStorage 2.2.0 incompatible with RN 0.81 + old architecture
- **Fix**: Pin to `"@react-native-async-storage/async-storage": "1.23.1"`

### Issue 2: expo-clipboard crash  
- **Symptom**: App crashes on Android before any UI shows
- **Cause**: expo-clipboard 6.0.3 native module crashes on Android with RN 0.81
- **Fix**: Replace with `@react-native-clipboard/clipboard`
- **Code change**: `Clipboard.setStringAsync()` → `Clipboard.setString()`

### Issue 3: New Architecture
- **Symptom**: Various native module crashes
- **Fix**: Set `"newArchEnabled": false` in app.json

## Required Versions (Android)
```json
"@react-native-async-storage/async-storage": "1.23.1",
"@react-native-clipboard/clipboard": "^1.14.1"
```

## Build Notes

### Android (Windows)
- Must copy `google-services.json` to `android/app/` after each prebuild
- Kill Java before rebuilding: `taskkill /F /IM java.exe`
- Google Sign-In shows "Coming Soon" on Android (needs proper setup)

### iOS (Mac)
- Share Extension requires manual Xcode setup after prebuild
- Google Sign-In works via Supabase + native SDK

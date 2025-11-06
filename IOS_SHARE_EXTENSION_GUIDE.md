# iOS Share Extension Implementation Guide

## Overview

This guide explains how to implement a proper iOS Share Extension for Bunches, which will allow the app to appear in Safari's share sheet and other apps when sharing URLs.

## Current Status

**What Works:**
- ✅ URL schemes (`bunches://`) for deep linking
- ✅ Universal Links via Associated Domains
- ✅ URL detection when app is opened
- ✅ Copy-paste workflow from Safari

**What Doesn't Work Yet:**
- ❌ "Share to Bunches" option in Safari's share sheet
- ❌ Sharing directly from other apps to Bunches

**Why:** The app needs a separate Share Extension target with native iOS code.

## Architecture Explanation

### Current Implementation

The app uses `react-native-receive-sharing-intent` library which works by:
1. **URL Schemes**: Allows other apps to open Bunches via `bunches://`
2. **Universal Links**: Allows web links to open Bunches directly
3. **Clipboard Monitoring**: Can detect copied URLs when app launches

### What's Needed for Share Sheet

To appear in Safari's share sheet, iOS requires:
1. **A Share Extension** - A separate app extension (like a mini-app)
2. **Native iOS Code** - Swift or Objective-C code for the extension
3. **App Groups** - For data sharing between main app and extension
4. **Proper Configuration** - Info.plist, entitlements, and build settings

## Implementation Steps

### Step 1: Create Share Extension in Xcode

After running `npx expo run:ios --device`, open the generated Xcode project:

```bash
open ios/BunchesV6.xcworkspace
```

In Xcode:
1. File → New → Target
2. Choose "Share Extension"
3. Product Name: "BunchesShareExtension"
4. Language: Swift
5. Click "Finish"
6. When prompted "Activate scheme?", click "Cancel"

### Step 2: Configure Share Extension Info.plist

The Share Extension will have its own Info.plist. Add:

```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionAttributes</key>
    <dict>
        <key>NSExtensionActivationRule</key>
        <dict>
            <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
            <integer>1</integer>
            <key>NSExtensionActivationSupportsText</key>
            <true/>
        </dict>
    </dict>
    <key>NSExtensionMainStoryboard</key>
    <string>MainInterface</string>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.share-services</string>
</dict>
```

### Step 3: Add App Groups

Both the main app and Share Extension need to share data via App Groups.

**Main App Entitlements** (already configured):
```xml
<key>com.apple.security.application-groups</key>
<array>
    <string>group.com.bunchesai.v6</string>
</array>
```

**Share Extension Entitlements** (add new file):
1. File → New → File → Property List
2. Name it "BunchesShareExtension.entitlements"
3. Add the same App Groups configuration

### Step 4: Implement ShareViewController.swift

Replace the default ShareViewController.swift with:

```swift
import UIKit
import Social
import MobileCoreServices

class ShareViewController: SLComposeServiceViewController {

    override func isContentValid() -> Bool {
        return true
    }

    override func didSelectPost() {
        if let item = extensionContext?.inputItems.first as? NSExtensionItem {
            if let attachments = item.attachments {
                for attachment in attachments {
                    // Check for URL
                    if attachment.hasItemConformingToTypeIdentifier(kUTTypeURL as String) {
                        attachment.loadItem(forTypeIdentifier: kUTTypeURL as String, options: nil) { (data, error) in
                            if let url = data as? URL {
                                self.saveSharedURL(url.absoluteString)
                            }
                        }
                    }
                    // Check for text (which might contain URL)
                    else if attachment.hasItemConformingToTypeIdentifier(kUTTypeText as String) {
                        attachment.loadItem(forTypeIdentifier: kUTTypeText as String, options: nil) { (data, error) in
                            if let text = data as? String {
                                self.saveSharedURL(text)
                            }
                        }
                    }
                }
            }
        }

        // Close the share extension
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    override func configurationItems() -> [Any]! {
        return []
    }

    private func saveSharedURL(_ url: String) {
        // Save to App Group shared storage
        if let userDefaults = UserDefaults(suiteName: "group.com.bunchesai.v6") {
            userDefaults.set(url, forKey: "sharedURL")
            userDefaults.set(Date(), forKey: "sharedURLTimestamp")
            userDefaults.synchronize()

            // Open main app with custom URL scheme
            let appURL = URL(string: "bunches://share?url=\(url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")")!
            _ = self.openURL(appURL)
        }
    }

    // Helper to open main app from extension
    @objc func openURL(_ url: URL) -> Bool {
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                return application.perform(#selector(openURL(_:)), with: url) != nil
            }
            responder = responder?.next
        }
        return false
    }
}
```

### Step 5: Update Main App to Handle Shared URLs

Modify `src/hooks/useShareIntent.js` to check App Group storage:

```javascript
// Add to useEffect in useShareIntent
useEffect(() => {
  // Check for shared URL from Share Extension (iOS only)
  if (Platform.OS === 'ios') {
    const checkSharedURL = async () => {
      try {
        // This would require a native module to read from App Groups
        // For now, the react-native-receive-sharing-intent library handles this
      } catch (error) {
        console.log('Could not check shared URL:', error);
      }
    };
    checkSharedURL();
  }

  // Rest of existing code...
}, []);
```

### Step 6: Build and Test

1. **Rebuild the app:**
   ```bash
   npx expo run:ios --device
   ```

2. **Test the Share Extension:**
   - Open Safari on your iPhone
   - Navigate to a recipe URL
   - Tap the Share button
   - Look for "Bunches" in the share sheet
   - Tap it to share the URL to Bunches

## Alternative: Using Expo Config Plugin

For a more automated approach, you could create an Expo config plugin that:
1. Creates the Share Extension target
2. Adds necessary files and configuration
3. Configures build settings automatically

However, this requires significant native iOS knowledge and maintenance.

## Limitations

- **Expo Managed Workflow**: Share Extensions require native code, so you must use the Expo bare workflow or `expo run:ios` (which you're already doing)
- **Apple Developer Account**: Requires signing with a valid Apple Developer account
- **Maintenance**: Native code requires updates for new iOS versions
- **Complexity**: More moving parts means more potential for bugs

## Recommended Approach

For now, the **copy-paste workflow is simpler and more reliable**:
1. Users copy recipe URLs in Safari
2. Open Bunches app
3. URL is automatically detected and processed

This avoids the complexity of maintaining native iOS code while providing good UX.

If you need the Share Extension in the future, follow this guide or consider hiring an iOS developer to implement it properly.

## Resources

- [Apple Share Extension Documentation](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html)
- [App Groups Documentation](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_application-groups)
- [react-native-receive-sharing-intent](https://github.com/ajith-ab/react-native-receive-sharing-intent)

## Current Configuration Files

The following files have been configured for future Share Extension support:

- `plugins/ios-share-extension.js` - Expo config plugin for URL schemes and entitlements
- `app.json` - Contains iOS configuration including URL schemes and associated domains
- `src/hooks/useShareIntent.js` - Handles received shared URLs (iOS & Android)
- This document - Implementation guide for Share Extension

All the groundwork is in place - you just need to add the native Share Extension target when ready!

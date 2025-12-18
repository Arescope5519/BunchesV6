const {
  withInfoPlist,
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHARE_EXTENSION_NAME = 'ShareExtension';
const APP_GROUP_ID = 'group.com.bunchesai.v6';

/**
 * Creates the ShareViewController.swift file content
 */
function getShareViewControllerContent(bundleId, appGroupId) {
  return `import UIKit
import Social
import UniformTypeIdentifiers

class ShareViewController: SLComposeServiceViewController {

    private let appGroupId = "${appGroupId}"
    private let sharedURLsKey = "sharedURLs"

    override func viewDidLoad() {
        super.viewDidLoad()
        self.placeholder = "Save to Bunches"
    }

    override func isContentValid() -> Bool {
        return true
    }

    override func didSelectPost() {
        handleSharedItems()
    }

    private func handleSharedItems() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            completeRequest()
            return
        }

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        DispatchQueue.main.async {
                            if let url = data as? URL {
                                self?.addURLToQueue(url.absoluteString)
                            }
                            self?.completeRequest()
                        }
                    }
                    return
                }
            }
        }
        completeRequest()
    }

    private func addURLToQueue(_ urlString: String) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            print("Failed to get UserDefaults for app group")
            return
        }

        // Get existing URLs array or create new one
        var urls = userDefaults.stringArray(forKey: sharedURLsKey) ?? []

        // Add new URL if not already in queue
        if !urls.contains(urlString) {
            urls.append(urlString)
            userDefaults.set(urls, forKey: sharedURLsKey)
            userDefaults.synchronize()
            print("Added URL to queue: \\(urlString). Queue size: \\(urls.count)")
        }
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    override func configurationItems() -> [Any]! {
        return []
    }
}
`;
}

/**
 * Creates the Share Extension Info.plist content
 */
function getExtensionInfoPlist(bundleId, bundleDisplayName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>${bundleDisplayName}</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>${bundleId}.${SHARE_EXTENSION_NAME}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionAttributes</key>
        <dict>
            <key>NSExtensionActivationRule</key>
            <dict>
                <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
                <integer>1</integer>
                <key>NSExtensionActivationSupportsWebPageWithMaxCount</key>
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
</dict>
</plist>`;
}

/**
 * Creates the Share Extension entitlements content
 */
function getExtensionEntitlements(appGroupId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${appGroupId}</string>
    </array>
</dict>
</plist>`;
}

/**
 * Creates the MainInterface.storyboard content
 */
function getMainInterfaceStoryboard() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="13122.16" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="j1y-V4-xli">
    <dependencies>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="13104.12"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="ceB-am-kn3">
            <objects>
                <viewController id="j1y-V4-xli" customClass="ShareViewController" customModuleProvider="target" sceneMemberID="viewController">
                    <view key="view" opaque="NO" contentMode="scaleToFill" id="wbc-yd-nQP">
                        <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <viewLayoutGuide key="safeArea" id="1Xd-am-t49"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="CEy-Cv-SGf" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
        </scene>
    </scenes>
</document>`;
}

/**
 * Creates the AppGroupStorage.swift native module content
 */
function getAppGroupStorageSwift(appGroupId) {
  return `import Foundation
import React

@objc(AppGroupStorage)
class AppGroupStorage: NSObject {
  private let appGroupId = "${appGroupId}"
  private let sharedURLsKey = "sharedURLs"
  // Keep legacy key for backwards compatibility
  private let legacySharedURLKey = "sharedURL"

  @objc
  func getSharedURL(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      resolve(NSNull())
      return
    }
    // Check legacy single URL first (backwards compatibility)
    if let legacyURL = userDefaults.string(forKey: legacySharedURLKey) {
      resolve(legacyURL)
      return
    }
    // Check new array format - return first URL
    if let urls = userDefaults.stringArray(forKey: sharedURLsKey), let firstURL = urls.first {
      resolve(firstURL)
      return
    }
    resolve(NSNull())
  }

  @objc
  func getSharedURLs(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      resolve([])
      return
    }
    var allURLs: [String] = []
    // Check legacy single URL first
    if let legacyURL = userDefaults.string(forKey: legacySharedURLKey) {
      allURLs.append(legacyURL)
    }
    // Add URLs from array
    if let urls = userDefaults.stringArray(forKey: sharedURLsKey) {
      allURLs.append(contentsOf: urls)
    }
    resolve(allURLs)
  }

  @objc
  func clearSharedURL(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      resolve(false)
      return
    }
    userDefaults.removeObject(forKey: legacySharedURLKey)
    userDefaults.removeObject(forKey: sharedURLsKey)
    userDefaults.synchronize()
    resolve(true)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
`;
}

/**
 * Creates the AppGroupStorage.m bridge file content
 */
function getAppGroupStorageObjC() {
  return `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppGroupStorage, NSObject)

RCT_EXTERN_METHOD(getSharedURL:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getSharedURLs:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearSharedURL:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
`;
}

/**
 * Plugin to create Share Extension files and AppGroupStorage native module
 */
const withShareExtensionFiles = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName || 'BunchesV6';

      const extensionPath = path.join(platformProjectRoot, SHARE_EXTENSION_NAME);
      const mainAppPath = path.join(platformProjectRoot, projectName);

      // Create extension directory
      if (!fs.existsSync(extensionPath)) {
        fs.mkdirSync(extensionPath, { recursive: true });
      }

      // Write ShareViewController.swift
      const bundleId = config.ios?.bundleIdentifier || 'com.bunchesai.v6';
      const bundleDisplayName = config.name || 'Bunches';

      fs.writeFileSync(
        path.join(extensionPath, 'ShareViewController.swift'),
        getShareViewControllerContent(bundleId, APP_GROUP_ID)
      );

      // Write Info.plist
      fs.writeFileSync(
        path.join(extensionPath, 'Info.plist'),
        getExtensionInfoPlist(bundleId, bundleDisplayName)
      );

      // Write entitlements
      fs.writeFileSync(
        path.join(extensionPath, `${SHARE_EXTENSION_NAME}.entitlements`),
        getExtensionEntitlements(APP_GROUP_ID)
      );

      // Write MainInterface.storyboard
      fs.writeFileSync(
        path.join(extensionPath, 'MainInterface.storyboard'),
        getMainInterfaceStoryboard()
      );

      // Create AppGroupStorage native module files in main app
      console.log('Creating AppGroupStorage native module files...');

      // Ensure main app directory exists
      if (!fs.existsSync(mainAppPath)) {
        fs.mkdirSync(mainAppPath, { recursive: true });
      }

      // Write AppGroupStorage.swift
      fs.writeFileSync(
        path.join(mainAppPath, 'AppGroupStorage.swift'),
        getAppGroupStorageSwift(APP_GROUP_ID)
      );

      // Write AppGroupStorage.m
      fs.writeFileSync(
        path.join(mainAppPath, 'AppGroupStorage.m'),
        getAppGroupStorageObjC()
      );

      console.log('AppGroupStorage files created successfully');

      return config;
    },
  ]);
};

/**
 * Helper function to find a PBX group key by name
 */
function findPBXGroupKeyByName(xcodeProject, groupName) {
  const groups = xcodeProject.hash.project.objects['PBXGroup'];
  for (const key in groups) {
    // Skip comment entries (they end with _comment)
    if (key.endsWith('_comment')) continue;
    const group = groups[key];
    if (group && group.name === groupName) {
      return key;
    }
    // Also check path for groups that use path instead of name
    if (group && group.path === groupName) {
      return key;
    }
  }
  return null;
}

/**
 * Plugin to add Share Extension target and AppGroupStorage to Xcode project
 */
const withShareExtensionTarget = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const bundleId = config.ios?.bundleIdentifier || 'com.bunchesai.v6';
    const projectName = config.modRequest.projectName || 'BunchesV6';
    const targetName = SHARE_EXTENSION_NAME;

    // Add AppGroupStorage files to main app target
    console.log('Adding AppGroupStorage files to Xcode project...');

    // Find the main app group key (not the object)
    const mainAppGroupKey = findPBXGroupKeyByName(xcodeProject, projectName);

    if (mainAppGroupKey) {
      const mainTarget = xcodeProject.getFirstTarget();

      // Add AppGroupStorage.swift to main target
      xcodeProject.addSourceFile(
        `${projectName}/AppGroupStorage.swift`,
        { target: mainTarget.uuid },
        mainAppGroupKey
      );

      // Add AppGroupStorage.m to main target
      xcodeProject.addSourceFile(
        `${projectName}/AppGroupStorage.m`,
        { target: mainTarget.uuid },
        mainAppGroupKey
      );

      console.log('AppGroupStorage files added to Xcode project');
    } else {
      console.log('Warning: Could not find main app group, AppGroupStorage files may need to be added manually');
    }

    // NOTE: Share Extension target must be added manually in Xcode
    // The extension files are created in ios/ShareExtension/ by withShareExtensionFiles
    // To add the target in Xcode:
    // 1. Open the .xcworkspace file
    // 2. File > New > Target > Share Extension
    // 3. Use the existing files in ShareExtension folder
    // 4. Set App Group to group.com.bunchesai.v6
    console.log('Share Extension files created in ios/ShareExtension/');
    console.log('To enable: Add Share Extension target manually in Xcode');

    return config;
  });
};

/**
 * Main plugin - iOS Share Extension Configuration
 */
const withIOSShareExtension = (config) => {
  // Add URL scheme configuration to Info.plist
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    // Add URL schemes for deep linking
    if (!infoPlist.CFBundleURLTypes) {
      infoPlist.CFBundleURLTypes = [];
    }

    // Ensure our share URL scheme is present
    const shareScheme = {
      CFBundleURLName: 'com.bunchesai.v6.share',
      CFBundleURLSchemes: ['bunches'],
    };

    const existingScheme = infoPlist.CFBundleURLTypes.find(
      (type) => type.CFBundleURLSchemes?.includes('bunches')
    );

    if (!existingScheme) {
      infoPlist.CFBundleURLTypes.push(shareScheme);
    }

    return config;
  });

  // NOTE: App Groups entitlement requires paid Apple Developer account
  // Commenting out for personal development team compatibility
  // config = withEntitlementsPlist(config, (config) => {
  //   const entitlements = config.modResults;
  //   if (!entitlements['com.apple.security.application-groups']) {
  //     entitlements['com.apple.security.application-groups'] = [APP_GROUP_ID];
  //   }
  //   return config;
  // });

  // Create Share Extension files
  config = withShareExtensionFiles(config);

  // Add Share Extension target to Xcode project
  config = withShareExtensionTarget(config);

  return config;
};

module.exports = withIOSShareExtension;

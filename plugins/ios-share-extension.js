const {
  withInfoPlist,
  withEntitlementsPlist,
  withXcodeProject,
  withDangerousMod,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHARE_EXTENSION_NAME = 'ShareExtension';
const APP_GROUP_ID = 'group.app.melibri';

/**
 * Creates the ShareViewController.swift file content
 */
function getShareViewControllerContent(bundleId, appGroupId) {
  return `import UIKit
import MobileCoreServices
import UniformTypeIdentifiers

// Fire-and-forget share sheet: the share is handed to the app's queue
// immediately and this UI only reports that handoff - a green check
// ("Sent to Melibri") or a red X when the share carried no link. The
// APP does the real import (and the save/duplicate decisions) on next
// open, so a preview and Save/Cancel step here only added confusion
// when sites could not be previewed.
class ShareViewController: UIViewController {

    private let cardView = UIView()
    private let iconView = UIImageView()
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let appGroupIdentifier = "${appGroupId}"

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        extractAndStore()
    }

    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.35)

        cardView.backgroundColor = UIColor.systemBackground
        cardView.layer.cornerRadius = 16
        cardView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cardView)

        iconView.contentMode = .scaleAspectFit
        iconView.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(iconView)

        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        cardView.addSubview(spinner)

        statusLabel.font = .boldSystemFont(ofSize: 17)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.text = "Sending to Melibri..."
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            cardView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            cardView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            cardView.widthAnchor.constraint(equalToConstant: 250),
            cardView.heightAnchor.constraint(equalToConstant: 160),

            iconView.centerXAnchor.constraint(equalTo: cardView.centerXAnchor),
            iconView.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 26),
            iconView.widthAnchor.constraint(equalToConstant: 50),
            iconView.heightAnchor.constraint(equalToConstant: 50),

            spinner.centerXAnchor.constraint(equalTo: iconView.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: iconView.centerYAnchor),

            statusLabel.topAnchor.constraint(equalTo: iconView.bottomAnchor, constant: 12),
            statusLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -16),
        ])
    }

    private func extractAndStore() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showResult(ok: false)
            return
        }
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, _) in
                        DispatchQueue.main.async {
                            if let url = data as? URL {
                                self?.store(url: url.absoluteString)
                            } else {
                                self?.showResult(ok: false)
                            }
                        }
                    }
                    return
                }
            }
        }
        showResult(ok: false)
    }

    private func store(url: String) {
        guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
            showResult(ok: false)
            return
        }
        var queue = userDefaults.array(forKey: "pendingRecipes") as? [[String: Any]] ?? []
        queue.append([
            "id": UUID().uuidString,
            "url": url,
            "created_at": ISO8601DateFormatter().string(from: Date()),
            "needs_parsing": true,
        ])
        userDefaults.set(queue, forKey: "pendingRecipes")
        showResult(ok: true)
    }

    private func showResult(ok: Bool) {
        spinner.stopAnimating()
        iconView.image = UIImage(systemName: ok ? "checkmark.circle.fill" : "xmark.circle.fill")
        iconView.tintColor = ok
            ? UIColor(red: 0.18, green: 0.42, blue: 0.31, alpha: 1.0)
            : UIColor(red: 0.75, green: 0.22, blue: 0.17, alpha: 1.0)
        statusLabel.text = ok
            ? "Sent to Melibri"
            : "Nothing to send - no link in this share"
        DispatchQueue.main.asyncAfter(deadline: .now() + (ok ? 1.0 : 1.7)) {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
}
`;
}

/**
 * Creates the Share Extension Info.plist content - NO storyboard, pure code UI
 */
function getExtensionInfoPlist(bundleId, bundleDisplayName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>Save to Melibri</string>
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
    <string>$(MARKETING_VERSION)</string>
    <key>CFBundleVersion</key>
    <string>$(CURRENT_PROJECT_VERSION)</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionAttributes</key>
        <dict>
            <key>NSExtensionActivationRule</key>
            <dict>
                <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
                <integer>1</integer>
            </dict>
        </dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.share-services</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
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
 * Creates the PendingRecipesModule.swift native module content
 */
function getPendingRecipesSwift(appGroupId) {
  return `import Foundation
import React

@objc(PendingRecipesModule)
class PendingRecipesModule: NSObject {
  private let appGroupId = "${appGroupId}"
  private let pendingRecipesKey = "pendingRecipes"

  @objc
  func getPendingRecipes(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      resolve("[]")
      return
    }

    if let recipes = userDefaults.array(forKey: pendingRecipesKey) {
      do {
        let jsonData = try JSONSerialization.data(withJSONObject: recipes)
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "[]"
        resolve(jsonString)
      } catch {
        resolve("[]")
      }
    } else {
      resolve("[]")
    }
  }

  @objc
  func clearPendingRecipes(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      resolve(false)
      return
    }
    userDefaults.removeObject(forKey: pendingRecipesKey)
    userDefaults.synchronize()
    resolve(true)
  }

  @objc
  func removePendingRecipe(_ recipeId: String, resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      resolve(false)
      return
    }

    if var recipes = userDefaults.array(forKey: pendingRecipesKey) as? [[String: Any]] {
      recipes.removeAll { ($0["id"] as? String) == recipeId }
      userDefaults.set(recipes, forKey: pendingRecipesKey)
      userDefaults.synchronize()
    }
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
 * Creates the PendingRecipesModule.m bridge file content
 */
function getPendingRecipesObjC() {
  return `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PendingRecipesModule, NSObject)

RCT_EXTERN_METHOD(getPendingRecipes:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPendingRecipes:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(removePendingRecipe:(NSString *)recipeId
                  resolve:(RCTPromiseResolveBlock)resolve
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
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const bundleId = config.ios?.bundleIdentifier || 'app.melibri';
      const bundleDisplayName = config.name || 'Melibri';
      const projectName = config.modRequest.projectName || 'Melibri';

      const extensionPath = path.join(platformProjectRoot, SHARE_EXTENSION_NAME);
      const mainAppPath = path.join(platformProjectRoot, projectName);

      // Create extension directory
      if (!fs.existsSync(extensionPath)) {
        fs.mkdirSync(extensionPath, { recursive: true });
      }

      // Write ShareViewController.swift
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

      // NOTE: No storyboard - using pure programmatic UI via NSExtensionPrincipalClass

      // Create AppGroupStorage native module files in main app
      console.log('Creating AppGroupStorage native module files...');

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

      // Write PendingRecipesModule.swift
      fs.writeFileSync(
        path.join(mainAppPath, 'PendingRecipesModule.swift'),
        getPendingRecipesSwift(APP_GROUP_ID)
      );

      // Write PendingRecipesModule.m
      fs.writeFileSync(
        path.join(mainAppPath, 'PendingRecipesModule.m'),
        getPendingRecipesObjC()
      );

      // Write main app entitlements file with App Groups
      // This is CRITICAL - without this, the main app cannot read from shared UserDefaults
      const mainAppEntitlementsPath = path.join(mainAppPath, `${projectName}.entitlements`);
      console.log('Creating main app entitlements at:', mainAppEntitlementsPath);
      fs.writeFileSync(
        mainAppEntitlementsPath,
        getExtensionEntitlements(APP_GROUP_ID)
      );

      console.log('Native module files and entitlements created successfully');

      return config;
    },
  ]);
};

/**
 * Plugin to add the Share Extension target to the Xcode project.
 *
 * This is the step that used to be done by hand in Xcode ("File > New >
 * Target > Share Extension") - which meant every EAS cloud build
 * silently shipped WITHOUT the extension, because nobody was there to
 * click. It now happens programmatically on every prebuild:
 *
 *   1. ShareExtension target (app_extension) with its Swift file,
 *      Info.plist and entitlements; node-xcode's addTarget also embeds
 *      the .appex into the main app and wires the target dependency
 *   2. The main app's native modules (AppGroupStorage,
 *      PendingRecipesModule) added to the MAIN target's Sources phase -
 *      also previously a manual Xcode step
 */
const EXTENSION_SOURCE = 'ShareViewController.swift';
const MAIN_APP_MODULE_FILES = [
  'AppGroupStorage.swift',
  'AppGroupStorage.m',
  'PendingRecipesModule.swift',
  'PendingRecipesModule.m',
];

const withShareExtensionTarget = (config) => {
  return withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const projectName = config.modRequest.projectName;
    const mainBundleId = config.ios?.bundleIdentifier || 'app.melibri';
    const extBundleId = `${mainBundleId}.${SHARE_EXTENSION_NAME}`;
    const appVersion = config.version || '1.0.0';
    const buildNumber = config.ios?.buildNumber || '1';

    // Idempotency: prebuild can run mods more than once
    if (proj.pbxTargetByName(SHARE_EXTENSION_NAME)) {
      console.log('ShareExtension target already present - skipping');
      return config;
    }

    // --- 1. File group for the extension sources ---
    const extGroup = proj.addPbxGroup(
      [EXTENSION_SOURCE, 'Info.plist', `${SHARE_EXTENSION_NAME}.entitlements`],
      SHARE_EXTENSION_NAME,
      SHARE_EXTENSION_NAME
    );

    // Attach the new group to the project's root group (the one with
    // neither name nor path)
    const groups = proj.hash.project.objects['PBXGroup'];
    Object.keys(groups).forEach((key) => {
      if (
        !key.endsWith('_comment') &&
        groups[key].name === undefined &&
        groups[key].path === undefined
      ) {
        proj.addToPbxGroup(extGroup.uuid, key);
      }
    });

    // node-xcode quirk: addTarget crashes when these sections are
    // missing from a freshly generated project
    const objects = proj.hash.project.objects;
    objects['PBXTargetDependency'] = objects['PBXTargetDependency'] || {};
    objects['PBXContainerItemProxy'] = objects['PBXContainerItemProxy'] || {};

    // --- 2. The target itself. For app_extension node-xcode also adds
    // the target dependency and embeds the .appex in the main app ---
    const target = proj.addTarget(
      SHARE_EXTENSION_NAME,
      'app_extension',
      SHARE_EXTENSION_NAME,
      extBundleId
    );

    // --- 3. Build phases for the extension ---
    proj.addBuildPhase([EXTENSION_SOURCE], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    proj.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    proj.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    // --- 4. Build settings for the extension's configurations ---
    const configurations = proj.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const cfg = configurations[key];
      if (typeof cfg === 'object' && cfg.buildSettings) {
        const product = String(cfg.buildSettings.PRODUCT_NAME || '');
        if (product === `"${SHARE_EXTENSION_NAME}"` || product === SHARE_EXTENSION_NAME) {
          cfg.buildSettings = {
            ...cfg.buildSettings,
            INFOPLIST_FILE: `${SHARE_EXTENSION_NAME}/Info.plist`,
            CODE_SIGN_ENTITLEMENTS: `${SHARE_EXTENSION_NAME}/${SHARE_EXTENSION_NAME}.entitlements`,
            PRODUCT_BUNDLE_IDENTIFIER: extBundleId,
            SWIFT_VERSION: '5.0',
            IPHONEOS_DEPLOYMENT_TARGET: '15.1',
            TARGETED_DEVICE_FAMILY: '"1,2"',
            MARKETING_VERSION: appVersion,
            CURRENT_PROJECT_VERSION: buildNumber,
            SWIFT_EMIT_LOC_STRINGS: 'YES',
            // Local Xcode builds (expo run:ios) need the extension
            // signable without manual Signing & Capabilities clicking -
            // prebuild wipes any hand-set team on every --clean
            ...(config.ios?.appleTeamId
              ? {
                  DEVELOPMENT_TEAM: config.ios.appleTeamId,
                  CODE_SIGN_STYLE: 'Automatic',
                }
              : {}),
          };
        }
      }
    }

    // --- 5. Main app native modules into the MAIN target's Sources ---
    const firstTarget = proj.getFirstTarget();
    let mainGroupKey = null;
    Object.keys(groups).forEach((key) => {
      if (!key.endsWith('_comment') && (groups[key].name === projectName || groups[key].path === projectName)) {
        mainGroupKey = mainGroupKey || key;
      }
    });

    MAIN_APP_MODULE_FILES.forEach((file) => {
      try {
        proj.addSourceFile(
          `${projectName}/${file}`,
          { target: firstTarget.uuid },
          mainGroupKey
        );
      } catch (e) {
        console.warn(`Could not add ${file} to main target:`, e.message);
      }
    });

    console.log(
      `✅ ShareExtension target added (${extBundleId}), main-app modules wired`
    );
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
      CFBundleURLName: 'app.melibri.share',
      CFBundleURLSchemes: ['melibri'],
    };

    const existingScheme = infoPlist.CFBundleURLTypes.find(
      (type) => type.CFBundleURLSchemes?.includes('melibri')
    );

    if (!existingScheme) {
      infoPlist.CFBundleURLTypes.push(shareScheme);
    }

    return config;
  });

  // Add app groups entitlement for main app
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;

    if (!entitlements['com.apple.security.application-groups']) {
      entitlements['com.apple.security.application-groups'] = [APP_GROUP_ID];
    }

    return config;
  });

  // Create Share Extension files
  config = withShareExtensionFiles(config);

  // Add Share Extension target to Xcode project
  config = withShareExtensionTarget(config);

  return config;
};

module.exports = withIOSShareExtension;

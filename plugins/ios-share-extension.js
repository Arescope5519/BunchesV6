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
const APP_GROUP_ID = 'group.com.bunchesai.v6';

/**
 * Creates the ShareViewController.swift file content
 */
function getShareViewControllerContent(bundleId, appGroupId) {
  return `import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: SLComposeServiceViewController {

    private let appGroupId = "${appGroupId}"
    private let sharedURLKey = "sharedURL"

    override func isContentValid() -> Bool {
        return true
    }

    override func didSelectPost() {
        handleSharedItems()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
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
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (item, error) in
                        if let url = item as? URL {
                            self?.saveURL(url.absoluteString)
                        }
                        self?.completeRequest()
                    }
                    return
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (item, error) in
                        if let text = item as? String, let url = URL(string: text), url.scheme != nil {
                            self?.saveURL(text)
                        }
                        self?.completeRequest()
                    }
                    return
                }
            }
        }

        completeRequest()
    }

    private func saveURL(_ urlString: String) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else { return }
        userDefaults.set(urlString, forKey: sharedURLKey)
        userDefaults.synchronize()

        // Open main app
        openMainApp()
    }

    private func openMainApp() {
        let urlString = "bunches://share"
        guard let url = URL(string: urlString) else { return }

        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = responder?.next
        }

        // Alternative method using openURL selector
        let selector = sel_registerName("openURL:")
        var currentResponder: UIResponder? = self
        while currentResponder != nil {
            if currentResponder!.responds(to: selector) {
                currentResponder!.perform(selector, with: url)
                return
            }
            currentResponder = currentResponder?.next
        }
    }

    private func completeRequest() {
        DispatchQueue.main.async {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
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
 * Plugin to create Share Extension files
 */
const withShareExtensionFiles = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const bundleId = config.ios?.bundleIdentifier || 'com.bunchesai.v6';
      const bundleDisplayName = config.name || 'Bunches';

      const extensionPath = path.join(platformProjectRoot, SHARE_EXTENSION_NAME);

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

      // Write MainInterface.storyboard
      fs.writeFileSync(
        path.join(extensionPath, 'MainInterface.storyboard'),
        getMainInterfaceStoryboard()
      );

      return config;
    },
  ]);
};

/**
 * Plugin to add Share Extension target to Xcode project
 */
const withShareExtensionTarget = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const bundleId = config.ios?.bundleIdentifier || 'com.bunchesai.v6';
    const platformProjectRoot = config.modRequest.platformProjectRoot;
    const targetName = SHARE_EXTENSION_NAME;

    // Check if target already exists
    const existingTarget = xcodeProject.pbxTargetByName(targetName);
    if (existingTarget) {
      console.log(`Share Extension target "${targetName}" already exists`);
      return config;
    }

    // Add Share Extension target
    const target = xcodeProject.addTarget(
      targetName,
      'app_extension',
      targetName,
      `${bundleId}.${targetName}`
    );

    // Add build phases
    const groupName = targetName;
    const groupKey = xcodeProject.pbxCreateGroup(groupName, groupName);

    // Get the main group and add our extension group to it
    const mainGroupKey = xcodeProject.getFirstProject().firstProject.mainGroup;
    xcodeProject.addToPbxGroup(groupKey, mainGroupKey);

    // Add source files to the target
    const extensionPath = path.join(platformProjectRoot, targetName);

    // Add Swift file
    xcodeProject.addSourceFile(
      `${targetName}/ShareViewController.swift`,
      { target: target.uuid },
      groupKey
    );

    // Add storyboard
    xcodeProject.addResourceFile(
      `${targetName}/MainInterface.storyboard`,
      { target: target.uuid },
      groupKey
    );

    // Add Info.plist reference (not as build file)
    xcodeProject.addFile(
      `${targetName}/Info.plist`,
      groupKey
    );

    // Configure build settings for the extension target
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key in configurations) {
      if (typeof configurations[key] === 'object' && configurations[key].buildSettings) {
        const buildSettings = configurations[key].buildSettings;
        const name = configurations[key].name;

        // Check if this configuration belongs to our target
        if (buildSettings.PRODUCT_NAME === `"${targetName}"` ||
            buildSettings.PRODUCT_BUNDLE_IDENTIFIER === `"${bundleId}.${targetName}"`) {

          buildSettings.INFOPLIST_FILE = `${targetName}/Info.plist`;
          buildSettings.CODE_SIGN_ENTITLEMENTS = `${targetName}/${targetName}.entitlements`;
          buildSettings.CODE_SIGN_STYLE = 'Automatic';
          buildSettings.CURRENT_PROJECT_VERSION = '1';
          buildSettings.GENERATE_INFOPLIST_FILE = 'NO';
          buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '14.0';
          buildSettings.MARKETING_VERSION = '1.0';
          buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${bundleId}.${targetName}"`;
          buildSettings.SWIFT_VERSION = '5.0';
          buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
          buildSettings.DEVELOPMENT_TEAM = ''; // Will be set by Xcode
        }
      }
    }

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

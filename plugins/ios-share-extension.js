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
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    private let containerView = UIView()
    private let titleLabel = UILabel()
    private let recipeNameLabel = UILabel()
    private let statusLabel = UILabel()
    private let ingredientsTextView = UITextView()
    private let instructionsTextView = UITextView()
    private let saveButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)
    private let loadingIndicator = UIActivityIndicatorView(style: .large)
    private let segmentedControl = UISegmentedControl(items: ["Ingredients", "Instructions"])

    private var recipeData: [String: Any]?
    private var sharedURL: String?
    private let appGroupIdentifier = "${appGroupId}"

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        extractSharedContent()
    }

    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        containerView.backgroundColor = .systemBackground
        containerView.layer.cornerRadius = 16
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)

        titleLabel.text = "Save to Melibri"
        titleLabel.font = .boldSystemFont(ofSize: 20)
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(titleLabel)

        recipeNameLabel.text = "Loading recipe..."
        recipeNameLabel.font = .systemFont(ofSize: 16, weight: .medium)
        recipeNameLabel.textAlignment = .center
        recipeNameLabel.numberOfLines = 2
        recipeNameLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(recipeNameLabel)

        statusLabel.font = .systemFont(ofSize: 14)
        statusLabel.textColor = .secondaryLabel
        statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(statusLabel)

        segmentedControl.selectedSegmentIndex = 0
        segmentedControl.addTarget(self, action: #selector(segmentChanged), for: .valueChanged)
        segmentedControl.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(segmentedControl)

        ingredientsTextView.isEditable = false
        ingredientsTextView.font = .systemFont(ofSize: 14)
        ingredientsTextView.backgroundColor = .secondarySystemBackground
        ingredientsTextView.layer.cornerRadius = 8
        ingredientsTextView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(ingredientsTextView)

        instructionsTextView.isEditable = false
        instructionsTextView.font = .systemFont(ofSize: 14)
        instructionsTextView.backgroundColor = .secondarySystemBackground
        instructionsTextView.layer.cornerRadius = 8
        instructionsTextView.isHidden = true
        instructionsTextView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(instructionsTextView)

        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.hidesWhenStopped = true
        containerView.addSubview(loadingIndicator)

        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(cancelButton)

        saveButton.setTitle("Save Recipe", for: .normal)
        saveButton.titleLabel?.font = .boldSystemFont(ofSize: 17)
        saveButton.backgroundColor = UIColor(red: 0.36, green: 0.68, blue: 0.49, alpha: 1.0)
        saveButton.setTitleColor(.white, for: .normal)
        saveButton.layer.cornerRadius = 10
        saveButton.isEnabled = false
        saveButton.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(saveButton)

        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.9),
            containerView.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.7),
            titleLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            recipeNameLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            recipeNameLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            recipeNameLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            statusLabel.topAnchor.constraint(equalTo: recipeNameLabel.bottomAnchor, constant: 4),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            segmentedControl.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 12),
            segmentedControl.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            segmentedControl.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            ingredientsTextView.topAnchor.constraint(equalTo: segmentedControl.bottomAnchor, constant: 12),
            ingredientsTextView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            ingredientsTextView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            ingredientsTextView.bottomAnchor.constraint(equalTo: saveButton.topAnchor, constant: -16),
            instructionsTextView.topAnchor.constraint(equalTo: segmentedControl.bottomAnchor, constant: 12),
            instructionsTextView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            instructionsTextView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            instructionsTextView.bottomAnchor.constraint(equalTo: saveButton.topAnchor, constant: -16),
            loadingIndicator.centerXAnchor.constraint(equalTo: ingredientsTextView.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: ingredientsTextView.centerYAnchor),
            cancelButton.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            cancelButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -16),
            cancelButton.widthAnchor.constraint(equalToConstant: 80),
            cancelButton.heightAnchor.constraint(equalToConstant: 44),
            saveButton.leadingAnchor.constraint(equalTo: cancelButton.trailingAnchor, constant: 16),
            saveButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            saveButton.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -16),
            saveButton.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    @objc private func segmentChanged() {
        ingredientsTextView.isHidden = segmentedControl.selectedSegmentIndex == 1
        instructionsTextView.isHidden = segmentedControl.selectedSegmentIndex == 0
    }

    private func extractSharedContent() {
        loadingIndicator.startAnimating()
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showError("No content to share")
            return
        }
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        if let url = data as? URL {
                            self?.sharedURL = url.absoluteString
                            self?.fetchRecipe(from: url.absoluteString)
                        }
                    }
                    return
                }
            }
        }
    }

    private func fetchRecipe(from urlString: String) {
        guard let url = URL(string: urlString) else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let self = self, let data = data, let html = String(data: data, encoding: .utf8) else { return }
            let recipe = self.parseRecipe(from: html, url: urlString)
            DispatchQueue.main.async {
                self.loadingIndicator.stopAnimating()
                if let recipe = recipe {
                    self.recipeData = recipe
                    self.displayRecipe(recipe)
                } else {
                    self.showError("Could not find recipe")
                }
            }
        }.resume()
    }

    private func parseRecipe(from html: String, url: String) -> [String: Any]? {
        var recipe: [String: Any] = ["source_url": url, "id": UUID().uuidString]
        if let jsonLD = parseJSONLD(from: html) { recipe.merge(jsonLD) { _, new in new } }
        if recipe["title"] == nil { recipe["title"] = extractTitle(from: html) }
        return recipe["title"] != nil ? recipe : nil
    }

    private func parseJSONLD(from html: String) -> [String: Any]? {
        let pattern = "<script[^>]*type=[\\"']application/ld\\\\+json[\\"'][^>]*>(.*?)</script>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators, .caseInsensitive]) else { return nil }
        let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))
        for match in matches {
            guard let jsonRange = Range(match.range(at: 1), in: html),
                  let jsonData = String(html[jsonRange]).data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else { continue }
            if let recipe = extractRecipeFromJSONLD(json) { return recipe }
            if let graph = json["@graph"] as? [[String: Any]] {
                for item in graph { if let recipe = extractRecipeFromJSONLD(item) { return recipe } }
            }
        }
        return nil
    }

    private func extractRecipeFromJSONLD(_ json: [String: Any]) -> [String: Any]? {
        let typeValue = json["@type"]
        var isRecipe = false
        if let typeString = typeValue as? String { isRecipe = typeString.lowercased().contains("recipe") }
        else if let typeArray = typeValue as? [String] { isRecipe = typeArray.contains { $0.lowercased().contains("recipe") } }

        // Check @graph for nested recipes
        if !isRecipe, let graph = json["@graph"] as? [[String: Any]] {
            for item in graph { if let recipe = extractRecipeFromJSONLD(item) { return recipe } }
            return nil
        }
        guard isRecipe else { return nil }

        var recipe: [String: Any] = [:]
        recipe["title"] = json["name"] as? String
        if let ingredients = json["recipeIngredient"] as? [String] { recipe["ingredients"] = ingredients.joined(separator: "\\n") }

        // Handle multiple instruction formats (HowToSection, HowToStep, plain objects, strings)
        if let instructions = json["recipeInstructions"] {
            var steps: [String] = []
            if let instructionString = instructions as? String { steps.append(instructionString) }
            else if let instructionArray = instructions as? [Any] {
                for instruction in instructionArray {
                    if let stepString = instruction as? String {
                        let cleaned = stepString.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !cleaned.isEmpty { steps.append(cleaned) }
                    } else if let stepObject = instruction as? [String: Any] {
                        let stepType = stepObject["@type"] as? String ?? ""
                        if stepType == "HowToSection" {
                            if let itemList = stepObject["itemListElement"] as? [Any] {
                                for item in itemList {
                                    if let itemStr = item as? String { steps.append(itemStr.trimmingCharacters(in: .whitespacesAndNewlines)) }
                                    else if let itemObj = item as? [String: Any] {
                                        if let text = itemObj["text"] as? String { steps.append(text.trimmingCharacters(in: .whitespacesAndNewlines)) }
                                        else if let name = itemObj["name"] as? String { steps.append(name.trimmingCharacters(in: .whitespacesAndNewlines)) }
                                    }
                                }
                            }
                        } else {
                            if let text = stepObject["text"] as? String { steps.append(text.trimmingCharacters(in: .whitespacesAndNewlines)) }
                            else if let name = stepObject["name"] as? String { steps.append(name.trimmingCharacters(in: .whitespacesAndNewlines)) }
                        }
                    }
                }
            }
            let cleanedSteps = steps.compactMap { step -> String? in
                var cleaned = step.replacingOccurrences(of: "^(Step\\\\s+)?\\\\d+[.:\\\\s]+", with: "", options: .regularExpression)
                cleaned = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
                return cleaned.count > 5 ? cleaned : nil
            }
            if !cleanedSteps.isEmpty {
                recipe["instructions"] = cleanedSteps.enumerated().map { "\\($0.offset + 1). \\($0.element)" }.joined(separator: "\\n")
            }
        }

        if let image = json["image"] as? String { recipe["image_url"] = image }
        else if let images = json["image"] as? [String] { recipe["image_url"] = images.first }
        else if let imageObj = json["image"] as? [String: Any], let url = imageObj["url"] as? String { recipe["image_url"] = url }
        return recipe
    }

    private func extractTitle(from html: String) -> String? {
        let pattern = "<title[^>]*>([^<]+)</title>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
              let range = Range(match.range(at: 1), in: html) else { return nil }
        return String(html[range]).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func displayRecipe(_ recipe: [String: Any]) {
        recipeNameLabel.text = recipe["title"] as? String ?? "Recipe"
        ingredientsTextView.text = recipe["ingredients"] as? String ?? "No ingredients found"
        instructionsTextView.text = recipe["instructions"] as? String ?? "No instructions found"
        saveButton.isEnabled = true
    }

    private func showError(_ message: String) {
        loadingIndicator.stopAnimating()
        recipeNameLabel.text = "Error"
        ingredientsTextView.text = message
    }

    @objc private func cancelTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    @objc private func saveTapped() {
        guard let url = sharedURL, let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else { return }
        var queue = userDefaults.array(forKey: "pendingRecipes") as? [[String: Any]] ?? []

        // Save URL only - main app will use JS RecipeExtractor for full parsing
        // This ensures consistent parsing between iOS and Android
        var pendingItem: [String: Any] = [
            "id": UUID().uuidString,
            "url": url,
            "created_at": ISO8601DateFormatter().string(from: Date()),
            "needs_parsing": true
        ]

        // Include preview data for display while parsing
        if let preview = recipeData {
            pendingItem["preview_title"] = preview["title"]
            pendingItem["preview_image"] = preview["image_url"]
        }

        queue.append(pendingItem)
        userDefaults.set(queue, forKey: "pendingRecipes")
        saveButton.setTitle("Saved!", for: .normal)
        saveButton.isEnabled = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
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
    <string>6.06</string>
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
 * Plugin to log instructions for Share Extension setup
 * NOTE: Xcode project modifications removed due to compatibility issues
 * The Share Extension target must be created manually in Xcode
 */
const withShareExtensionTarget = (config) => {
  console.log('\n========================================');
  console.log('SHARE EXTENSION SETUP REQUIRED');
  console.log('========================================');
  console.log('Files have been created in ios/ShareExtension/');
  console.log('You must manually add the Share Extension target in Xcode:');
  console.log('1. Open ios/Melibri.xcworkspace');
  console.log('2. File > New > Target > Share Extension');
  console.log('3. Name it "ShareExtension"');
  console.log('4. Delete the generated files and use the ones in ios/ShareExtension/');
  console.log('5. Add App Groups capability to both targets');
  console.log('========================================\n');
  return config;
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

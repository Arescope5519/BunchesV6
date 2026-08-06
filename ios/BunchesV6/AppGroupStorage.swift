import Foundation

@objc(AppGroupStorage)
class AppGroupStorage: NSObject {
  private let appGroupId = "group.app.melibri"
  private let sharedURLsKey = "sharedURLs"
  private let legacySharedURLKey = "sharedURL"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

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
}

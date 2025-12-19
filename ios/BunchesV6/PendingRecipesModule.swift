import Foundation

@objc(PendingRecipesModule)
class PendingRecipesModule: NSObject {

  private let appGroupIdentifier = "group.com.bunchesai.v6.shared"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func getPendingRecipes(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
      reject("ERROR", "Failed to access App Group", nil)
      return
    }

    let recipes = userDefaults.array(forKey: "pendingRecipes") as? [[String: Any]] ?? []

    // Convert to JSON-safe format
    do {
      let jsonData = try JSONSerialization.data(withJSONObject: recipes, options: [])
      if let jsonString = String(data: jsonData, encoding: .utf8) {
        resolve(jsonString)
      } else {
        resolve("[]")
      }
    } catch {
      resolve("[]")
    }
  }

  @objc
  func clearPendingRecipes(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
      reject("ERROR", "Failed to access App Group", nil)
      return
    }

    userDefaults.removeObject(forKey: "pendingRecipes")
    userDefaults.synchronize()
    resolve(true)
  }

  @objc
  func removePendingRecipe(_ recipeId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
      reject("ERROR", "Failed to access App Group", nil)
      return
    }

    var recipes = userDefaults.array(forKey: "pendingRecipes") as? [[String: Any]] ?? []
    recipes.removeAll { ($0["id"] as? String) == recipeId }

    userDefaults.set(recipes, forKey: "pendingRecipes")
    userDefaults.synchronize()
    resolve(true)
  }
}

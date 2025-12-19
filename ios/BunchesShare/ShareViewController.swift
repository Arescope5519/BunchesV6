import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    // UI Elements
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

    // Recipe data
    private var recipeData: [String: Any]?
    private var sharedURL: String?

    // App Group identifier - must match your app group
    private let appGroupIdentifier = "group.com.bunchesai.v6.shared"

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        extractSharedContent()
    }

    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.5)

        // Container
        containerView.backgroundColor = .systemBackground
        containerView.layer.cornerRadius = 16
        containerView.clipsToBounds = true
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)

        // Title
        titleLabel.text = "Save to Bunches"
        titleLabel.font = .boldSystemFont(ofSize: 20)
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(titleLabel)

        // Recipe name
        recipeNameLabel.text = "Loading recipe..."
        recipeNameLabel.font = .systemFont(ofSize: 16, weight: .medium)
        recipeNameLabel.textAlignment = .center
        recipeNameLabel.numberOfLines = 2
        recipeNameLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(recipeNameLabel)

        // Status label
        statusLabel.text = ""
        statusLabel.font = .systemFont(ofSize: 14)
        statusLabel.textColor = .secondaryLabel
        statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(statusLabel)

        // Segmented control
        segmentedControl.selectedSegmentIndex = 0
        segmentedControl.addTarget(self, action: #selector(segmentChanged), for: .valueChanged)
        segmentedControl.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(segmentedControl)

        // Ingredients text view
        ingredientsTextView.isEditable = false
        ingredientsTextView.font = .systemFont(ofSize: 14)
        ingredientsTextView.backgroundColor = .secondarySystemBackground
        ingredientsTextView.layer.cornerRadius = 8
        ingredientsTextView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(ingredientsTextView)

        // Instructions text view
        instructionsTextView.isEditable = false
        instructionsTextView.font = .systemFont(ofSize: 14)
        instructionsTextView.backgroundColor = .secondarySystemBackground
        instructionsTextView.layer.cornerRadius = 8
        instructionsTextView.isHidden = true
        instructionsTextView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(instructionsTextView)

        // Loading indicator
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.hidesWhenStopped = true
        containerView.addSubview(loadingIndicator)

        // Cancel button
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 17)
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(cancelButton)

        // Save button
        saveButton.setTitle("Save Recipe", for: .normal)
        saveButton.titleLabel?.font = .boldSystemFont(ofSize: 17)
        saveButton.backgroundColor = UIColor(red: 0.36, green: 0.68, blue: 0.49, alpha: 1.0) // Bunches green
        saveButton.setTitleColor(.white, for: .normal)
        saveButton.layer.cornerRadius = 10
        saveButton.isEnabled = false
        saveButton.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(saveButton)

        // Layout
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
                // Check for URL
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        if let url = data as? URL {
                            self?.sharedURL = url.absoluteString
                            self?.fetchRecipe(from: url.absoluteString)
                        } else if let urlData = data as? Data, let url = URL(dataRepresentation: urlData, relativeTo: nil) {
                            self?.sharedURL = url.absoluteString
                            self?.fetchRecipe(from: url.absoluteString)
                        }
                    }
                    return
                }

                // Check for text (might be a URL string)
                if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { [weak self] (data, error) in
                        if let text = data as? String, text.hasPrefix("http") {
                            self?.sharedURL = text
                            self?.fetchRecipe(from: text)
                        }
                    }
                    return
                }
            }
        }
    }

    private func fetchRecipe(from urlString: String) {
        guard let url = URL(string: urlString) else {
            DispatchQueue.main.async {
                self.showError("Invalid URL")
            }
            return
        }

        let task = URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                DispatchQueue.main.async {
                    self.showError("Failed to load: \(error.localizedDescription)")
                }
                return
            }

            guard let data = data, let html = String(data: data, encoding: .utf8) else {
                DispatchQueue.main.async {
                    self.showError("Failed to read page content")
                }
                return
            }

            // Parse the recipe
            let recipe = self.parseRecipe(from: html, url: urlString)

            DispatchQueue.main.async {
                self.loadingIndicator.stopAnimating()

                if let recipe = recipe {
                    self.recipeData = recipe
                    self.displayRecipe(recipe)
                } else {
                    self.showError("Could not find recipe on this page")
                }
            }
        }
        task.resume()
    }

    private func parseRecipe(from html: String, url: String) -> [String: Any]? {
        var recipe: [String: Any] = [
            "source_url": url,
            "created_at": ISO8601DateFormatter().string(from: Date()),
            "id": UUID().uuidString
        ]

        // Try to find JSON-LD recipe data first
        if let jsonLDRecipe = parseJSONLD(from: html) {
            recipe.merge(jsonLDRecipe) { (_, new) in new }
            if recipe["title"] != nil {
                return recipe
            }
        }

        // Fallback to meta tags and HTML parsing
        recipe["title"] = extractTitle(from: html)

        if recipe["ingredients"] == nil {
            recipe["ingredients"] = extractIngredients(from: html)
        }

        if recipe["instructions"] == nil {
            recipe["instructions"] = extractInstructions(from: html)
        }

        // Only return if we found a title
        if recipe["title"] != nil {
            return recipe
        }

        return nil
    }

    private func parseJSONLD(from html: String) -> [String: Any]? {
        // Find JSON-LD script tags
        let pattern = "<script[^>]*type=[\"']application/ld\\+json[\"'][^>]*>(.*?)</script>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators, .caseInsensitive]) else {
            return nil
        }

        let range = NSRange(html.startIndex..., in: html)
        let matches = regex.matches(in: html, options: [], range: range)

        for match in matches {
            guard let jsonRange = Range(match.range(at: 1), in: html) else { continue }
            let jsonString = String(html[jsonRange])

            guard let jsonData = jsonString.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: jsonData) else {
                continue
            }

            // Handle array of JSON-LD objects
            if let jsonArray = json as? [[String: Any]] {
                for item in jsonArray {
                    if let recipe = extractRecipeFromJSONLD(item) {
                        return recipe
                    }
                }
            }

            // Handle single JSON-LD object
            if let jsonDict = json as? [String: Any] {
                if let recipe = extractRecipeFromJSONLD(jsonDict) {
                    return recipe
                }
            }
        }

        return nil
    }

    private func extractRecipeFromJSONLD(_ json: [String: Any]) -> [String: Any]? {
        // Check if this is a Recipe type
        let type = json["@type"]
        let isRecipe: Bool

        if let typeString = type as? String {
            isRecipe = typeString.lowercased().contains("recipe")
        } else if let typeArray = type as? [String] {
            isRecipe = typeArray.contains { $0.lowercased().contains("recipe") }
        } else {
            isRecipe = false
        }

        // Check @graph for nested recipes
        if !isRecipe, let graph = json["@graph"] as? [[String: Any]] {
            for item in graph {
                if let recipe = extractRecipeFromJSONLD(item) {
                    return recipe
                }
            }
            return nil
        }

        guard isRecipe else { return nil }

        var recipe: [String: Any] = [:]

        // Title
        recipe["title"] = json["name"] as? String ?? json["headline"] as? String

        // Ingredients
        if let ingredients = json["recipeIngredient"] as? [String] {
            recipe["ingredients"] = ingredients.joined(separator: "\n")
        }

        // Instructions
        if let instructions = json["recipeInstructions"] {
            if let instructionString = instructions as? String {
                recipe["instructions"] = instructionString
            } else if let instructionArray = instructions as? [String] {
                recipe["instructions"] = instructionArray.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n")
            } else if let instructionObjects = instructions as? [[String: Any]] {
                let steps = instructionObjects.compactMap { $0["text"] as? String }
                recipe["instructions"] = steps.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n")
            }
        }

        // Times
        recipe["prep_time"] = parseTime(json["prepTime"] as? String)
        recipe["cook_time"] = parseTime(json["cookTime"] as? String)

        // Servings
        if let yield = json["recipeYield"] {
            if let yieldString = yield as? String {
                recipe["servings"] = yieldString
            } else if let yieldArray = yield as? [String], let first = yieldArray.first {
                recipe["servings"] = first
            }
        }

        // Image
        if let image = json["image"] {
            if let imageString = image as? String {
                recipe["image_url"] = imageString
            } else if let imageArray = image as? [String], let first = imageArray.first {
                recipe["image_url"] = first
            } else if let imageObject = image as? [String: Any], let url = imageObject["url"] as? String {
                recipe["image_url"] = url
            } else if let imageArray = image as? [[String: Any]], let first = imageArray.first, let url = first["url"] as? String {
                recipe["image_url"] = url
            }
        }

        return recipe
    }

    private func parseTime(_ isoTime: String?) -> String? {
        guard let isoTime = isoTime else { return nil }

        // Parse ISO 8601 duration (e.g., "PT30M", "PT1H30M")
        var minutes = 0
        var hours = 0

        let hourPattern = "([0-9]+)H"
        let minutePattern = "([0-9]+)M"

        if let hourRegex = try? NSRegularExpression(pattern: hourPattern),
           let match = hourRegex.firstMatch(in: isoTime, range: NSRange(isoTime.startIndex..., in: isoTime)),
           let range = Range(match.range(at: 1), in: isoTime) {
            hours = Int(isoTime[range]) ?? 0
        }

        if let minuteRegex = try? NSRegularExpression(pattern: minutePattern),
           let match = minuteRegex.firstMatch(in: isoTime, range: NSRange(isoTime.startIndex..., in: isoTime)),
           let range = Range(match.range(at: 1), in: isoTime) {
            minutes = Int(isoTime[range]) ?? 0
        }

        if hours > 0 && minutes > 0 {
            return "\(hours)h \(minutes)m"
        } else if hours > 0 {
            return "\(hours)h"
        } else if minutes > 0 {
            return "\(minutes) min"
        }

        return nil
    }

    private func extractTitle(from html: String) -> String? {
        // Try og:title first
        if let ogTitle = extractMetaContent(from: html, property: "og:title") {
            return cleanText(ogTitle)
        }

        // Try <title> tag
        let titlePattern = "<title[^>]*>([^<]+)</title>"
        if let regex = try? NSRegularExpression(pattern: titlePattern, options: .caseInsensitive),
           let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
           let range = Range(match.range(at: 1), in: html) {
            return cleanText(String(html[range]))
        }

        return nil
    }

    private func extractMetaContent(from html: String, property: String) -> String? {
        let pattern = "<meta[^>]*(?:property|name)=[\"']\(property)[\"'][^>]*content=[\"']([^\"']+)[\"']"
        if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
           let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
           let range = Range(match.range(at: 1), in: html) {
            return String(html[range])
        }

        // Try reverse order (content before property)
        let reversePattern = "<meta[^>]*content=[\"']([^\"']+)[\"'][^>]*(?:property|name)=[\"']\(property)[\"']"
        if let regex = try? NSRegularExpression(pattern: reversePattern, options: .caseInsensitive),
           let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
           let range = Range(match.range(at: 1), in: html) {
            return String(html[range])
        }

        return nil
    }

    private func extractIngredients(from html: String) -> String? {
        // Look for common ingredient patterns
        let patterns = [
            "<li[^>]*class=[\"'][^\"']*ingredient[^\"']*[\"'][^>]*>([^<]+)</li>",
            "<span[^>]*class=[\"'][^\"']*ingredient[^\"']*[\"'][^>]*>([^<]+)</span>"
        ]

        var ingredients: [String] = []

        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) {
                let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))
                for match in matches {
                    if let range = Range(match.range(at: 1), in: html) {
                        let ingredient = cleanText(String(html[range]))
                        if !ingredient.isEmpty {
                            ingredients.append(ingredient)
                        }
                    }
                }
            }
        }

        return ingredients.isEmpty ? nil : ingredients.joined(separator: "\n")
    }

    private func extractInstructions(from html: String) -> String? {
        // Look for common instruction patterns
        let patterns = [
            "<li[^>]*class=[\"'][^\"']*instruction[^\"']*[\"'][^>]*>([^<]+)</li>",
            "<div[^>]*class=[\"'][^\"']*instruction[^\"']*[\"'][^>]*>([^<]+)</div>"
        ]

        var instructions: [String] = []

        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) {
                let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))
                for match in matches {
                    if let range = Range(match.range(at: 1), in: html) {
                        let instruction = cleanText(String(html[range]))
                        if !instruction.isEmpty {
                            instructions.append(instruction)
                        }
                    }
                }
            }
        }

        if !instructions.isEmpty {
            return instructions.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n")
        }

        return nil
    }

    private func cleanText(_ text: String) -> String {
        var cleaned = text

        // Remove HTML tags
        cleaned = cleaned.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)

        // Decode HTML entities
        cleaned = cleaned.replacingOccurrences(of: "&amp;", with: "&")
        cleaned = cleaned.replacingOccurrences(of: "&lt;", with: "<")
        cleaned = cleaned.replacingOccurrences(of: "&gt;", with: ">")
        cleaned = cleaned.replacingOccurrences(of: "&quot;", with: "\"")
        cleaned = cleaned.replacingOccurrences(of: "&#39;", with: "'")
        cleaned = cleaned.replacingOccurrences(of: "&nbsp;", with: " ")
        cleaned = cleaned.replacingOccurrences(of: "&#x27;", with: "'")
        cleaned = cleaned.replacingOccurrences(of: "&#x2F;", with: "/")

        // Trim whitespace
        cleaned = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)

        // Collapse multiple spaces
        cleaned = cleaned.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)

        return cleaned
    }

    private func displayRecipe(_ recipe: [String: Any]) {
        recipeNameLabel.text = recipe["title"] as? String ?? "Unknown Recipe"

        if let ingredients = recipe["ingredients"] as? String, !ingredients.isEmpty {
            ingredientsTextView.text = ingredients
        } else {
            ingredientsTextView.text = "No ingredients found"
        }

        if let instructions = recipe["instructions"] as? String, !instructions.isEmpty {
            instructionsTextView.text = instructions
        } else {
            instructionsTextView.text = "No instructions found"
        }

        // Show status info
        var statusParts: [String] = []
        if let prepTime = recipe["prep_time"] as? String {
            statusParts.append("Prep: \(prepTime)")
        }
        if let cookTime = recipe["cook_time"] as? String {
            statusParts.append("Cook: \(cookTime)")
        }
        statusLabel.text = statusParts.joined(separator: " | ")

        saveButton.isEnabled = true
    }

    private func showError(_ message: String) {
        loadingIndicator.stopAnimating()
        recipeNameLabel.text = "Error"
        ingredientsTextView.text = message
        statusLabel.text = ""
        saveButton.isEnabled = false
    }

    @objc private func cancelTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    @objc private func saveTapped() {
        guard let recipe = recipeData else { return }

        // Save to shared App Group storage
        saveRecipeToQueue(recipe)

        // Show success and close
        saveButton.setTitle("Saved!", for: .normal)
        saveButton.isEnabled = false

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }

    private func saveRecipeToQueue(_ recipe: [String: Any]) {
        guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
            print("Failed to access App Group")
            return
        }

        // Get existing queue
        var queue = userDefaults.array(forKey: "pendingRecipes") as? [[String: Any]] ?? []

        // Add new recipe
        queue.append(recipe)

        // Save back
        userDefaults.set(queue, forKey: "pendingRecipes")
        userDefaults.synchronize()

        print("Recipe saved to queue. Total pending: \(queue.count)")
    }
}

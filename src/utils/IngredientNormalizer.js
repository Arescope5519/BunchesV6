/**
 * IngredientNormalizer
 * Standardizes ingredient names to reduce duplicates in search
 * Maps common variations to canonical forms
 */

// Standardized ingredient mappings
// Format: variations map to a single canonical name
const INGREDIENT_MAP = {
  // Poultry
  'chicken': ['chicken', 'chickens', 'whole chicken'],
  'chicken breast': ['chicken breast', 'chicken breasts', 'boneless chicken breast', 'boneless chicken breasts', 'skinless chicken breast', 'boneless skinless chicken breast', 'boneless skinless chicken breasts'],
  'chicken thigh': ['chicken thigh', 'chicken thighs', 'boneless chicken thigh', 'boneless chicken thighs', 'skinless chicken thigh', 'boneless skinless chicken thigh', 'boneless skinless chicken thighs'],
  'chicken wing': ['chicken wing', 'chicken wings', 'buffalo wing', 'buffalo wings'],
  'ground chicken': ['ground chicken', 'minced chicken', 'chicken mince'],
  'turkey': ['turkey', 'whole turkey'],
  'ground turkey': ['ground turkey', 'minced turkey', 'turkey mince'],

  // Beef
  'beef': ['beef', 'steak'],
  'ground beef': ['ground beef', 'minced beef', 'beef mince', 'hamburger', 'hamburger meat'],
  'beef chuck': ['beef chuck', 'chuck roast', 'chuck steak'],
  'ribeye': ['ribeye', 'rib eye', 'rib-eye', 'ribeye steak'],
  'sirloin': ['sirloin', 'sirloin steak', 'top sirloin'],
  'brisket': ['brisket', 'beef brisket'],

  // Pork
  'pork': ['pork'],
  'pork chop': ['pork chop', 'pork chops', 'bone-in pork chop', 'boneless pork chop'],
  'ground pork': ['ground pork', 'minced pork', 'pork mince'],
  'bacon': ['bacon', 'bacon strips', 'thick cut bacon', 'turkey bacon'],
  'ham': ['ham', 'cooked ham', 'smoked ham'],
  'pork tenderloin': ['pork tenderloin', 'pork tenderloins'],
  'pork shoulder': ['pork shoulder', 'pork butt', 'boston butt'],

  // Seafood
  'salmon': ['salmon', 'salmon fillet', 'salmon fillets', 'fresh salmon', 'atlantic salmon'],
  'shrimp': ['shrimp', 'shrimps', 'prawns', 'prawn', 'jumbo shrimp', 'medium shrimp'],
  'tuna': ['tuna', 'tuna steak', 'fresh tuna', 'tuna fillet'],
  'cod': ['cod', 'cod fillet', 'cod fillets'],
  'tilapia': ['tilapia', 'tilapia fillet', 'tilapia fillets'],

  // Vegetables
  'onion': ['onion', 'onions', 'yellow onion', 'yellow onions', 'white onion', 'white onions'],
  'red onion': ['red onion', 'red onions', 'purple onion', 'purple onions'],
  'green onion': ['green onion', 'green onions', 'scallion', 'scallions', 'spring onion', 'spring onions'],
  'garlic': ['garlic', 'garlic clove', 'garlic cloves'],
  'tomato': ['tomato', 'tomatoes', 'fresh tomato', 'fresh tomatoes', 'ripe tomato', 'ripe tomatoes'],
  'cherry tomato': ['cherry tomato', 'cherry tomatoes', 'grape tomato', 'grape tomatoes'],
  'bell pepper': ['bell pepper', 'bell peppers', 'sweet pepper', 'sweet peppers'],
  'red bell pepper': ['red bell pepper', 'red bell peppers', 'red pepper', 'red peppers'],
  'green bell pepper': ['green bell pepper', 'green bell peppers', 'green pepper', 'green peppers'],
  'carrot': ['carrot', 'carrots', 'baby carrot', 'baby carrots'],
  'celery': ['celery', 'celery stalk', 'celery stalks'],
  'potato': ['potato', 'potatoes', 'russet potato', 'russet potatoes', 'white potato', 'white potatoes'],
  'sweet potato': ['sweet potato', 'sweet potatoes', 'yam', 'yams'],
  'broccoli': ['broccoli', 'broccoli floret', 'broccoli florets'],
  'cauliflower': ['cauliflower', 'cauliflower floret', 'cauliflower florets'],
  'spinach': ['spinach', 'baby spinach', 'fresh spinach'],
  'kale': ['kale', 'baby kale', 'curly kale'],
  'lettuce': ['lettuce', 'lettuce leaves', 'romaine', 'romaine lettuce', 'iceberg lettuce'],
  'cucumber': ['cucumber', 'cucumbers', 'english cucumber'],
  'zucchini': ['zucchini', 'zucchinis', 'courgette', 'courgettes'],
  'mushroom': ['mushroom', 'mushrooms', 'white mushroom', 'white mushrooms', 'button mushroom', 'button mushrooms'],
  'corn': ['corn', 'sweet corn', 'corn kernels', 'corn on the cob'],
  'peas': ['peas', 'green peas', 'garden peas'],
  'green beans': ['green beans', 'green bean', 'string beans', 'string bean'],

  // Herbs & Spices
  'basil': ['basil', 'fresh basil', 'basil leaves'],
  'parsley': ['parsley', 'fresh parsley', 'flat-leaf parsley', 'curly parsley'],
  'cilantro': ['cilantro', 'fresh cilantro', 'coriander', 'coriander leaves'],
  'thyme': ['thyme', 'fresh thyme', 'thyme leaves'],
  'rosemary': ['rosemary', 'fresh rosemary'],
  'oregano': ['oregano', 'fresh oregano'],
  'dill': ['dill', 'fresh dill', 'dill weed'],
  'mint': ['mint', 'fresh mint', 'mint leaves'],
  'bay leaf': ['bay leaf', 'bay leaves'],
  'black pepper': ['black pepper', 'ground black pepper', 'pepper'],
  'salt': ['salt', 'sea salt', 'kosher salt', 'table salt'],
  'paprika': ['paprika', 'sweet paprika', 'smoked paprika'],
  'cumin': ['cumin', 'ground cumin', 'cumin powder'],
  'chili powder': ['chili powder', 'chile powder'],
  'cayenne pepper': ['cayenne pepper', 'cayenne', 'ground cayenne'],
  'red pepper flakes': ['red pepper flakes', 'crushed red pepper', 'red pepper'],
  'cinnamon': ['cinnamon', 'ground cinnamon', 'cinnamon powder'],
  'ginger': ['ginger', 'fresh ginger', 'ginger root'],

  // Dairy & Eggs
  'milk': ['milk', 'whole milk', '2% milk', 'skim milk', 'low-fat milk'],
  'heavy cream': ['heavy cream', 'heavy whipping cream', 'whipping cream'],
  'sour cream': ['sour cream', 'soured cream'],
  'butter': ['butter', 'unsalted butter', 'salted butter'],
  'cheese': ['cheese'],
  'cheddar': ['cheddar', 'cheddar cheese', 'sharp cheddar', 'mild cheddar'],
  'mozzarella': ['mozzarella', 'mozzarella cheese', 'fresh mozzarella'],
  'parmesan': ['parmesan', 'parmesan cheese', 'parmigiano reggiano', 'parmigiano-reggiano'],
  'cream cheese': ['cream cheese', 'philadelphia cream cheese'],
  'yogurt': ['yogurt', 'plain yogurt', 'greek yogurt'],
  'egg': ['egg', 'eggs', 'large egg', 'large eggs', 'whole egg', 'whole eggs'],

  // Grains & Pasta
  'rice': ['rice', 'white rice', 'long grain rice'],
  'brown rice': ['brown rice', 'whole grain rice'],
  'pasta': ['pasta', 'dry pasta'],
  'spaghetti': ['spaghetti', 'spaghetti pasta'],
  'penne': ['penne', 'penne pasta'],
  'fettuccine': ['fettuccine', 'fettuccini'],
  'flour': ['flour', 'all-purpose flour', 'all purpose flour', 'white flour'],
  'bread': ['bread', 'white bread', 'sandwich bread'],
  'bread crumbs': ['bread crumbs', 'breadcrumbs', 'panko', 'panko breadcrumbs'],

  // Legumes & Beans
  'black beans': ['black beans', 'black bean'],
  'kidney beans': ['kidney beans', 'kidney bean', 'red kidney beans'],
  'chickpeas': ['chickpeas', 'chickpea', 'garbanzo beans', 'garbanzo bean'],
  'lentils': ['lentils', 'lentil', 'red lentils', 'green lentils'],

  // Oils & Condiments
  'olive oil': ['olive oil', 'extra virgin olive oil', 'extra-virgin olive oil', 'evoo'],
  'vegetable oil': ['vegetable oil', 'cooking oil'],
  'canola oil': ['canola oil'],
  'sesame oil': ['sesame oil', 'toasted sesame oil'],
  'soy sauce': ['soy sauce', 'low sodium soy sauce', 'reduced sodium soy sauce'],
  'worcestershire sauce': ['worcestershire sauce', 'worcestershire'],
  'hot sauce': ['hot sauce', 'tabasco', 'sriracha'],
  'ketchup': ['ketchup', 'catsup', 'tomato ketchup'],
  'mustard': ['mustard', 'yellow mustard', 'dijon mustard'],
  'mayonnaise': ['mayonnaise', 'mayo'],
  'vinegar': ['vinegar', 'white vinegar', 'distilled vinegar'],
  'balsamic vinegar': ['balsamic vinegar', 'balsamic'],
  'apple cider vinegar': ['apple cider vinegar', 'cider vinegar', 'acv'],

  // Canned/Processed
  'tomato paste': ['tomato paste', 'tomato concentrate'],
  'tomato sauce': ['tomato sauce', 'marinara sauce', 'marinara'],
  'crushed tomatoes': ['crushed tomatoes', 'crushed tomato'],
  'diced tomatoes': ['diced tomatoes', 'diced tomato'],
  'chicken broth': ['chicken broth', 'chicken stock', 'chicken bouillon'],
  'beef broth': ['beef broth', 'beef stock', 'beef bouillon'],
  'vegetable broth': ['vegetable broth', 'vegetable stock', 'veggie broth', 'veggie stock'],

  // Fruits
  'lemon': ['lemon', 'lemons', 'fresh lemon'],
  'lemon juice': ['lemon juice', 'fresh lemon juice', 'juice of lemon'],
  'lime': ['lime', 'limes', 'fresh lime'],
  'lime juice': ['lime juice', 'fresh lime juice', 'juice of lime'],
  'apple': ['apple', 'apples'],
  'banana': ['banana', 'bananas'],
  'orange': ['orange', 'oranges'],
  'berries': ['berries', 'mixed berries'],
  'strawberry': ['strawberry', 'strawberries', 'fresh strawberries'],
  'blueberry': ['blueberry', 'blueberries', 'fresh blueberries'],

  // Sweeteners
  'sugar': ['sugar', 'white sugar', 'granulated sugar'],
  'brown sugar': ['brown sugar', 'light brown sugar', 'dark brown sugar'],
  'honey': ['honey'],
  'maple syrup': ['maple syrup', 'pure maple syrup'],
};

// Build reverse lookup for fast normalization
const VARIATION_TO_CANONICAL = {};
Object.entries(INGREDIENT_MAP).forEach(([canonical, variations]) => {
  variations.forEach(variation => {
    VARIATION_TO_CANONICAL[variation.toLowerCase()] = canonical;
  });
});

/**
 * Normalizes an ingredient string to its canonical form
 * @param {string} ingredient - The ingredient text to normalize
 * @returns {string} - The normalized canonical ingredient name
 */
export const normalizeIngredient = (ingredient) => {
  let cleaned = ingredient
    .toLowerCase()
    .trim();

  // First, split on common separator phrases that indicate preparation instructions
  // These typically come AFTER the ingredient name
  const separatorPatterns = [
    /\s+for\s+.*/,           // "chicken breast for grilling" -> "chicken breast"
    /\s+into\s+.*/,          // "chicken cut into cubes" -> "chicken cut"
    /\s+to\s+taste.*/,       // "salt to taste" -> "salt"
    /\s*,\s+.*/,             // "chicken, chopped" -> "chicken"
    /\s*-\s+.*/,             // "chicken - deboned" -> "chicken"
    /\s+\([^)]*\).*/,        // "chicken (boneless)" -> "chicken"
    /\s+at\s+room\s+.*/,     // "butter at room temperature" -> "butter"
    /\s+cut\s+.*/,           // "chicken cut into pieces" -> "chicken"
    /\s+about\s+.*/,         // "chicken about 2 lbs" -> "chicken"
    /\s+approximately\s+.*/,
    /\s+plus\s+.*/,          // "flour plus more for dusting" -> "flour"
  ];

  for (const pattern of separatorPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  cleaned = cleaned
    // Remove leading numbers, fractions, and measurements like 1/4", 1-inch, etc.
    .replace(/^[\d\s\/\-."']+/, '')
    .replace(/\d+[\s]*["'″]/, '')  // Remove measurements like 1/4"
    .replace(/\d+[\s]*-?[\s]*(inch|in|cm|mm)\b/gi, '')  // Remove "1 inch", "2-inch", etc.
    // Remove common units
    .replace(/\b(cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|kilogram|kilograms|ml|milliliter|milliliters|l|liter|liters|pinch|dash|can|cans|jar|jars|package|packages|box|boxes|bunch|bunches|head|heads|clove|cloves|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|handful|handfuls)\b/gi, '')
    // Remove common cooking/preparation descriptors
    .replace(/\b(of|and|or|a|an|the|some|few|several|small|medium|large|extra|very|more|less|optional|needed|desired)\b/gi, '')
    .replace(/\b(fresh|dried|frozen|canned|raw|cooked|uncooked|ripe|firm|soft|warm|cold|hot|room temperature)\b/gi, '')
    .replace(/\b(chopped|diced|sliced|minced|peeled|shredded|grated|crumbled|crushed|ground|mashed|pureed|julienned|cubed|quartered|halved|whole)\b/gi, '')
    .replace(/\b(finely|coarsely|roughly|thinly|thickly|lightly|well|slightly)\b/gi, '')
    .replace(/\b(boneless|skinless|bone-in|skin-on|trimmed|cleaned|washed|rinsed|drained|patted dry)\b/gi, '')
    .replace(/\b(packed|loosely|tightly|heaping|level|rounded)\b/gi, '')
    .replace(/\b(low-sodium|reduced-sodium|unsalted|salted|sweetened|unsweetened)\b/gi, '')
    .replace(/\b(organic|conventional|homemade|store-bought)\b/gi, '')
    .replace(/\b(divided|separated|reserved|plus|additional|extra)\b/gi, '')
    .replace(/\b(better|best|good|quality|premium|regular)\b/gi, '')
    .replace(/\b(searing|cooking|frying|baking|roasting|grilling|serving|garnish|garnishing|topping)\b/gi, '')
    // Remove punctuation
    .replace(/[,()[\]{}'"″"".]/g, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Look up in our mappings
  if (VARIATION_TO_CANONICAL[cleaned]) {
    return VARIATION_TO_CANONICAL[cleaned];
  }

  // Try partial matching - check if any canonical ingredient is contained in cleaned string
  // This helps with cases like "chicken breast cubes" -> "chicken breast"
  const sortedCanonicals = Object.keys(INGREDIENT_MAP).sort((a, b) => b.length - a.length);
  for (const canonical of sortedCanonicals) {
    if (cleaned.includes(canonical)) {
      return canonical;
    }
  }

  // Also try matching variations
  for (const [variation, canonical] of Object.entries(VARIATION_TO_CANONICAL)) {
    if (cleaned.includes(variation) && variation.length > 3) {
      return canonical;
    }
  }

  // If not found in map, return the cleaned version
  return cleaned;
};

/**
 * Gets all canonical ingredient names from the map
 * Useful for providing a list of standard ingredients
 * @returns {string[]} - Array of canonical ingredient names
 */
export const getAllCanonicalIngredients = () => {
  return Object.keys(INGREDIENT_MAP).sort();
};

/**
 * Checks if an ingredient matches a canonical form or any of its variations
 * @param {string} ingredient - The ingredient to check
 * @param {string} canonical - The canonical ingredient name to match against
 * @returns {boolean} - True if ingredient matches the canonical form
 */
export const matchesCanonical = (ingredient, canonical) => {
  const normalized = normalizeIngredient(ingredient);
  return normalized === canonical;
};

/**
 * Extracts and normalizes all ingredients from recipe data
 * @param {Object} recipe - Recipe object with ingredients property
 * @returns {Set<string>} - Set of normalized canonical ingredient names
 */
export const extractNormalizedIngredients = (recipe) => {
  const normalized = new Set();

  if (recipe.ingredients) {
    Object.values(recipe.ingredients).forEach(section => {
      if (Array.isArray(section)) {
        section.forEach(ingredient => {
          const canonical = normalizeIngredient(ingredient);
          if (canonical.length > 2) {
            normalized.add(canonical);
          }
        });
      }
    });
  }

  return normalized;
};

export default {
  normalizeIngredient,
  getAllCanonicalIngredients,
  matchesCanonical,
  extractNormalizedIngredients,
};

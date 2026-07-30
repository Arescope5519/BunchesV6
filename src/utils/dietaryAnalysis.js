/**
 * FILENAME: src/utils/dietaryAnalysis.js
 * PURPOSE: Derive dietary tags + allergen flags from recipe ingredients.
 *
 * Everything here is keyword matching over ingredient lines - no network,
 * no storage. Dietary tags (Vegetarian, Vegan, Gluten-Free, Dairy-Free)
 * are COMPUTED at render time, never written to the database, so they can
 * never drift when a recipe is edited.
 *
 * Matching is deliberately conservative and results are always presented
 * as "may contain" / best-effort - hidden ingredients in compound products
 * (e.g. pesto, bouillon) can't be detected from names alone.
 */

// Each category: terms that flag it, and exception phrases that are
// stripped from the line BEFORE matching (so "almond milk" is not dairy,
// but "soy milk" still counts as soy because the exception only applies
// to the dairy category).
const CATEGORIES = {
  dairy: {
    terms: [
      'milk', 'butter', 'buttermilk', 'cheese', 'cream', 'yogurt', 'yoghurt',
      'ghee', 'whey', 'casein', 'custard', 'ice cream', 'half-and-half',
      'half and half', 'mascarpone', 'parmesan', 'mozzarella', 'cheddar',
      'feta', 'ricotta', 'brie', 'gouda', 'provolone', 'gruyere', 'asiago',
      'pecorino', 'halloumi', 'paneer', 'queso', 'creme fraiche',
      'crème fraîche',
    ],
    exceptions: [
      'almond milk', 'coconut milk', 'oat milk', 'soy milk', 'rice milk',
      'cashew milk', 'hemp milk', 'macadamia milk', 'pea milk',
      'peanut butter', 'almond butter', 'cashew butter', 'sunflower butter',
      'seed butter', 'nut butter', 'cocoa butter', 'shea butter',
      'apple butter', 'vegan butter', 'vegan cheese', 'vegan cream',
      'coconut cream', 'cream of tartar', 'dairy-free', 'dairy free',
      'non-dairy', 'nondairy',
    ],
  },
  eggs: {
    terms: ['egg', 'eggs', 'mayonnaise', 'mayo', 'meringue', 'hollandaise', 'aioli'],
    exceptions: ['egg-free', 'egg free', 'vegan mayo', 'vegan mayonnaise', 'eggless'],
  },
  gluten: {
    terms: [
      'flour', 'wheat', 'barley', 'rye', 'malt', 'semolina', 'couscous',
      'farro', 'spelt', 'bulgur', 'orzo', 'pasta', 'spaghetti', 'macaroni',
      'penne', 'fettuccine', 'linguine', 'lasagna', 'noodle', 'noodles',
      'ramen', 'udon', 'bread', 'breadcrumbs', 'bread crumbs', 'panko',
      'cracker', 'crackers', 'pretzel', 'pretzels', 'bun', 'buns', 'bagel',
      'pita', 'tortilla', 'tortillas', 'phyllo', 'filo', 'puff pastry',
      'pastry', 'pie crust', 'graham', 'soy sauce', 'hoisin', 'beer',
      'seitan', 'biscuit', 'croissant', 'baguette', 'crouton', 'croutons',
    ],
    exceptions: [
      'gluten-free flour', 'gluten free flour', 'gluten-free pasta',
      'gluten free pasta', 'gluten-free bread', 'gluten free bread',
      'gluten-free', 'gluten free', 'almond flour', 'coconut flour',
      'rice flour', 'oat flour', 'chickpea flour', 'tapioca flour',
      'cassava flour', 'buckwheat flour', 'corn flour', 'cornflour',
      'corn tortilla', 'corn tortillas', 'rice noodle', 'rice noodles',
      'glass noodle', 'glass noodles', 'tamari',
    ],
  },
  peanuts: {
    terms: ['peanut', 'peanuts', 'groundnut', 'groundnuts'],
    exceptions: ['peanut-free', 'peanut free'],
  },
  tree_nuts: {
    terms: [
      'almond', 'almonds', 'walnut', 'walnuts', 'pecan', 'pecans', 'cashew',
      'cashews', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts',
      'macadamia', 'brazil nut', 'brazil nuts', 'pine nut', 'pine nuts',
      'chestnut', 'chestnuts', 'nutella', 'marzipan', 'praline', 'nut', 'nuts',
    ],
    exceptions: ['nut-free', 'nut free', 'water chestnut', 'water chestnuts'],
  },
  fish: {
    terms: [
      'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout',
      'anchovy', 'anchovies', 'sardine', 'sardines', 'mackerel', 'snapper',
      'bass', 'catfish', 'swordfish', 'mahi', 'haddock', 'flounder',
      'worcestershire', 'caviar', 'roe',
    ],
    exceptions: [],
  },
  shellfish: {
    terms: [
      'shrimp', 'prawn', 'prawns', 'crab', 'lobster', 'scallop', 'scallops',
      'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'squid',
      'calamari', 'octopus', 'crawfish', 'crayfish', 'shellfish',
    ],
    exceptions: ['oyster mushroom', 'oyster mushrooms'],
  },
  soy: {
    terms: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari', 'soybean', 'soybeans'],
    exceptions: ['soy-free', 'soy free'],
  },
  sesame: {
    terms: ['sesame', 'tahini'],
    exceptions: [],
  },
  // Not an allergen - used for diet inference only
  meat: {
    terms: [
      'beef', 'steak', 'chicken', 'pork', 'bacon', 'ham', 'sausage',
      'turkey', 'lamb', 'veal', 'duck', 'prosciutto', 'pancetta', 'salami',
      'pepperoni', 'chorizo', 'meatball', 'meatballs', 'brisket', 'ribs',
      'hot dog', 'hot dogs', 'jerky', 'venison', 'gelatin', 'gelatine',
      'lard', 'bone broth', 'meat',
    ],
    exceptions: [
      'vegan chicken', 'vegan beef', 'vegan sausage', 'vegan bacon',
      'plant-based chicken', 'plant-based beef', 'plant-based sausage',
      'meat substitute', 'meatless',
    ],
  },
  honey: {
    terms: ['honey'],
    exceptions: [],
  },
};

// Allergen categories shown to users (order = display order)
export const ALLERGENS = [
  { key: 'dairy', label: 'Dairy' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'gluten', label: 'Gluten' },
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'tree_nuts', label: 'Tree Nuts' },
  { key: 'fish', label: 'Fish' },
  { key: 'shellfish', label: 'Shellfish' },
  { key: 'soy', label: 'Soy' },
  { key: 'sesame', label: 'Sesame' },
];

// Diets that can be derived from ingredients (order = display order)
export const DIETS = [
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'gluten_free', label: 'Gluten-Free' },
  { key: 'dairy_free', label: 'Dairy-Free' },
];

export const allergenLabel = (key) =>
  ALLERGENS.find(a => a.key === key)?.label || key;

export const dietLabel = (key) =>
  DIETS.find(d => d.key === key)?.label || key;

// Build regexes once at module load
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMPILED = {};
for (const [key, { terms, exceptions }] of Object.entries(CATEGORIES)) {
  COMPILED[key] = {
    termsRe: new RegExp(`\\b(?:${terms.map(escape).join('|')})\\b`, 'i'),
    exceptionsRe: exceptions.length
      ? new RegExp(exceptions.map(escape).join('|'), 'gi')
      : null,
  };
}

/**
 * Flatten a recipe's ingredients (object of sections / array / string)
 * into an array of plain text lines.
 */
export const getIngredientLines = (ingredients) => {
  if (!ingredients) return [];
  if (typeof ingredients === 'string') {
    // Might be JSON
    try {
      const parsed = JSON.parse(ingredients);
      return getIngredientLines(parsed);
    } catch {
      return ingredients.split('\n').filter(l => l.trim());
    }
  }
  if (Array.isArray(ingredients)) {
    return ingredients
      .map(i => (typeof i === 'string' ? i : i?.original || ''))
      .filter(Boolean);
  }
  if (typeof ingredients === 'object') {
    return Object.values(ingredients).flatMap(getIngredientLines);
  }
  return [];
};

/**
 * Which categories does a single ingredient line hit?
 * @returns {string[]} category keys (allergens + meat/honey)
 */
export const matchLine = (line) => {
  if (!line || typeof line !== 'string') return [];
  const hits = [];
  for (const [key, { termsRe, exceptionsRe }] of Object.entries(COMPILED)) {
    const cleaned = exceptionsRe ? line.replace(exceptionsRe, ' ') : line;
    if (termsRe.test(cleaned)) hits.push(key);
  }
  return hits;
};

/**
 * Which of the given allergen keys does this line contain?
 * Used for per-line highlighting in the ingredient list.
 */
export const lineAllergens = (line, allergenKeys) => {
  if (!allergenKeys || allergenKeys.length === 0) return [];
  return matchLine(line).filter(k => allergenKeys.includes(k));
};

/**
 * Analyze a whole recipe's ingredients.
 * @returns {{
 *   diets: string[],          // all satisfied diet keys (for filtering)
 *   displayDiets: string[],   // diet keys to show as chips (deduped: vegan hides vegetarian/dairy-free)
 *   allergens: string[],      // allergen keys detected
 * }}
 */
export const analyzeRecipe = (ingredients) => {
  const lines = getIngredientLines(ingredients);
  const found = new Set();
  for (const line of lines) {
    for (const key of matchLine(line)) found.add(key);
  }

  const allergens = ALLERGENS.map(a => a.key).filter(k => found.has(k));

  const diets = [];
  if (lines.length > 0) {
    const hasMeat = found.has('meat') || found.has('fish') || found.has('shellfish');
    const vegetarian = !hasMeat;
    const vegan = vegetarian && !found.has('dairy') && !found.has('eggs') && !found.has('honey');
    if (vegetarian) diets.push('vegetarian');
    if (vegan) diets.push('vegan');
    if (!found.has('gluten')) diets.push('gluten_free');
    if (!found.has('dairy')) diets.push('dairy_free');
  }

  // Vegan implies vegetarian + dairy-free; don't show redundant chips
  let displayDiets = diets;
  if (diets.includes('vegan')) {
    displayDiets = diets.filter(d => d !== 'vegetarian' && d !== 'dairy_free');
  }

  return { diets, displayDiets, allergens };
};

/**
 * Compare a recipe analysis against the user's dietary preferences.
 * @param {object} analysis - result of analyzeRecipe
 * @param {object} prefs - { diets: [dietKeys user follows], avoid: [allergenKeys user avoids] }
 * @returns {string[]} human-readable conflict strings, empty if no conflict
 */
export const getConflicts = (analysis, prefs) => {
  if (!analysis || !prefs) return [];
  const conflicts = [];
  for (const key of prefs.avoid || []) {
    if (analysis.allergens.includes(key)) {
      conflicts.push(`Contains ${allergenLabel(key).toLowerCase()}`);
    }
  }
  for (const key of prefs.diets || []) {
    // Only flag when the recipe has ingredients to judge (diets empty = unknown)
    if (analysis.diets.length > 0 && !analysis.diets.includes(key)) {
      conflicts.push(`Not ${dietLabel(key).toLowerCase()}`);
    }
  }
  return conflicts;
};

export default {
  ALLERGENS,
  DIETS,
  allergenLabel,
  dietLabel,
  getIngredientLines,
  matchLine,
  lineAllergens,
  analyzeRecipe,
  getConflicts,
};

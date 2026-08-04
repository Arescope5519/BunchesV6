/**
 * FILENAME: src/utils/autoTag.js
 * PURPOSE: High-confidence auto-tagging for newly created GLOBAL recipes.
 *
 * Runs ONCE when a global recipe row is created (createGlobalRecipe in
 * src/services/supabase/database.js) and the result is stored on
 * global_recipes.tags - the shared, unchanging version of the recipe.
 * Users add their own tags on top via user_recipes_v2.tags.
 *
 * Only rules that are near-certain are included here. Subjective tags
 * (Comfort Food, Kid-Friendly, Dinner...) are left for users.
 */

// Dish/meal tags matched against the TITLE only (title mentions are
// high-confidence; ingredient mentions are not - bacon in a salad
// doesn't make it a pork dish)
const TITLE_RULES = [
  { tag: 'Soup', re: /\b(soups?|stews?|chowder|bisque)\b/i },
  { tag: 'Salad', re: /\bsalads?\b/i },
  { tag: 'Pasta', re: /\b(pasta|spaghetti|lasagna|fettuccine|linguine|macaroni|penne|ravioli|gnocchi|carbonara|alfredo|mac and cheese|mac & cheese)\b/i },
  { tag: 'Chicken', re: /\bchicken\b/i },
  { tag: 'Beef', re: /\b(beef|steak|brisket|meatloaf)\b/i },
  { tag: 'Pork', re: /\b(pork|ham|carnitas|pulled pork)\b/i },
  { tag: 'Seafood', re: /\b(seafood|shrimp|salmon|fish|tuna|cod|tilapia|crab|lobster|scallops?|prawns?)\b/i },
  {
    tag: 'Dessert',
    re: /\b(dessert|cakes?|cookies?|brownies?|pies?|cheesecake|cupcakes?|pudding|ice cream|tarts?|muffins?|donuts?|doughnuts?|cobbler|fudge|macarons?)\b/i,
    // Savory dishes that borrow a dessert word. Apostrophes are matched
    // straight or curly since titles come from all over the web.
    except: new RegExp(
      '\\b(' + [
        // pies
        "(pot|shepherd[’']?s|cottage|pizza|meat|tamale|frito|cheeseburger|tomato|steak and kidney|chicken|beef|turkey) pies?",
        // cakes
        '(crab|fish|salmon|tuna|corn|potato|rice|hoe|johnny) ?cakes?',
        // puddings
        '(yorkshire|corn|black|blood) pudding',
        // other savory baked goods
        '(tomato|onion|savou?ry|spinach|mushroom) tarts?',
        '(corn|english|savou?ry) muffins?',
      ].join('|') + ')\\b',
      'gi'
    ),
  },
  { tag: 'Breakfast', re: /\b(breakfast|pancakes?|waffles?|oatmeal|granola|french toast|omelet(te)?s?|frittata|brunch)\b/i },
];

// Any of these means the dish is savory, so a stray dessert word in the
// title (pie, cake, pudding) should not add a Dessert tag.
const SAVORY_TAGS = ['Chicken', 'Beef', 'Pork', 'Seafood', 'Soup', 'Pasta', 'Salad'];

// Phrases where a category word means a different food entirely. The
// title is rewritten before any rule runs, so "chicken of the woods"
// reads as a mushroom and "chicken-fried steak" reads as beef.
const TITLE_NORMALIZERS = [
  [/\bchicken[-\s]?fried steak\b/gi, ' steak '],
  [/\bchicken of the woods\b/gi, ' mushroom '],
  [/\blobster mushrooms?\b/gi, ' mushroom '],
  [/\boyster mushrooms?\b/gi, ' mushroom '],
  [/\bbeef ?steak tomato(es)?\b/gi, ' tomato '],
  [/\bbeef tomato(es)?\b/gi, ' tomato '],
  [/\bcrab ?apples?\b/gi, ' apple '],
  [/\bswedish fish\b/gi, ' candy '],
  [/\bgoldfish\b/gi, ' cracker '],
  [/\bcrab ?grass\b/gi, ' weed '],
  [/\bwelsh (rarebit|rabbit)\b/gi, ' cheese toast '],
  [/\bmock (chicken|duck|meat)\b/gi, ' plant-based '],
];

// Appliance/style tags matched against title OR instructions
const METHOD_RULES = [
  { tag: 'Slow Cooker', re: /\b(slow[- ]cooker|crock[- ]?pot)\b/i },
  { tag: 'Instant Pot', re: /\b(instant[- ]pot|pressure[- ]cooker)\b/i },
  { tag: 'One-Pot', re: /\b(one[- ]pot|one[- ]pan|sheet[- ]pan)\b/i },
];

// Quick = total time 30 minutes or less (from real extracted times)
const QUICK_MAX_MINUTES = 30;

/**
 * Parse a duration into minutes. Handles ISO 8601 ("PT1H30M"), plain
 * numbers, and strings like "30 min" / "1 hr 15 min". Returns null if
 * unparseable.
 */
export const parseDurationMinutes = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'number' && isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (!s) return null;

  const iso = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) {
    return (
      parseInt(iso[1] || '0', 10) * 60 +
      parseInt(iso[2] || '0', 10) +
      Math.round(parseInt(iso[3] || '0', 10) / 60)
    );
  }

  let minutes = 0;
  let matched = false;
  const hours = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hours) { minutes += parseFloat(hours[1]) * 60; matched = true; }
  const mins = s.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
  if (mins) { minutes += parseInt(mins[1], 10); matched = true; }
  if (matched) return Math.round(minutes);

  // Bare number string
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return null;
};

/**
 * Get high-confidence tags for a recipe. Pure function - safe to call on
 * any recipe shape (extracted, manual, imported).
 * @returns {string[]} tag names from the predefined set
 */
export const getHighConfidenceTags = (recipe) => {
  if (!recipe) return [];
  const tags = new Set();

  // Rewrite known false-friend phrases before matching anything
  let title = String(recipe.title || '');
  for (const [pattern, replacement] of TITLE_NORMALIZERS) {
    title = title.replace(pattern, replacement);
  }

  // Dessert is decided last: a savory dish that happens to be called a
  // pie or a cake should not pick it up
  let dessertMatched = false;
  for (const rule of TITLE_RULES) {
    const text = rule.except ? title.replace(rule.except, ' ') : title;
    if (!rule.re.test(text)) continue;
    if (rule.tag === 'Dessert') {
      dessertMatched = true;
    } else {
      tags.add(rule.tag);
    }
  }
  if (dessertMatched && !SAVORY_TAGS.some(t => tags.has(t))) {
    tags.add('Dessert');
  }

  // Instructions text for method/appliance detection
  let instructionsText = '';
  const instructions = recipe.instructions;
  if (Array.isArray(instructions)) {
    instructionsText = instructions.filter(i => typeof i === 'string').join('\n');
  } else if (typeof instructions === 'string') {
    instructionsText = instructions;
  }
  const methodText = `${title}\n${instructionsText}`;
  for (const rule of METHOD_RULES) {
    if (rule.re.test(methodText)) tags.add(rule.tag);
  }

  // Quick - only when we actually know the time
  const total = parseDurationMinutes(recipe.total_time || recipe.totalTime);
  const prep = parseDurationMinutes(recipe.prep_time || recipe.prepTime);
  const cook = parseDurationMinutes(recipe.cook_time || recipe.cookTime);
  let knownMinutes = null;
  if (total != null && total > 0) {
    knownMinutes = total;
  } else if (prep != null || cook != null) {
    knownMinutes = (prep || 0) + (cook || 0);
    if (knownMinutes === 0) knownMinutes = null;
  }
  if (knownMinutes != null && knownMinutes <= QUICK_MAX_MINUTES) {
    tags.add('Quick');
  }

  return Array.from(tags);
};

export default { getHighConfidenceTags, parseDurationMinutes };

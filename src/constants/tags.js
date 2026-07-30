/**
 * FILENAME: src/constants/tags.js
 * PURPOSE: Predefined recipe tags, organized by category.
 *
 * NOTE: Vegetarian / Vegan / Gluten-Free / Dairy-Free are NOT in this list
 * anymore - those are dietary facts derived automatically from ingredients
 * (see src/utils/dietaryAnalysis.js) and shown as auto-chips. Manual tags
 * are for things ingredients can't tell you: meal type, occasion, diets
 * that depend on portions (Keto), etc. Users can also create custom tags.
 */

export const TAG_CATEGORIES = [
  {
    name: 'Diet',
    tags: ['Keto', 'Low-Carb', 'Paleo', 'High-Protein', 'Low-Sodium', 'Low-Sugar'],
  },
  {
    name: 'Meal',
    tags: ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Appetizer'],
  },
  {
    name: 'Dish Type',
    tags: ['Soup', 'Salad', 'Pasta', 'Seafood', 'Chicken', 'Beef', 'Pork'],
  },
  {
    name: 'Convenience',
    tags: ['Quick', 'Easy', 'Meal Prep', 'One-Pot', 'Slow Cooker', 'Instant Pot'],
  },
  {
    name: 'Occasion',
    tags: ['Holiday', 'Party', 'Comfort Food', 'Healthy', 'Kid-Friendly'],
  },
];

// Flat list for backward compatibility with existing callers
export const PREDEFINED_TAGS = TAG_CATEGORIES.flatMap(category =>
  category.tags.map(name => ({ name, category: category.name }))
);

// Get predefined tag names for autocomplete / custom-tag detection
export const getPredefinedTagNames = () => {
  return PREDEFINED_TAGS.map(t => t.name);
};

/**
 * Most-used tags across the user's recipes (predefined or custom),
 * case-insensitive, most frequent first. Only tags used on 2+ recipes
 * qualify - a tag used once isn't "frequent".
 */
export const getFrequentTags = (recipes, limit = 8) => {
  const counts = new Map(); // lowercase -> { display, count }
  (recipes || []).forEach(recipe => {
    if (recipe.deletedAt) return;
    (recipe.tags || []).forEach(tag => {
      const key = tag.toLowerCase();
      const entry = counts.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(key, { display: tag, count: 1 });
      }
    });
  });
  return Array.from(counts.values())
    .filter(e => e.count >= 2)
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .slice(0, limit)
    .map(e => e.display);
};

export default {
  TAG_CATEGORIES,
  PREDEFINED_TAGS,
  getPredefinedTagNames,
  getFrequentTags,
};

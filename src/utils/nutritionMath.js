/**
 * FILENAME: src/utils/nutritionMath.js
 * PURPOSE: Aggregate eating-habit nutrition from meal events.
 *
 * Sums SOURCE-PROVIDED per-serving nutrition (the same pass-through
 * values RecipeDetail displays - nothing is ever computed from
 * ingredients) across meal_events x servings_consumed. Takeout with a
 * USER-STATED calories-per-serving (cook_events.takeout_calories)
 * contributes calories; takeout without it and recipes without
 * nutrition data count toward coverage ("N of M meals had data") but
 * contribute nothing to totals.
 *
 * STORE COMPLIANCE: shipping these summaries flips the Play health
 * declaration to "Nutrition and weight management" - see the health
 * section in CLAUDE.md before touching scope here.
 */

// Display units per nutrient; values are normalized into these
export const TRACKED_NUTRIENTS = [
  { key: 'calories',            label: 'Calories', unit: '' },
  { key: 'proteinContent',      label: 'Protein',  unit: 'g', alt: ['protein'] },
  { key: 'carbohydrateContent', label: 'Carbs',    unit: 'g', alt: ['carbs', 'carbohydrates'] },
  { key: 'fatContent',          label: 'Fat',      unit: 'g', alt: ['fat'] },
  { key: 'sugarContent',        label: 'Sugar',    unit: 'g', alt: ['sugar'] },
  { key: 'fiberContent',        label: 'Fiber',    unit: 'g', alt: ['fiber'] },
  { key: 'sodiumContent',       label: 'Sodium',   unit: 'mg', alt: ['sodium'] },
];

/**
 * "649 kcal" -> 649; "36 g" -> 36; "1285 mg" -> 1285 (or 1.2 g ->
 * 1200 when the target unit is mg, and mg -> g the other way).
 * Returns null for unparseable input.
 */
export const parseNutrientValue = (raw, targetUnit = '') => {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  const m = s.match(/(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  let value = parseFloat(m[1].replace(',', '.'));
  if (!isFinite(value)) return null;
  const hasMg = /\bmg\b/.test(s);
  const hasG = !hasMg && /\bg\b/.test(s);
  if (targetUnit === 'mg' && hasG) value *= 1000;
  if (targetUnit === 'g' && hasMg) value /= 1000;
  return value;
};

/**
 * Per-serving numbers for one recipe's nutrition object, keyed by
 * TRACKED_NUTRIENTS keys. Null when the recipe has no usable data.
 */
export const perServingNutrition = (nutrition) => {
  if (!nutrition || typeof nutrition !== 'object') return null;
  const out = {};
  let any = false;
  for (const n of TRACKED_NUTRIENTS) {
    let raw = nutrition[n.key];
    if (raw == null && n.alt) {
      for (const a of n.alt) {
        if (nutrition[a] != null) { raw = nutrition[a]; break; }
      }
    }
    const value = parseNutrientValue(raw, n.unit);
    if (value != null) { out[n.key] = value; any = true; }
  }
  return any ? out : null;
};

/**
 * Aggregate meal events into daily + overall nutrition.
 * @param mealEvents rows from getMealEvents (meal_date, cook_event_id, servings_consumed)
 * @param cookEventsById map id -> cook_event (recipe_id, is_takeout, takeout_name)
 * @param recipesById map recipe id -> recipe (uses recipe.nutrition)
 * @returns {
 *   byDate: { [date]: { totals, mealsCounted, mealsTotal } },
 *   totals, mealsCounted, mealsTotal,
 *   perRecipe: [{ recipeId, title, calories, meals, servings }] sorted by calories desc
 * }
 */
export const aggregateNutrition = (mealEvents, cookEventsById, recipesById) => {
  const byDate = {};
  const totals = {};
  const perRecipeMap = new Map();
  let mealsCounted = 0;
  let mealsTotal = 0;

  for (const meal of mealEvents || []) {
    const date = meal.meal_date;
    if (!byDate[date]) byDate[date] = { totals: {}, mealsCounted: 0, mealsTotal: 0 };
    const day = byDate[date];
    day.mealsTotal += 1;
    mealsTotal += 1;

    const cook = cookEventsById[meal.cook_event_id];
    let per = null;
    let entryKey = null;
    let entryTitle = null;
    if (cook && cook.is_takeout) {
      const cals = Number(cook.takeout_calories);
      if (isFinite(cals) && cals > 0) {
        per = { calories: cals };
        entryTitle = cook.takeout_name || 'Takeout';
        entryKey = `takeout:${entryTitle.toLowerCase()}`;
      }
    } else if (cook) {
      const recipe = recipesById[cook.recipe_id];
      per = recipe ? perServingNutrition(recipe.nutrition) : null;
      if (per) {
        entryKey = recipe.id;
        entryTitle = recipe.title || 'Untitled';
      }
    }
    if (!per) continue;

    const servings = Number(meal.servings_consumed) || 1;
    day.mealsCounted += 1;
    mealsCounted += 1;
    for (const [key, value] of Object.entries(per)) {
      const add = value * servings;
      day.totals[key] = (day.totals[key] || 0) + add;
      totals[key] = (totals[key] || 0) + add;
    }

    const prev = perRecipeMap.get(entryKey) || {
      recipeId: entryKey, title: entryTitle, calories: 0, meals: 0, servings: 0,
    };
    prev.calories += (per.calories || 0) * servings;
    prev.meals += 1;
    prev.servings += servings;
    perRecipeMap.set(entryKey, prev);
  }

  const perRecipe = [...perRecipeMap.values()].sort((a, b) => b.calories - a.calories);
  return { byDate, totals, mealsCounted, mealsTotal, perRecipe };
};

/** Round for display: calories whole, grams one decimal when small */
export const formatNutrientValue = (value, unit) => {
  if (value == null) return '-';
  const rounded = unit === '' || unit === 'mg' || value >= 100
    ? Math.round(value)
    : Math.round(value * 10) / 10;
  return `${rounded}${unit ? ` ${unit}` : ''}`;
};

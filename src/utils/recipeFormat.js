/**
 * FILENAME: src/utils/recipeFormat.js
 * PURPOSE: Shared display formatting for recipe metadata (durations, servings,
 * nutrition). Used by BOTH the extraction preview (SaveRecipeScreen) and the
 * saved recipe view (RecipeDetail) so they always render identically.
 */

/**
 * Format an ISO 8601 duration (e.g. "PT1H30M") or plain "30 minutes" into "1h 30 min".
 * Returns "?" for empty/zero durations.
 */
export const formatDuration = (raw) => {
  if (!raw) return '?';
  const s = String(raw).trim();
  if (!s) return '?';

  // ISO 8601 pattern PT#H#M#S
  const iso = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) {
    const hours = parseInt(iso[1] || '0', 10);
    const minutes = parseInt(iso[2] || '0', 10);
    const seconds = parseInt(iso[3] || '0', 10);
    if (hours === 0 && minutes === 0 && seconds === 0) return '?';
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  // Already-formatted plain string: swap trailing " m" for " min" but leave "min", "hr", etc alone.
  return s
    .replace(/(\d+)\s*m\b(?!in)/gi, '$1 min')
    .replace(/(\d+)\s*h\b(?!r)/gi, '$1h');
};

/**
 * Format a servings field: strips duplicate values like "12,12" → "12"
 * and "12,12 people" → "12 people".
 */
export const formatServings = (raw) => {
  if (!raw) return '?';
  const s = String(raw).trim();
  if (!s) return '?';
  // Ignore ISO-duration junk that got saved in the wrong field
  if (/^PT0+[HMS]?$/i.test(s)) return '?';

  // Detect "N,N" or "N, N unit" duplicates from JSON-LD arrays: keep the first + any unit
  //   "12,12"          → "12"
  //   "12,12 people"   → "12 people"
  //   "4, 4 servings"  → "4 servings"
  const dup = s.match(/^(\d+(?:\.\d+)?)\s*[,;/]\s*\1\b(.*)$/);
  if (dup) {
    return `${dup[1]}${dup[2]}`.trim();
  }

  // Dedupe comma-separated values that are all pure numbers, e.g. "4, 6" (a range)
  const parts = s.split(/[,;/]/).map(p => p.trim()).filter(Boolean);
  const allNumbers = parts.length > 1 && parts.every(p => /^\d+(?:\.\d+)?$/.test(p));
  if (allNumbers) {
    const unique = [...new Set(parts)];
    return unique.join(unique.length > 1 ? '-' : '');
  }

  return s;
};

/**
 * Extract numeric value from a nutrition string like "300 calories" or "40g" → 300.
 * Handles nested { value, unitText } shapes from some schema.org fields.
 * Returns null if no number found.
 */
export const parseNutritionValue = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'object' && raw !== null) {
    raw = raw.value ?? raw.amount ?? raw.calories ?? raw['@value'];
    if (raw == null) return null;
  }
  const s = String(raw);
  const match = s.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
};

/**
 * Extract unit from a nutrition string. Returns the unit part (e.g. "g", "mg", "cal") or empty.
 */
export const parseNutritionUnit = (raw) => {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null) {
    return raw.unitText || raw.unit || '';
  }
  const s = String(raw).replace(/[\d.]+/, '').trim();
  if (/calorie/i.test(s)) return 'cal';
  if (/^g$/i.test(s) || /grams?/i.test(s)) return 'g';
  if (/^mg$/i.test(s) || /milligram/i.test(s)) return 'mg';
  return s.split(/\s+/)[0] || '';
};

/**
 * Scale and format a nutrition value.
 * If the raw value can't be parsed, returns the raw string (or null for objects).
 */
export const scaleNutrition = (raw, factor) => {
  const value = parseNutritionValue(raw);
  if (value == null) {
    if (typeof raw === 'string' && raw.trim()) return raw;
    return null;
  }
  const unit = parseNutritionUnit(raw);
  const scaled = value * factor;
  const rounded = scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
  return unit ? `${rounded} ${unit}` : `${rounded}`;
};

export const NUTRIENT_KEYS = [
  { key: 'calories',            label: 'Calories' },
  { key: 'fatContent',          label: 'Fat',      alt: ['fat'] },
  { key: 'saturatedFatContent', label: 'Sat. Fat', alt: ['saturatedFat'] },
  { key: 'carbohydrateContent', label: 'Carbs',    alt: ['carbs', 'carbohydrates'] },
  { key: 'fiberContent',        label: 'Fiber',    alt: ['fiber'] },
  { key: 'sugarContent',        label: 'Sugar',    alt: ['sugar'] },
  { key: 'proteinContent',      label: 'Protein',  alt: ['protein'] },
  { key: 'sodiumContent',       label: 'Sodium',   alt: ['sodium'] },
  { key: 'cholesterolContent',  label: 'Cholest.', alt: ['cholesterol'] },
];

/**
 * Build displayable nutrition items from a schema.org-ish nutrition object.
 * @returns Array<{label, value}> - empty array if nothing displayable
 */
export const buildNutritionItems = (nutrition, scaleFactor = 1) => {
  if (!nutrition || typeof nutrition !== 'object') return [];
  return NUTRIENT_KEYS
    .map(nk => {
      let raw = nutrition[nk.key];
      if (raw == null && nk.alt) {
        for (const a of nk.alt) {
          if (nutrition[a] != null) { raw = nutrition[a]; break; }
        }
      }
      if (raw == null) return null;
      const scaled = scaleNutrition(raw, scaleFactor);
      return scaled ? { label: nk.label, value: scaled } : null;
    })
    .filter(Boolean);
};

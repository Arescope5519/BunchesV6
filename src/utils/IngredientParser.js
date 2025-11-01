/**
 * FILENAME: src/utils/IngredientParser.js
 * PURPOSE: Parse ingredients AND scale them anywhere in recipe text
 * FIXED: Uses marker-based approach (no lookbehind) for React Native compatibility
 * DEPENDENCIES: None
 */

// ========== UNIT CONVERSION TABLES ==========

const VOLUME_CONVERSIONS = {
  // All conversions to milliliters (ml)
  'cup': 236.588,
  'cups': 236.588,
  'c': 236.588,
  'tablespoon': 14.787,
  'tablespoons': 14.787,
  'tbsp': 14.787,
  'tbs': 14.787,
  'tb': 14.787,
  'teaspoon': 4.929,
  'teaspoons': 4.929,
  'tsp': 4.929,
  'ts': 4.929,
  'fluid ounce': 29.574,
  'fluid ounces': 29.574,
  'fl oz': 29.574,
  'fl. oz': 29.574,
  'ounce': 29.574,
  'ounces': 29.574,
  'oz': 29.574,
  'pint': 473.176,
  'pints': 473.176,
  'pt': 473.176,
  'quart': 946.353,
  'quarts': 946.353,
  'qt': 946.353,
  'gallon': 3785.41,
  'gallons': 3785.41,
  'gal': 3785.41,
  'milliliter': 1,
  'milliliters': 1,
  'ml': 1,
  'liter': 1000,
  'liters': 1000,
  'l': 1000,
};

const WEIGHT_CONVERSIONS = {
  // All conversions to grams (g)
  'pound': 453.592,
  'pounds': 453.592,
  'lb': 453.592,
  'lbs': 453.592,
  'ounce': 28.3495,
  'ounces': 28.3495,
  'oz': 28.3495,
  'gram': 1,
  'grams': 1,
  'g': 1,
  'kilogram': 1000,
  'kilograms': 1000,
  'kg': 1000,
};

const METRIC_VOLUME_UNITS = ['ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters'];
const METRIC_WEIGHT_UNITS = ['g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms'];

// ========== FRACTION UTILITIES ==========

const UNICODE_FRACTIONS = {
  '1/4': '¼',
  '1/2': '½',
  '3/4': '¾',
  '1/3': '⅓',
  '2/3': '⅔',
  '1/8': '⅛',
  '3/8': '⅜',
  '5/8': '⅝',
  '7/8': '⅞',
};

/**
 * Convert fraction string to decimal
 */
function fractionToDecimal(fraction) {
  const parts = fraction.split('/');
  if (parts.length !== 2) return null;
  return parseFloat(parts[0]) / parseFloat(parts[1]);
}

/**
 * Convert decimal to fraction string
 */
function decimalToFraction(decimal) {
  // Check common fractions first
  const commonFractions = {
    0.25: '1/4',
    0.5: '1/2',
    0.75: '3/4',
    0.333: '1/3',
    0.667: '2/3',
    0.125: '1/8',
    0.375: '3/8',
    0.625: '5/8',
    0.875: '7/8',
  };

  for (const [dec, frac] of Object.entries(commonFractions)) {
    if (Math.abs(decimal - parseFloat(dec)) < 0.01) {
      return frac;
    }
  }

  return null;
}

/**
 * Format number as mixed fraction with unicode
 */
function formatQuantity(num) {
  if (!num || num === 0) return '';

  const whole = Math.floor(num);
  const decimal = num - whole;

  const fraction = decimalToFraction(decimal);

  if (whole === 0 && fraction) {
    return UNICODE_FRACTIONS[fraction] || fraction;
  } else if (whole > 0 && fraction) {
    return `${whole} ${UNICODE_FRACTIONS[fraction] || fraction}`;
  } else if (whole > 0 && decimal === 0) {
    return whole.toString();
  } else {
    // Round to 2 decimal places
    return num.toFixed(2).replace(/\.0+$/, '');
  }
}

// ========== INGREDIENT PARSING ==========

/**
 * Parse ingredient string into components
 * Returns: { quantity, unit, ingredient, original, parsed }
 */
export function parseIngredient(ingredientString) {
  const original = ingredientString.trim();

  // Regex patterns for ingredient parsing
  const patterns = [
    // "2 1/2 cups flour" or "2½ cups flour"
    /^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+)?\s*(cup|cups|tablespoon|tablespoons|tbsp|tbs|tb|teaspoon|teaspoons|tsp|ts|ounce|ounces|oz|pound|pounds|lb|lbs|gram|grams|g|kilogram|kilograms|kg|milliliter|milliliters|ml|liter|liters|l|pint|pints|pt|quart|quarts|qt|gallon|gallons|gal|fluid ounce|fluid ounces|fl oz|fl\. oz)s?\s+(.+)/i,

    // "1/2 cup flour" or "½ cup flour"
    /^([¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+)\s*(cup|cups|tablespoon|tablespoons|tbsp|tbs|tb|teaspoon|teaspoons|tsp|ts|ounce|ounces|oz|pound|pounds|lb|lbs|gram|grams|g|kilogram|kilograms|kg|milliliter|milliliters|ml|liter|liters|l|pint|pints|pt|quart|quarts|qt|gallon|gallons|gal|fluid ounce|fluid ounces|fl oz|fl\. oz)s?\s+(.+)/i,

    // "2 cups flour" (no fraction)
    /^(\d+(?:\.\d+)?)\s*(cup|cups|tablespoon|tablespoons|tbsp|tbs|tb|teaspoon|teaspoons|tsp|ts|ounce|ounces|oz|pound|pounds|lb|lbs|gram|grams|g|kilogram|kilograms|kg|milliliter|milliliters|ml|liter|liters|l|pint|pints|pt|quart|quarts|qt|gallon|gallons|gal|fluid ounce|fluid ounces|fl oz|fl\. oz)s?\s+(.+)/i,

    // "2 eggs" (number + ingredient, no unit)
    /^(\d+(?:\.\d+)?)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);

    if (match) {
      let quantity = 0;
      let unit = '';
      let ingredient = '';

      if (match.length === 5) {
        // Pattern with whole + fraction + unit
        const whole = parseFloat(match[1]);
        const fractionPart = match[2];
        unit = match[3].toLowerCase();
        ingredient = match[4];

        let fraction = 0;
        if (fractionPart) {
          // Check if unicode fraction
          const unicodeFrac = Object.entries(UNICODE_FRACTIONS).find(
            ([key, val]) => val === fractionPart
          );
          if (unicodeFrac) {
            fraction = fractionToDecimal(unicodeFrac[0]);
          } else if (fractionPart.includes('/')) {
            fraction = fractionToDecimal(fractionPart);
          }
        }

        quantity = whole + (fraction || 0);
      } else if (match.length === 4) {
        // Pattern with fraction/number + unit
        const firstPart = match[1];

        // Check if unicode fraction
        const unicodeFrac = Object.entries(UNICODE_FRACTIONS).find(
          ([key, val]) => val === firstPart
        );
        if (unicodeFrac) {
          quantity = fractionToDecimal(unicodeFrac[0]);
        } else if (firstPart.includes('/')) {
          quantity = fractionToDecimal(firstPart);
        } else {
          quantity = parseFloat(firstPart);
        }

        unit = match[2].toLowerCase();
        ingredient = match[3];
      } else if (match.length === 3) {
        // Pattern with just number + ingredient
        quantity = parseFloat(match[1]);
        ingredient = match[2];
        unit = ''; // No unit
      }

      return {
        quantity,
        unit,
        ingredient: ingredient.trim(),
        original,
        parsed: true,
      };
    }
  }

  // Could not parse - return original
  return {
    quantity: 0,
    unit: '',
    ingredient: original,
    original,
    parsed: false,
  };
}

/**
 * Scale ingredient by multiplier
 * Scales both the main quantity AND any quantities in the ingredient name (like "(190g)")
 */
export function scaleIngredient(parsedIngredient, multiplier) {
  if (!parsedIngredient.parsed || parsedIngredient.quantity === 0) {
    // For unparsed ingredients, scale the entire text
    return scaleIngredientsInText(parsedIngredient.original, multiplier);
  }

  // For parsed ingredients:
  // 1. Scale the main quantity manually
  const scaledQuantity = parsedIngredient.quantity * multiplier;
  const formattedQuantity = formatQuantity(scaledQuantity);

  // 2. Scale ONLY the ingredient name (not the whole string)
  //    This catches parenthetical amounts like "((190g))" → "((380g))"
  const scaledIngredientName = scaleIngredientsInText(parsedIngredient.ingredient, multiplier);

  // 3. Rebuild the string
  if (parsedIngredient.unit) {
    return `${formattedQuantity} ${parsedIngredient.unit} ${scaledIngredientName}`;
  } else {
    return `${formattedQuantity} ${scaledIngredientName}`;
  }
}

/**
 * Convert ingredient to different unit system
 */
export function convertIngredientUnits(parsedIngredient, toMetric = true) {
  if (!parsedIngredient.parsed || !parsedIngredient.unit || parsedIngredient.quantity === 0) {
    return parsedIngredient.original;
  }

  const unit = parsedIngredient.unit.toLowerCase();
  const isMetric = METRIC_VOLUME_UNITS.includes(unit) || METRIC_WEIGHT_UNITS.includes(unit);

  // Already in target system
  if ((toMetric && isMetric) || (!toMetric && !isMetric)) {
    return parsedIngredient.original;
  }

  let convertedQuantity;
  let convertedUnit;

  // Volume conversion
  if (VOLUME_CONVERSIONS[unit]) {
    const ml = parsedIngredient.quantity * VOLUME_CONVERSIONS[unit];

    if (toMetric) {
      // Convert to metric
      if (ml >= 1000) {
        convertedQuantity = ml / 1000;
        convertedUnit = 'l';
      } else {
        convertedQuantity = ml;
        convertedUnit = 'ml';
      }
    } else {
      // Convert to imperial (from metric)
      // Find best imperial unit
      if (ml >= 3785) {
        convertedQuantity = ml / 3785.41;
        convertedUnit = 'gallon';
      } else if (ml >= 946) {
        convertedQuantity = ml / 946.353;
        convertedUnit = 'quart';
      } else if (ml >= 473) {
        convertedQuantity = ml / 473.176;
        convertedUnit = 'pint';
      } else if (ml >= 236) {
        convertedQuantity = ml / 236.588;
        convertedUnit = 'cup';
      } else if (ml >= 14.7) {
        convertedQuantity = ml / 14.787;
        convertedUnit = 'tbsp';
      } else {
        convertedQuantity = ml / 4.929;
        convertedUnit = 'tsp';
      }
    }
  }
  // Weight conversion
  else if (WEIGHT_CONVERSIONS[unit]) {
    const grams = parsedIngredient.quantity * WEIGHT_CONVERSIONS[unit];

    if (toMetric) {
      // Convert to metric
      if (grams >= 1000) {
        convertedQuantity = grams / 1000;
        convertedUnit = 'kg';
      } else {
        convertedQuantity = grams;
        convertedUnit = 'g';
      }
    } else {
      // Convert to imperial (from metric)
      if (grams >= 453) {
        convertedQuantity = grams / 453.592;
        convertedUnit = 'lb';
      } else {
        convertedQuantity = grams / 28.3495;
        convertedUnit = 'oz';
      }
    }
  } else {
    // Unknown unit, return original
    return parsedIngredient.original;
  }

  const formattedQuantity = formatQuantity(convertedQuantity);
  return `${formattedQuantity} ${convertedUnit} ${parsedIngredient.ingredient}`;
}

// ========== NEW: TEXT INGREDIENT DETECTION & SCALING ==========

/**
 * 🆕 FIXED: Detect and scale ingredients ANYWHERE in text (like instructions)
 * Uses MARKER-BASED approach (no lookbehind) for React Native compatibility
 * 
 * Strategy:
 * 1. Find and replace quantities in parentheses first, use unique markers
 * 2. Find and replace regular quantities (avoiding markers)
 * 3. Restore markers to actual parentheses
 * 
 * Examples:
 * - "Add 2 cups flour" → "Add 4 cups flour" (2× scaling)
 * - "Add flour (120g)" → "Add flour (240g)" (2× scaling, no double parens!)
 * - "Use (2 cups) milk" → "Use (4 cups) milk" (2× scaling in parens)
 */
export function scaleIngredientsInText(text, multiplier) {
  if (!text || multiplier === 1) return text;

  // Use unique markers that won't appear in recipes
  // Include "X" at the end to prevent word boundaries before digits
  const OPEN_MARKER = '<<<PARENX';
  const CLOSE_MARKER = 'XPAREN>>>';

  // Build unit patterns
  const unitPattern = '(?:cup|cups|tablespoon|tablespoons|tbsp|tbs|tb|teaspoon|teaspoons|tsp|ts|ounce|ounces|oz|pound|pounds|lb|lbs|gram|grams|g|kilogram|kilograms|kg|milliliter|milliliters|ml|liter|liters|l|pint|pints|pt|quart|quarts|qt|gallon|gallons|gal|fluid ounce|fluid ounces|fl oz|fl\\. oz)';
  
  // IMPORTANT: Only match TEXT fractions (1/2), NOT unicode fractions (½)
  // This prevents re-scaling already-scaled ingredients
  const fractionPattern = '(?:\\d+\\/\\d+)';

  let result = text;

  // ========== STEP 1: HANDLE PARENTHETICAL QUANTITIES ==========
  // Replace parentheses with markers while scaling the content

  // Pattern 0a: Parentheses with whole + fraction + unit: "(2 1/2 cups)" or "((190g))"
  // Handles single, double, or triple parentheses
  const pattern0a = new RegExp(
    `\\(+(\\d+)\\s+(${fractionPattern})\\s+(${unitPattern})(?:s)?\\)+`,
    'gi'
  );
  
  result = result.replace(pattern0a, (match, whole, fraction, unit) => {
    let quantity = parseFloat(whole);

    if (fraction.includes('/')) {
      const frac = fractionToDecimal(fraction);
      if (frac) quantity += frac;
    }

    const scaled = quantity * multiplier;
    const formatted = formatQuantity(scaled);

    // Count original opening parens to preserve them
    const openCount = (match.match(/^\(+/)[0] || '').length;
    const openMarker = OPEN_MARKER.repeat(openCount);
    const closeMarker = CLOSE_MARKER.repeat(openCount);

    return `${openMarker}${formatted} ${unit}${closeMarker}`;
  });

  // Pattern 0b: Parentheses with just fraction + unit: "(1/2 cup)" or "((1/2 cup))"
  // Handles single, double, or triple parentheses
  const pattern0b = new RegExp(
    `\\(+(${fractionPattern})\\s+(${unitPattern})(?:s)?\\)+`,
    'gi'
  );

  result = result.replace(pattern0b, (match, fraction, unit) => {
    let quantity = 0;

    if (fraction.includes('/')) {
      quantity = fractionToDecimal(fraction);
    }

    if (!quantity) return match;

    const scaled = quantity * multiplier;
    const formatted = formatQuantity(scaled);

    // Count original opening parens to preserve them
    const openCount = (match.match(/^\(+/)[0] || '').length;
    const openMarker = OPEN_MARKER.repeat(openCount);
    const closeMarker = CLOSE_MARKER.repeat(openCount);

    return `${openMarker}${formatted} ${unit}${closeMarker}`;
  });

  // Pattern 0c: Parentheses with just number + unit: "(120g)" or "((190g))"
  // Handles single, double, or triple parentheses
  const pattern0c = new RegExp(
    `\\(+(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?:s)?\\)+`,
    'gi'
  );

  result = result.replace(pattern0c, (match, number, unit) => {
    const quantity = parseFloat(number);
    const scaled = quantity * multiplier;
    const formatted = formatQuantity(scaled);

    // Count original opening parens to preserve them
    const openCount = (match.match(/^\(+/)[0] || '').length;
    const openMarker = OPEN_MARKER.repeat(openCount);
    const closeMarker = CLOSE_MARKER.repeat(openCount);

    // Include the space in the markers so Pattern 3 won't see "380 g" as "380g"
    return `${openMarker}${formatted} ${unit}${closeMarker}`;
  });

  // ========== STEP 2: HANDLE REGULAR (NON-PARENTHETICAL) QUANTITIES ==========
  // These patterns naturally won't match the markers since they don't contain digits

  // Pattern 1: Whole + fraction + unit: "2 1/2 cups"
  // Only matches text fractions, not unicode (prevents re-scaling)
  const pattern1 = new RegExp(
    `\\b(\\d+)\\s+(${fractionPattern})\\s+(${unitPattern})(?:s)?\\b`,
    'gi'
  );

  result = result.replace(pattern1, (match, whole, fraction, unit) => {
    // Skip if this is inside our markers
    if (match.includes(OPEN_MARKER) || match.includes(CLOSE_MARKER)) {
      return match;
    }

    let quantity = parseFloat(whole);

    if (fraction.includes('/')) {
      const frac = fractionToDecimal(fraction);
      if (frac) quantity += frac;
    }

    const scaled = quantity * multiplier;
    const formatted = formatQuantity(scaled);

    return `${formatted} ${unit}`;
  });

  // Pattern 2: Just fraction + unit: "1/2 cup"
  // Only matches text fractions, not unicode (prevents re-scaling)
  const pattern2 = new RegExp(
    `\\b(${fractionPattern})\\s+(${unitPattern})(?:s)?\\b`,
    'gi'
  );

  result = result.replace(pattern2, (match, fraction, unit) => {
    if (match.includes(OPEN_MARKER) || match.includes(CLOSE_MARKER)) {
      return match;
    }

    let quantity = 0;

    if (fraction.includes('/')) {
      quantity = fractionToDecimal(fraction);
    }

    if (!quantity) return match;

    const scaled = quantity * multiplier;
    const formatted = formatQuantity(scaled);

    return `${formatted} ${unit}`;
  });

  // Pattern 3: Whole number + unit: "2 cups" or "120g"
  const pattern3 = new RegExp(
    `\\b(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?:s)?\\b`,
    'gi'
  );

  result = result.replace(pattern3, (match, number, unit) => {
    // Skip if inside markers
    if (match.includes(OPEN_MARKER) || match.includes(CLOSE_MARKER)) {
      return match;
    }

    const quantity = parseFloat(number);
    const scaled = quantity * multiplier;
    const formatted = formatQuantity(scaled);

    return `${formatted} ${unit}`;
  });

  // Pattern 4: Common ingredient words: "2 eggs", "3 onions"
  const commonIngredientWords = /\b(\d+(?:\.\d+)?)\s+(egg|eggs|onion|onions|clove|cloves|potato|potatoes|carrot|carrots|tomato|tomatoes|apple|apples|banana|bananas)\b/gi;

  result = result.replace(commonIngredientWords, (match, quantity, ingredient) => {
    if (match.includes(OPEN_MARKER) || match.includes(CLOSE_MARKER)) {
      return match;
    }

    const num = parseFloat(quantity);
    const scaled = num * multiplier;
    const formatted = formatQuantity(scaled);

    return `${formatted} ${ingredient}`;
  });

  // ========== STEP 3: RESTORE MARKERS TO PARENTHESES ==========
  result = result.replace(new RegExp(OPEN_MARKER, 'g'), '(');
  result = result.replace(new RegExp(CLOSE_MARKER, 'g'), ')');

  return result;
}

/**
 * Parse all ingredients in a recipe
 */
export function parseRecipeIngredients(ingredients) {
  const parsed = {};

  for (const [section, items] of Object.entries(ingredients)) {
    parsed[section] = items.map(item => parseIngredient(item));
  }

  return parsed;
}

/**
 * Scale all ingredients in a recipe
 */
export function scaleRecipeIngredients(parsedIngredients, multiplier) {
  const scaled = {};

  for (const [section, items] of Object.entries(parsedIngredients)) {
    scaled[section] = items.map(item => scaleIngredient(item, multiplier));
  }

  return scaled;
}

/**
 * 🆕 Scale all instructions by detecting ingredients in text
 */
export function scaleRecipeInstructions(instructions, multiplier) {
  if (!instructions || !Array.isArray(instructions)) {
    return instructions;
  }

  return instructions.map(instruction => scaleIngredientsInText(instruction, multiplier));
}

/**
 * Convert all ingredients in a recipe to different unit system
 */
export function convertRecipeIngredients(parsedIngredients, toMetric = true) {
  const converted = {};

  for (const [section, items] of Object.entries(parsedIngredients)) {
    converted[section] = items.map(item => convertIngredientUnits(item, toMetric));
  }

  return converted;
}

export default {
  parseIngredient,
  scaleIngredient,
  convertIngredientUnits,
  parseRecipeIngredients,
  scaleRecipeIngredients,
  scaleRecipeInstructions,
  scaleIngredientsInText,
  convertRecipeIngredients,
  formatQuantity,
};

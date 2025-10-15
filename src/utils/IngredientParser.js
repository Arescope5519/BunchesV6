/**
 * FILENAME: src/utils/IngredientParser.js
 * PURPOSE: Parse ingredients to extract quantities, units, and scale recipes
 * FEATURES: Ingredient parsing, recipe scaling, unit conversion
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
    return num.toFixed(2).replace(/\.?0+$/, '');
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
 */
export function scaleIngredient(parsedIngredient, multiplier) {
  if (!parsedIngredient.parsed || parsedIngredient.quantity === 0) {
    return parsedIngredient.original;
  }

  const scaledQuantity = parsedIngredient.quantity * multiplier;
  const formattedQuantity = formatQuantity(scaledQuantity);

  if (parsedIngredient.unit) {
    return `${formattedQuantity} ${parsedIngredient.unit} ${parsedIngredient.ingredient}`;
  } else {
    return `${formattedQuantity} ${parsedIngredient.ingredient}`;
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
  convertRecipeIngredients,
  formatQuantity,
};
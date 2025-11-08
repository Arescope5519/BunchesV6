/**
 * RecipeExtractor.js - Standalone JavaScript Recipe Extractor
 * Direct port of hierarchical_recipe_extractor.py
 * NO SERVER REQUIRED - runs directly in React Native
 *
 * Save this as: BunchesV6/RecipeExtractor.js
 */

import { decode } from 'html-entities';

export class RecipeExtractor {
  constructor() {
    this.stats = {
      json_ld: 0,
      microdata: 0,
      wp_plugin: 0,
      site_specific: 0,
      ai_fallback: 0,
      failed: 0
    };

    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    this.wpPlugins = {
      wprm: {
        markers: ['wprm-recipe-container', 'wprm-recipe-ingredients'],
        name: 'WordPress Recipe Maker'
      }
    };

    this.siteExtractors = {
      'allrecipes.com': this.extractAllRecipes.bind(this)
    };
  }

  /**
   * Main extraction method - tries all 5 tiers
   */
  async extract(url) {
    try {
      console.log('🔍 Fetching HTML from:', url);
      const html = await this.fetchHTML(url);

      if (!html) {
        this.stats.failed++;
        return { success: false, error: 'Failed to fetch HTML', data: null };
      }

      console.log('✅ HTML fetched, length:', html.length);

      // Tier 1: JSON-LD (60% of sites)
      console.log('🔍 Trying JSON-LD extraction...');
      let result = this.extractJSONLD(html, url);
      if (result && result.title) {
        this.stats.json_ld++;
        console.log('✅ JSON-LD extraction successful');
        return { success: true, data: result, source: 'JSON-LD' };
      }

      // Tier 2: Microdata (15% of sites)
      console.log('🔍 Trying Microdata extraction...');
      result = this.extractMicrodata(html, url);
      if (result && result.title) {
        this.stats.microdata++;
        console.log('✅ Microdata extraction successful');
        return { success: true, data: result, source: 'Microdata' };
      }

      // Tier 3: WordPress Plugins (15% of sites)
      console.log('🔍 Trying WordPress extraction...');
      result = this.extractWordPress(html, url);
      if (result && result.title) {
        this.stats.wp_plugin++;
        console.log('✅ WordPress extraction successful');
        return { success: true, data: result, source: 'WordPress' };
      }

      // Tier 4: Site-Specific (10% of sites)
      console.log('🔍 Trying site-specific extraction...');
      const domain = new URL(url).hostname.replace('www.', '');
      if (this.siteExtractors[domain]) {
        result = this.siteExtractors[domain](html, url);
        if (result && result.title) {
          this.stats.site_specific++;
          console.log('✅ Site-specific extraction successful');
          return { success: true, data: result, source: 'Site-Specific' };
        }
      }

      // No extraction worked
      console.log('❌ All extraction methods failed');
      this.stats.failed++;
      return {
        success: false,
        error: 'Unable to extract recipe from this URL',
        data: null
      };

    } catch (error) {
      console.error('💥 Extraction error:', error);
      this.stats.failed++;
      return { success: false, error: error.message, data: null };
    }
  }

  /**
   * Fetch HTML from URL
   */
  async fetchHTML(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Fetch error:', error);
      return null;
    }
  }

  /**
   * TIER 1: Extract from JSON-LD structured data
   * Handles 60% of recipe sites
   */
  extractJSONLD(html, url) {
    try {
      const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
      const matches = html.matchAll(scriptRegex);

      for (const match of matches) {
        try {
          let jsonText = match[1];
          if (!jsonText || !jsonText.trim()) continue;

          jsonText = decode(jsonText);
          const data = JSON.parse(jsonText);

          const recipe = this.findRecipeInJSON(data);
          if (recipe) {
            return this.parseJSONLDRecipe(recipe, url);
          }
        } catch (e) {
          continue;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Recursively find Recipe object in JSON-LD data
   */
  findRecipeInJSON(data) {
    if (!data) return null;

    if (typeof data === 'object' && !Array.isArray(data)) {
      const type = data['@type'];

      if (type === 'Recipe') return data;
      if (Array.isArray(type) && type.includes('Recipe')) return data;

      if (data['@graph'] && Array.isArray(data['@graph'])) {
        for (const item of data['@graph']) {
          const found = this.findRecipeInJSON(item);
          if (found) return found;
        }
      }

      for (const value of Object.values(data)) {
        if (typeof value === 'object') {
          const found = this.findRecipeInJSON(value);
          if (found) return found;
        }
      }
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        const found = this.findRecipeInJSON(item);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Parse JSON-LD recipe into standardized format
   */
  parseJSONLDRecipe(recipe, url) {
    const ingredients = this.parseIngredientsJSONLD(recipe);
    const instructions = this.parseInstructionsJSONLD(recipe);
    const prepTime = this.parseDuration(recipe.prepTime);
    const cookTime = this.parseDuration(recipe.cookTime);
    const totalTime = this.parseDuration(recipe.totalTime);
    const imageUrl = this.extractImageURL(recipe.image);

    let nutrition = recipe.nutrition || null;
    if (nutrition && nutrition['@type']) {
      delete nutrition['@type'];
    }

    return {
      title: recipe.name || '',
      ingredients: ingredients,
      instructions: instructions,
      prep_time: prepTime,
      cook_time: cookTime,
      total_time: totalTime,
      servings: recipe.recipeYield ? String(recipe.recipeYield) : null,
      nutrition: nutrition,
      image: imageUrl,
      extraction_method: 'json_ld',
      confidence: 0.99,
      source_url: url
    };
  }

  /**
   * Parse ingredients, detecting subsections
   */
  parseIngredientsJSONLD(recipe) {
    const ingredients = { main: [] };
    const rawIngredients = recipe.recipeIngredient || [];
    let currentSection = 'main';

    for (const ing of rawIngredients) {
      const cleanedIng = this.cleanIngredientText(ing);

      if (this.isSectionHeader(cleanedIng)) {
        currentSection = cleanedIng.replace(/:/g, '').trim();
        ingredients[currentSection] = [];
      } else {
        if (!ingredients[currentSection]) {
          ingredients[currentSection] = [];
        }
        if (cleanedIng) {
          ingredients[currentSection].push(cleanedIng);
        }
      }
    }

    return ingredients;
  }

  /**
   * Parse instructions from JSON-LD format
   */
  parseInstructionsJSONLD(recipe) {
    const instructions = [];
    const rawInstructions = recipe.recipeInstructions || [];

    for (const inst of rawInstructions) {
      if (typeof inst === 'string') {
        const text = inst.trim();
        if (text) instructions.push(text);
      } else if (typeof inst === 'object') {
        if (inst['@type'] === 'HowToSection') {
          const items = inst.itemListElement || [];
          for (const item of items) {
            if (typeof item === 'object') {
              const stepText = item.text || item.name || item.description;
              if (stepText) instructions.push(String(stepText).trim());
            } else if (typeof item === 'string') {
              instructions.push(item.trim());
            }
          }
        }
        else if (inst['@type'] === 'HowToStep') {
          const stepText = inst.text || inst.name || inst.description;
          if (stepText) instructions.push(String(stepText).trim());
        }
        else {
          const text = inst.text || inst.name || inst.description;
          if (text) instructions.push(String(text).trim());
        }
      }
    }

    const cleaned = [];
    for (let instruction of instructions) {
      instruction = instruction.replace(/^(Step\s+)?\d+[.:\s]+/i, '').trim();
      if (instruction && instruction.length > 10) {
        cleaned.push(instruction);
      }
    }

    return cleaned;
  }

  /**
   * TIER 2: Extract from Microdata markup
   * Handles 15% of sites
   */
  extractMicrodata(html, url) {
    try {
      const recipeRegex = /<[^>]+itemtype=["'][^"']*schema\.org\/Recipe["'][^>]*>/i;
      if (!recipeRegex.test(html)) return null;

      const containerMatch = html.match(/<[^>]+itemtype=["'][^"']*schema\.org\/Recipe["'][^>]*>[\s\S]*?<\/[^>]+>/i);
      if (!containerMatch) return null;

      const container = containerMatch[0];

      const title = this.getMicrodataProp(container, 'name');
      const ingredients = this.parseIngredientsMicrodata(container);

      const instructions = [];
      const instRegex = /<[^>]+itemprop=["']recipeInstructions["'][^>]*>(.*?)<\/[^>]+>/gis;
      const instMatches = container.matchAll(instRegex);
      for (const match of instMatches) {
        const text = this.stripHTML(match[1]).trim();
        if (text) instructions.push(text);
      }

      const prepTime = this.parseDuration(this.getMicrodataProp(container, 'prepTime'));
      const cookTime = this.parseDuration(this.getMicrodataProp(container, 'cookTime'));
      const totalTime = this.parseDuration(this.getMicrodataProp(container, 'totalTime'));
      const servings = this.getMicrodataProp(container, 'recipeYield');
      const imageUrl = this.getMicrodataProp(container, 'image');

      if (!title || Object.keys(ingredients).length === 0) return null;

      return {
        title: title,
        ingredients: ingredients,
        instructions: instructions,
        prep_time: prepTime,
        cook_time: cookTime,
        total_time: totalTime,
        servings: servings,
        image: imageUrl,
        extraction_method: 'microdata',
        confidence: 0.95,
        source_url: url
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse microdata ingredients with subsection support
   */
  parseIngredientsMicrodata(container) {
    const ingredients = { main: [] };
    let currentSection = 'main';

    const ingRegex = /<[^>]+itemprop=["']recipeIngredient["'][^>]*>(.*?)<\/[^>]+>/gis;
    const matches = container.matchAll(ingRegex);

    for (const match of matches) {
      const text = this.cleanIngredientText(this.stripHTML(match[1]));

      if (this.isSectionHeader(text)) {
        currentSection = text.replace(/:/g, '').trim();
        ingredients[currentSection] = [];
      } else if (text) {
        if (!ingredients[currentSection]) {
          ingredients[currentSection] = [];
        }
        ingredients[currentSection].push(text);
      }
    }

    return ingredients;
  }

  /**
   * TIER 3: Extract from WordPress plugins
   * Handles 15% of sites
   */
  extractWordPress(html, url) {
    if (html.includes('wprm-recipe-container') || html.includes('wprm-recipe')) {
      return this.extractWPRM(html, url);
    }
    return null;
  }

  /**
   * Extract from WordPress Recipe Maker plugin
   */
  extractWPRM(html, url) {
    try {
      const containerMatch = html.match(/<div[^>]+class=["'][^"']*wprm-recipe-container[^"']*["'][^>]*>[\s\S]*?<\/div>/i);
      if (!containerMatch) return null;

      const container = containerMatch[0];

      const titleMatch = container.match(/<[^>]+class=["'][^"']*wprm-recipe-name[^"']*["'][^>]*>(.*?)<\/[^>]+>/is);
      const title = titleMatch ? this.stripHTML(titleMatch[1]).trim() : '';

      const ingredients = { main: [] };
      const groupRegex = /<div[^>]+class=["'][^"']*wprm-recipe-ingredient-group[^"']*["'][^>]*>(.*?)<\/div>/gis;
      const groups = container.matchAll(groupRegex);

      for (const group of groups) {
        const groupContent = group[1];

        const headerMatch = groupContent.match(/<[^>]+class=["'][^"']*wprm-recipe-ingredient-group-name[^"']*["'][^>]*>(.*?)<\/[^>]+>/is);
        const section = headerMatch ? this.stripHTML(headerMatch[1]).trim() : 'main';

        if (!ingredients[section]) {
          ingredients[section] = [];
        }

        const ingRegex = /<[^>]+class=["'][^"']*wprm-recipe-ingredient["'][^>]*>(.*?)<\/[^>]+>/gis;
        const ings = groupContent.matchAll(ingRegex);

        for (const ing of ings) {
          const text = this.cleanIngredientText(this.stripHTML(ing[1]));
          if (text) ingredients[section].push(text);
        }
      }

      const instructions = [];
      const instRegex = /<[^>]+class=["'][^"']*wprm-recipe-instruction["'][^>]*>(.*?)<\/[^>]+>/gis;
      const insts = container.matchAll(instRegex);

      for (const inst of insts) {
        const text = this.stripHTML(inst[1]).trim();
        if (text) instructions.push(text);
      }

      // Extract image
      let imageUrl = null;
      const imgMatch = container.match(/<img[^>]+class=["'][^"']*wprm-recipe-image[^"']*["'][^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }

      if (!title || Object.keys(ingredients).length === 0) return null;

      return {
        title: title,
        ingredients: ingredients,
        instructions: instructions,
        image: imageUrl,
        extraction_method: 'wp_plugin_wprm',
        confidence: 0.90,
        source_url: url
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * TIER 4: Site-specific extractor for AllRecipes
   */
  extractAllRecipes(html, url) {
    try {
      let titleMatch = html.match(/<h1[^>]+class=["'][^"']*article-heading[^"']*["'][^>]*>(.*?)<\/h1>/is);
      if (!titleMatch) {
        titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
      }
      const title = titleMatch ? this.stripHTML(titleMatch[1]).trim() : '';

      const ingredients = { main: [] };
      let currentSection = 'main';

      const ingContainerMatch = html.match(/<ul[^>]+class=["'][^"']*(mntl-structured-ingredients|ingredient-list|mm-recipes-structured-ingredients)[^"']*["'][^>]*>(.*?)<\/ul>/is);

      if (ingContainerMatch) {
        const container = ingContainerMatch[2];
        const liRegex = /<li[^>]*>(.*?)<\/li>/gis;
        const lis = container.matchAll(liRegex);

        for (const li of lis) {
          const text = this.cleanIngredientText(this.stripHTML(li[1]));

          if (this.isSectionHeader(text)) {
            currentSection = text.replace(/:/g, '').trim();
            ingredients[currentSection] = [];
          } else if (text) {
            if (!ingredients[currentSection]) {
              ingredients[currentSection] = [];
            }
            ingredients[currentSection].push(text);
          }
        }
      }

      const instructions = [];
      const instContainerMatch = html.match(/<ol[^>]+class=["'][^"']*(instructions|mntl-sc-block-group)[^"']*["'][^>]*>(.*?)<\/ol>/is);

      if (instContainerMatch) {
        const container = instContainerMatch[2];
        const liRegex = /<li[^>]*>(.*?)<\/li>/gis;
        const lis = container.matchAll(liRegex);

        for (const li of lis) {
          let text = li[1];

          const pMatch = text.match(/<p[^>]*>(.*?)<\/p>/is);
          if (pMatch) {
            text = pMatch[1];
          }

          text = this.stripHTML(text).trim();
          if (text && text.length > 10) {
            instructions.push(text);
          }
        }
      }

      let prepTime = null;
      let cookTime = null;
      let totalTime = null;
      let servings = null;

      const detailsMatch = html.match(/<div[^>]+class=["'][^"']*(recipe-meta|recipe-details)[^"']*["'][^>]*>(.*?)<\/div>/is);
      if (detailsMatch) {
        const details = detailsMatch[2];
        const itemRegex = /<div[^>]+class=["'][^"']*mntl-recipe-details__item[^"']*["'][^>]*>(.*?)<\/div>/gis;
        const items = details.matchAll(itemRegex);

        for (const item of items) {
          const content = item[1];
          const labelMatch = content.match(/<div[^>]+class=["'][^"']*mntl-recipe-details__label[^"']*["'][^>]*>(.*?)<\/div>/is);
          const valueMatch = content.match(/<div[^>]+class=["'][^"']*mntl-recipe-details__value[^"']*["'][^>]*>(.*?)<\/div>/is);

          if (labelMatch && valueMatch) {
            const label = this.stripHTML(labelMatch[1]).toLowerCase();
            const value = this.stripHTML(valueMatch[1]).trim();

            if (label.includes('prep')) prepTime = value;
            else if (label.includes('cook')) cookTime = value;
            else if (label.includes('total')) totalTime = value;
            else if (label.includes('servings') || label.includes('yield')) servings = value;
          }
        }
      }

      // Extract image
      let imageUrl = null;
      const imgMatch = html.match(/<img[^>]+class=["'][^"']*(primary-image|recipe-image|hero-photo)[^"']*["'][^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        imageUrl = imgMatch[2];
      }

      if (!title || !ingredients.main || ingredients.main.length === 0) return null;

      return {
        title: title,
        ingredients: ingredients,
        instructions: instructions,
        prep_time: prepTime,
        cook_time: cookTime,
        total_time: totalTime,
        servings: servings,
        image: imageUrl,
        extraction_method: 'site_specific_allrecipes',
        confidence: 0.85,
        source_url: url
      };
    } catch (error) {
      console.error('AllRecipes extraction error:', error);
      return null;
    }
  }

  /**
   * Helper: Extract image URL from various formats
   */
  extractImageURL(imageData) {
    if (!imageData) return null;

    // String URL
    if (typeof imageData === 'string') {
      return imageData.startsWith('http') ? imageData : null;
    }

    // Array of images - take the first one
    if (Array.isArray(imageData)) {
      if (imageData.length === 0) return null;
      return this.extractImageURL(imageData[0]);
    }

    // ImageObject with url property
    if (typeof imageData === 'object') {
      if (imageData.url) return this.extractImageURL(imageData.url);
      if (imageData.contentUrl) return imageData.contentUrl;
      if (imageData['@url']) return imageData['@url'];
    }

    return null;
  }

  /**
   * Helper: Clean ingredient text
   */
  cleanIngredientText(text) {
    if (!text) return '';
    text = decode(text);
    text = text.replace(/\s+/g, ' ');
    return text.trim();
  }

  /**
   * Helper: Detect if text is a subsection header
   */
  isSectionHeader(text) {
    if (!text) return false;

    const patterns = [
      /^For the .+:?$/i,
      /^.+:$/,
      /^(Sauce|Filling|Topping|Crust|Dough|Marinade|Garnish|Coating)/i,
      /^\*\*.+\*\*$/
    ];

    text = text.trim();
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Helper: Parse ISO 8601 duration
   */
  parseDuration(duration) {
    if (!duration) return null;

    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (match) {
      const hours = match[1];
      const minutes = match[2];

      if (hours && minutes) return `${hours}h ${minutes}m`;
      if (hours) return `${hours}h`;
      if (minutes) return `${minutes}m`;
    }

    return duration;
  }

  /**
   * Helper: Get microdata property value
   */
  getMicrodataProp(html, prop) {
    const contentMatch = html.match(new RegExp(`<[^>]+itemprop=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'));
    if (contentMatch) return contentMatch[1];

    const datetimeMatch = html.match(new RegExp(`<[^>]+itemprop=["']${prop}["'][^>]+datetime=["']([^"']+)["']`, 'i'));
    if (datetimeMatch) return datetimeMatch[1];

    const textMatch = html.match(new RegExp(`<[^>]+itemprop=["']${prop}["'][^>]*>(.*?)<\/[^>]+>`, 'is'));
    if (textMatch) return this.stripHTML(textMatch[1]).trim();

    return null;
  }

  /**
   * Helper: Strip HTML tags
   */
  stripHTML(html) {
    if (!html) return '';
    return html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get extraction statistics
   */
  getStats() {
    const total = Object.values(this.stats).reduce((a, b) => a + b, 0);
    if (total === 0) return this.stats;

    const percentages = {};
    for (const [key, value] of Object.entries(this.stats)) {
      percentages[key] = `${((value / total) * 100).toFixed(1)}%`;
    }

    return {
      ...this.stats,
      percentages
    };
  }
}

export default RecipeExtractor;
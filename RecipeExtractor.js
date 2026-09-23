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
      generic_html: 0,
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
   * Main extraction method. Every tier runs and the FITTEST result wins:
   * a tier can "succeed" with garbage (every ingredient glued into one
   * line, the whole method as one step), so returning the first tier
   * that produced a title shipped that garbage straight to the user.
   * Each candidate is normalized (blobs split back into lines/steps),
   * scored on how much it reads like a real recipe, and the best one
   * is returned.
   */
  async extract(url) {
    try {
      const html = await this.fetchHTML(url);

      if (!html) {
        this.stats.failed++;
        return { success: false, error: 'Failed to fetch HTML', data: null };
      }

      const candidates = [];

      let result = this.extractJSONLD(html, url);
      if (result && result.title) {
        candidates.push({ data: result, source: 'JSON-LD', statKey: 'json_ld' });
      }

      result = this.extractMicrodata(html, url);
      if (result && result.title) {
        candidates.push({ data: result, source: 'Microdata', statKey: 'microdata' });
      }

      result = this.extractWordPress(html, url);
      if (result && result.title) {
        candidates.push({ data: result, source: 'WordPress', statKey: 'wp_plugin' });
      }

      const domain = new URL(url).hostname.replace('www.', '');
      if (this.siteExtractors[domain]) {
        result = this.siteExtractors[domain](html, url);
        if (result && result.title) {
          candidates.push({ data: result, source: 'Site-Specific', statKey: 'site_specific' });
        }
      }

      result = this.extractGenericHTML(html, url);
      if (result && result.title) {
        candidates.push({ data: result, source: 'Generic HTML', statKey: 'generic_html' });
      }

      if (candidates.length === 0) {
        this.stats.failed++;
        return {
          success: false,
          error: 'Unable to extract recipe from this URL',
          data: null
        };
      }

      const scored = candidates.map(c => {
        const data = this.normalizeCandidate(c.data);
        return { ...c, data, fitness: this.scoreCandidate(data) };
      });
      // Stable sort: on equal fitness the earlier (historically more
      // reliable) tier wins
      scored.sort((a, b) => b.fitness - a.fitness);
      const best = scored[0];

      console.log(
        '[RecipeExtractor] fitness:',
        scored.map(s => `${s.source}=${Math.round(s.fitness)}`).join(' ')
      );

      this.stats[best.statKey]++;
      delete best.data._repairs;
      return { success: true, data: best.data, source: best.source, fitness: best.fitness };

    } catch (error) {
      this.stats.failed++;
      return { success: false, error: error.message, data: null };
    }
  }

  // ============================================================
  // Fitness selection helpers
  // ============================================================

  /**
   * Flatten an ingredients value (object of sections or array) into a
   * plain list of lines for scoring.
   */
  flattenIngredientLines(ingredients) {
    if (!ingredients) return [];
    if (Array.isArray(ingredients)) return ingredients.map(String);
    if (typeof ingredients === 'object') return Object.values(ingredients).flat().map(String);
    return [String(ingredients)];
  }

  /**
   * Does this line read like a real ingredient ("2 cups flour")?
   */
  looksLikeIngredient(line) {
    const text = String(line).trim();
    if (!text) return false;
    if (/^[\d¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/.test(text)) return true;
    return /\b(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|grams?|kg|ml|liters?|litres?|cloves?|pinch|dash|cans?|packages?|sticks?|slices?|to taste)\b/i.test(text);
  }

  /**
   * Repair a candidate before scoring: a single giant ingredient line
   * or instruction step is the whole list/method glued together, so
   * split it back apart. Well-formed candidates pass through untouched.
   */
  normalizeCandidate(data) {
    const normalized = { ...data };
    let repairs = 0;

    const src = normalized.ingredients;
    const sections =
      src && typeof src === 'object' && !Array.isArray(src)
        ? src
        : { main: Array.isArray(src) ? src : (src ? [String(src)] : []) };
    const ingredients = {};
    let ingredientsIn = 0;
    let ingredientsOut = 0;
    for (const [section, value] of Object.entries(sections)) {
      const lines = Array.isArray(value) ? value : [String(value)];
      ingredientsIn += lines.length;
      const out = [];
      for (const line of lines) {
        out.push(...this.splitIngredientBlob(String(line)));
      }
      ingredientsOut += out.length;
      if (out.length) ingredients[section] = out;
    }
    normalized.ingredients = Object.keys(ingredients).length ? ingredients : { main: [] };
    if (ingredientsOut > ingredientsIn) repairs++;

    let steps = normalized.instructions;
    if (typeof steps === 'string') steps = [steps];
    if (!Array.isArray(steps)) steps = [];
    const outSteps = [];
    // A lone entry IS the blob signature - split it far more eagerly
    // than a long step inside an otherwise-normal list
    const stepThreshold = steps.length === 1 ? 200 : 400;
    for (const step of steps) {
      outSteps.push(...this.splitInstructionBlob(String(step), stepThreshold));
    }
    if (outSteps.length > steps.length) repairs++;
    normalized.instructions = outSteps;

    // How many fields arrived as glued-together blobs that needed
    // splitting - a trust signal for scoring, stripped before return
    normalized._repairs = repairs;
    return normalized;
  }

  /**
   * Split an ingredient line that is really a whole list in one string.
   * Newlines split unconditionally; beyond that, a 120+ char line is
   * broken where a new quantity starts right after a word, and the
   * split only sticks when the pieces mostly read as ingredients.
   */
  splitIngredientBlob(line) {
    const text = line.trim();
    if (!text) return [];
    if (/\n/.test(text)) {
      return text.split(/\n+/).flatMap(part => this.splitIngredientBlob(part));
    }
    if (text.length <= 120) return [text];

    const marked = text.replace(/([a-z)\].%])[ \t]+(?=[\d¼½¾⅓⅔⅛⅜⅝⅞])/gi, '$1\n');
    const parts = marked.split('\n').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const quantified = parts.filter(p => this.looksLikeIngredient(p)).length;
      if (quantified / parts.length >= 0.6) return parts;
    }
    return [text];
  }

  /**
   * Split an instruction step that is really the whole method in one
   * string. Newlines split unconditionally; a 400+ char step is broken
   * into sentences, gluing fragments (stray numbers, lowercase
   * continuations) back onto the previous step.
   */
  splitInstructionBlob(step, threshold = 400) {
    const text = step.trim();
    if (!text) return [];
    if (/\n/.test(text)) {
      return text
        .split(/\n+/)
        .map(part => part.trim())
        .filter(Boolean)
        .flatMap(part => this.splitInstructionBlob(part, threshold));
    }
    if (text.length <= threshold) return [text];

    const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*/g);
    if (!sentences || sentences.length < 3) return [text];

    const steps = [];
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      const fragment = sentence.length < 30 || /^[a-z]/.test(sentence);
      if (fragment && steps.length > 0) {
        steps[steps.length - 1] += ` ${sentence}`;
      } else {
        steps.push(sentence);
      }
    }
    return steps.length >= 2 ? steps : [text];
  }

  /**
   * Fitness: how much does this candidate read like a real recipe?
   * Rewards many distinct ingredient lines (most of them quantified),
   * a sane number of reasonably sized steps, and completeness; punishes
   * the blob signatures (one line, or lines/steps far too long).
   */
  scoreCandidate(data) {
    const lines = this.flattenIngredientLines(data.ingredients).filter(l => l.trim());
    const instructions = (Array.isArray(data.instructions) ? data.instructions : [])
      .filter(s => String(s).trim());
    let score = 0;

    score += Math.min(lines.length, 20) * 2;
    if (lines.length > 0) {
      const quantified = lines.filter(l => this.looksLikeIngredient(l)).length;
      score += (quantified / lines.length) * 20;
    } else {
      score -= 20;
    }
    if (lines.length === 1) score -= 10;
    if (lines.some(l => l.length > 200)) score -= 15;

    score += Math.min(instructions.length, 15) * 2;
    if (instructions.length === 0) score -= 15;
    if (instructions.length === 1) score -= 8;
    if (instructions.some(s => s.length > 900)) score -= 15;
    const avg = instructions.length
      ? instructions.reduce((sum, s) => sum + s.length, 0) / instructions.length
      : 0;
    if (avg >= 30 && avg <= 600) score += 10;

    if (data.image) score += 3;
    if (data.prep_time || data.cook_time || data.total_time) score += 2;
    if (data.servings) score += 1;

    // A candidate whose fields arrived glued together and had to be
    // split heuristically is less trustworthy than one that came out
    // clean - the repair is best-effort, not ground truth
    score -= (data._repairs || 0) * 8;

    // Structured-data confidence only breaks near-ties
    score += (data.confidence || 0) * 4;

    return score;
  }

  /**
   * Fetch HTML from URL
   */
  async fetchHTML(url) {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
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
    // A single-string value would otherwise iterate character by character
    let rawIngredients = recipe.recipeIngredient || [];
    if (typeof rawIngredients === 'string') rawIngredients = [rawIngredients];
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
    // A single-string value would otherwise iterate character by character
    let rawInstructions = recipe.recipeInstructions || [];
    if (typeof rawInstructions === 'string') rawInstructions = [rawInstructions];

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
   * TIER 5: Generic HTML fallback - a heading named "Ingredients" /
   * "Directions" followed by list items. Catches sites (e.g. raos.com)
   * whose structured data is broken but whose visible markup is clean.
   * Scored like every other candidate, so it only wins when it actually
   * reads better.
   */
  extractGenericHTML(html, url) {
    try {
      const rawIngredients = this.listItemsAfterHeading(html, /^ingredients\b/i);
      const instructions = this.listItemsAfterHeading(
        html,
        /^(directions|instructions|method|steps|preparation)\b/i
      ).filter(step => step.length > 3);

      if (rawIngredients.length < 2 || instructions.length < 2) return null;

      const ingredients = { main: [] };
      let currentSection = 'main';
      for (const item of rawIngredients) {
        if (this.isSectionHeader(item)) {
          currentSection = item.replace(/:/g, '').trim();
          if (!ingredients[currentSection]) ingredients[currentSection] = [];
        } else {
          if (!ingredients[currentSection]) ingredients[currentSection] = [];
          ingredients[currentSection].push(item);
        }
      }

      let title = '';
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      if (ogTitle) title = decode(ogTitle[1]).split('|')[0].trim();
      if (!title) {
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (h1) title = this.stripHTML(h1[1]);
      }
      if (!title) return null;

      let imageUrl = null;
      const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (ogImage) imageUrl = ogImage[1];

      return {
        title: title,
        ingredients: ingredients,
        instructions: instructions,
        prep_time: null,
        cook_time: null,
        total_time: null,
        servings: null,
        image: imageUrl,
        extraction_method: 'generic_html',
        confidence: 0.5,
        source_url: url
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * The innermost list items that follow a heading whose text matches
   * the pattern, up to the next heading. Innermost only, so a wrapper
   * <li> holding a nested <ul> doesn't swallow its children.
   */
  listItemsAfterHeading(html, headingPattern) {
    const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    for (const match of html.matchAll(headingRegex)) {
      const headingText = this.stripHTML(match[1]);
      if (!headingPattern.test(headingText)) continue;

      const rest = html.slice(match.index + match[0].length);
      const nextHeading = rest.search(/<h[1-6][^>]*>/i);
      const segment = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

      const items = [];
      const liRegex = /<li[^>]*>((?:(?!<\/?li)[\s\S])*?)<\/li>/gi;
      for (const li of segment.matchAll(liRegex)) {
        const text = this.cleanIngredientText(this.stripHTML(li[1]));
        if (text) items.push(text);
      }
      if (items.length) return items;
    }
    return [];
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
      // The old non-greedy match stopped at the FIRST </div>, truncating
      // the recipe to almost nothing. WPRM classes namespace everything,
      // so scanning from the container onward is safe.
      const idx = html.search(/class=["'][^"']*wprm-recipe-container/i);
      if (idx === -1) return null;

      const container = html.slice(idx);

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

      // Group markup missing or oddly nested? Fall back to the flat
      // per-item class WPRM puts on every ingredient li
      if (!Object.values(ingredients).some(list => list.length > 0)) {
        const liRegex = /<li[^>]+class=["'][^"']*wprm-recipe-ingredient(?!-)[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
        for (const m of container.matchAll(liRegex)) {
          const text = this.cleanIngredientText(this.stripHTML(m[1]));
          if (text) ingredients.main.push(text);
        }
      }

      const instructions = [];
      const instRegex = /<[^>]+class=["'][^"']*wprm-recipe-instruction["'][^>]*>(.*?)<\/[^>]+>/gis;
      const insts = container.matchAll(instRegex);

      for (const inst of insts) {
        const text = this.stripHTML(inst[1]).trim();
        if (text) instructions.push(text);
      }

      if (instructions.length === 0) {
        const liRegex = /<li[^>]+class=["'][^"']*wprm-recipe-instruction(?!-)[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
        for (const m of container.matchAll(liRegex)) {
          const text = this.stripHTML(m[1]).trim();
          if (text) instructions.push(text);
        }
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
      return null;
    }
  }

  /**
   * Helper: Extract image URL from various formats
   */
  extractImageURL(imageData) {
    console.log('[RecipeExtractor] extractImageURL input:', typeof imageData, Array.isArray(imageData) ? 'array' : '', imageData ? JSON.stringify(imageData).substring(0, 100) : 'null');

    if (!imageData) return null;

    // String URL
    if (typeof imageData === 'string') {
      const result = imageData.startsWith('http') ? imageData : null;
      console.log('[RecipeExtractor] extractImageURL result (string):', result?.substring(0, 80));
      return result;
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

    console.log('[RecipeExtractor] extractImageURL: no match, returning null');
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
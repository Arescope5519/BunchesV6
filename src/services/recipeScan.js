/**
 * FILENAME: src/services/recipeScan.js
 * PURPOSE: AI recipe scanning via the extract-recipe Edge Function.
 *
 * The Gemini API key lives in Supabase secrets - the app only sends
 * photos (base64) with the signed-in user's token. Rate limits are
 * enforced server-side; this service just surfaces the results.
 */

import { supabase } from './supabase/config';

/**
 * Scan 1-3 photos of a recipe and get back a structured recipe.
 * @param {string[]} base64Images - JPEG base64 strings (no data: prefix)
 * @returns {Promise<{
 *   success: boolean,
 *   recipe?: object,        // app-format recipe (ingredients as sections object)
 *   confidence?: string,    // high | medium | low
 *   warnings?: string[],
 *   scansUsed?: number,
 *   scanLimit?: number,
 *   error?: string,         // limit_reached | no_recipe | ...
 *   message?: string,
 * }>}
 */
export const scanRecipeImages = async (base64Images) => {
  try {
    const { data, error } = await supabase.functions.invoke('extract-recipe', {
      body: { images: base64Images, mimeType: 'image/jpeg' },
    });

    if (error) {
      // Non-2xx responses land here - the body still has our shape
      let body = null;
      try {
        if (error.context && typeof error.context.json === 'function') {
          body = await error.context.json();
        }
      } catch (_e) { /* ignore */ }

      if (body?.error) {
        return { success: false, ...body };
      }
      console.error('📷 [SCAN] Edge Function error:', error);
      return {
        success: false,
        error: 'network',
        message: 'Could not reach the scanning service. Check your connection and try again.',
      };
    }

    if (!data?.success) {
      return { success: false, ...data };
    }

    // Convert Edge Function shape -> app recipe shape
    const sections = {};
    (data.recipe.ingredient_sections || []).forEach(section => {
      const name = (section?.name || 'main').trim() || 'main';
      const items = Array.isArray(section?.items)
        ? section.items.filter(i => typeof i === 'string' && i.trim())
        : [];
      if (items.length > 0) {
        sections[name] = [...(sections[name] || []), ...items];
      }
    });
    if (Object.keys(sections).length === 0) {
      sections.main = [];
    }

    return {
      success: true,
      recipe: {
        title: data.recipe.title,
        ingredients: sections,
        instructions: data.recipe.instructions || [],
        prepTime: data.recipe.prep_time || '',
        cookTime: data.recipe.cook_time || '',
        servings: data.recipe.servings || '',
        notes: data.recipe.notes || '',
        image_url: '',
        source_url: '',
      },
      confidence: data.confidence,
      warnings: data.warnings || [],
      scansUsed: data.scansUsed,
      scanLimit: data.scanLimit,
    };
  } catch (err) {
    console.error('📷 [SCAN] Unexpected error:', err);
    return {
      success: false,
      error: 'internal',
      message: 'Something went wrong while scanning. Please try again.',
    };
  }
};

export default { scanRecipeImages };

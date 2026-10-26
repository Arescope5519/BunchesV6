/**
 * FILENAME: src/services/recipeScan.js
 * PURPOSE: AI recipe extraction via the extract-recipe Edge Function -
 * photos (cookbook scans) and text (Instagram captions) share one
 * pipeline and one server-side allowance.
 *
 * The Gemini API key lives in Supabase secrets - the app only sends
 * photos/text with the signed-in user's token. Rate limits are
 * enforced server-side; this service just surfaces the results.
 */

import { supabase } from './supabase/config';
import { dbg } from '../utils/debugLog';

// Generous ceiling: upload + Gemini walking its model list. Without it,
// a stalled connection left the scanning spinner running forever.
const SCAN_TIMEOUT_MS = 90000;

// Mirrors the Edge Function's per-image cap. Checking here fails fast
// with a real message instead of a 90s upload stall and a timeout.
const MAX_BASE64_LENGTH = 5_500_000;

/**
 * Shared invoke + result shaping. `sourceTag` lands on each recipe's
 * `source` field: 'scan' marks the user's own-work scans; null leaves
 * the recipe an ordinary import (Instagram captions - someone else's
 * writing).
 */
const runExtract = async (body, sourceTag) => {
  try {
    const started = Date.now();
    const raced = await Promise.race([
      supabase.functions.invoke('extract-recipe', { body }),
      new Promise(resolve =>
        setTimeout(() => resolve({ __timeout: true }), SCAN_TIMEOUT_MS)
      ),
    ]);

    if (raced.__timeout) {
      dbg('[SCAN]', 'TIMEOUT after', Math.round((Date.now() - started) / 1000) + 's');
      return {
        success: false,
        error: 'timeout',
        message: 'The scan is taking too long. Check your connection and try again.',
      };
    }

    const { data, error } = raced;

    if (error) {
      // Non-2xx responses land here - the body still has our shape
      let errBody = null;
      try {
        if (error.context && typeof error.context.json === 'function') {
          errBody = await error.context.json();
        }
      } catch (_e) { /* ignore */ }

      if (errBody?.error) {
        dbg('[SCAN]', 'server error:', errBody.error, '-', (errBody.detail || errBody.message || '').substring(0, 200));
        return { success: false, ...errBody };
      }
      console.error('📷 [SCAN] Edge Function error:', error);
      dbg('[SCAN]', 'invoke failed (no body):', error?.name || '', (error?.message || String(error)).substring(0, 200));
      return {
        success: false,
        error: 'network',
        message: 'Could not reach the scanning service. Check your connection and try again.',
      };
    }

    if (!data?.success) {
      dbg('[SCAN]', 'no result:', data?.error, '-', (data?.detail || data?.message || '').substring(0, 200));
      return { success: false, ...data };
    }
    dbg('[SCAN]', 'SUCCESS:', (data.recipes || []).length, 'recipe(s) in', Math.round((Date.now() - started) / 1000) + 's');

    // Convert Edge Function shape -> app recipe shape, per recipe
    const results = (data.recipes || []).map(raw => {
      const sections = {};
      (raw.ingredient_sections || []).forEach(section => {
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
        recipe: {
          title: raw.title,
          ingredients: sections,
          instructions: raw.instructions || [],
          prepTime: raw.prep_time || '',
          cookTime: raw.cook_time || '',
          servings: raw.servings || '',
          notes: raw.notes || '',
          image_url: '',
          source_url: '',
          source: sourceTag, // 'scan' = own work ("Scanned by @user"); null = import
        },
        confidence: raw.confidence,
        warnings: raw.warnings || [],
      };
    });

    if (results.length === 0) {
      return {
        success: false,
        error: 'no_recipe',
        message: 'No recipe was found.',
        scansUsed: data.scansUsed,
        scanLimit: data.scanLimit,
      };
    }

    return {
      success: true,
      results,
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

/**
 * Scan 1-3 photos and get back every recipe found in them.
 * Photos can be pages of one recipe (merged into one result) or contain
 * several distinct recipes (each returned separately).
 * @param {string[]} base64Images - JPEG base64 strings (no data: prefix)
 */
export const scanRecipeImages = async (base64Images) => {
  dbg('[SCAN]', 'start:', base64Images.length, 'image(s),',
    base64Images.map(i => Math.round(i.length / 1024) + 'KB').join(', '));
  if (base64Images.some(i => i.length > MAX_BASE64_LENGTH)) {
    dbg('[SCAN]', 'aborted: an image exceeds the upload cap');
    return {
      success: false,
      error: 'image_too_large',
      message: 'One of the photos is too large to upload. Retake it with the in-app camera and try again.',
    };
  }
  return runExtract({ images: base64Images, mimeType: 'image/jpeg' }, 'scan');
};

/**
 * Extract recipes from freeform TEXT (an Instagram caption). Same
 * server pipeline, same allowance; the result is an ordinary import,
 * not own work.
 * @param {string} text
 */
export const scanRecipeText = async (text) => {
  const trimmed = String(text || '').trim();
  dbg('[SCAN]', 'text start:', trimmed.length, 'chars');
  if (trimmed.length < 20) {
    return {
      success: false,
      error: 'no_recipe',
      message: 'The post text is too short to contain a recipe.',
    };
  }
  return runExtract({ text: trimmed }, null);
};

export default { scanRecipeImages, scanRecipeText };

/**
 * FILENAME: src/services/recipeScan.js
 * PURPOSE: AI recipe scanning via the extract-recipe Edge Function.
 *
 * The Gemini API key lives in Supabase secrets - the app only sends
 * photos (base64) with the signed-in user's token. Rate limits are
 * enforced server-side; this service just surfaces the results.
 */

import { supabase } from './supabase/config';
import { dbg } from '../utils/debugLog';

/**
 * Scan 1-3 photos and get back every recipe found in them.
 * Photos can be pages of one recipe (merged into one result) or contain
 * several distinct recipes (each returned separately).
 * @param {string[]} base64Images - JPEG base64 strings (no data: prefix)
 * @returns {Promise<{
 *   success: boolean,
 *   results?: Array<{ recipe: object, confidence: string, warnings: string[] }>,
 *   scansUsed?: number,
 *   scanLimit?: number,
 *   error?: string,         // limit_reached | no_recipe | ...
 *   message?: string,
 * }>}
 */
// Generous ceiling: upload + Gemini on 3 pages. Without it, a stalled
// connection left the scanning spinner running forever.
const SCAN_TIMEOUT_MS = 90000;

// Mirrors the Edge Function's per-image cap. Checking here fails fast
// with a real message instead of a 90s upload stall and a timeout.
const MAX_BASE64_LENGTH = 5_500_000;

export const scanRecipeImages = async (base64Images) => {
  try {
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
    const started = Date.now();
    const raced = await Promise.race([
      supabase.functions.invoke('extract-recipe', {
        body: { images: base64Images, mimeType: 'image/jpeg' },
      }),
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
      let body = null;
      try {
        if (error.context && typeof error.context.json === 'function') {
          body = await error.context.json();
        }
      } catch (_e) { /* ignore */ }

      if (body?.error) {
        dbg('[SCAN]', 'server error:', body.error, '-', (body.detail || body.message || '').substring(0, 200));
        return { success: false, ...body };
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
          source: 'scan', // attribution: shown as "Scanned by @user"
        },
        confidence: raw.confidence,
        warnings: raw.warnings || [],
      };
    });

    if (results.length === 0) {
      return {
        success: false,
        error: 'no_recipe',
        message: 'No recipe was found in the photo.',
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

export default { scanRecipeImages };

/**
 * FILENAME: src/services/openaiModeration.js
 * PURPOSE: Text content moderation via Supabase Edge Function
 *
 * The actual OpenAI API key lives in Supabase env vars, not in the app.
 * The Edge Function proxies the request. See supabase/functions/moderate-text
 * and EDGE_FUNCTIONS_SETUP.md for deployment instructions.
 *
 * OpenAI's Moderation API is free and does not train on the data
 * (per OpenAI's usage policy for the /moderations endpoint).
 *
 * IMPORTANT: Text sent through this route reaches OpenAI's servers.
 * Users should be informed of this via a disclaimer.
 */

import { supabase } from './supabase/config';

/**
 * Check a single text with OpenAI moderation via Edge Function
 * @param {string} text
 * @returns {Promise<{safe: boolean, reason: string|null}>}
 */
export const checkTextWithOpenAI = async (text) => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { safe: true, reason: null };
  }

  try {
    const { data, error } = await supabase.functions.invoke('moderate-text', {
      body: { text },
    });

    if (error) {
      console.error('🛡️ [OpenAI Mod] Edge Function error:', error);
      return { safe: true, reason: null };
    }

    const flag = data?.flags?.[0] || { safe: true, reason: null };
    return { safe: !!flag.safe, reason: flag.reason || null };
  } catch (error) {
    console.error('🛡️ [OpenAI Mod] Error:', error);
    return { safe: true, reason: null };
  }
};

/**
 * Check multiple text fields at once (batched into one API call)
 * @param {object} fields - { fieldName: value }
 * @returns {Promise<{safe: boolean, field: string|null, reason: string|null}>}
 */
export const checkFieldsWithOpenAI = async (fields) => {
  // Flatten all field values into an array of {field, text}
  const items = [];
  for (const [field, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'string') items.push({ field, text: item });
      }
    } else if (value && typeof value === 'object') {
      for (const items2 of Object.values(value)) {
        if (Array.isArray(items2)) {
          for (const item of items2) {
            if (item && typeof item === 'string') items.push({ field, text: item });
          }
        }
      }
    } else if (value && typeof value === 'string') {
      items.push({ field, text: value });
    }
  }

  if (items.length === 0) return { safe: true, field: null, reason: null };

  try {
    const { data, error } = await supabase.functions.invoke('moderate-text', {
      body: { texts: items.map((i) => i.text) },
    });

    if (error) {
      console.error('🛡️ [OpenAI Mod] Edge Function error:', error);
      return { safe: true, field: null, reason: null };
    }

    const flags = data?.flags || [];
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] && !flags[i].safe) {
        return {
          safe: false,
          field: items[i].field,
          reason: flags[i].reason || 'flagged',
        };
      }
    }

    return { safe: true, field: null, reason: null };
  } catch (error) {
    console.error('🛡️ [OpenAI Mod] Error:', error);
    return { safe: true, field: null, reason: null };
  }
};

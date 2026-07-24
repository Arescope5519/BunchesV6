/**
 * FILENAME: src/services/moderation.js
 * PURPOSE: Image content moderation via Supabase Edge Function
 *
 * The actual Sightengine API keys live in Supabase env vars, not in the app.
 * The Edge Function proxies the request. See supabase/functions/moderate-image
 * and EDGE_FUNCTIONS_SETUP.md for deployment instructions.
 */

import { supabase } from './supabase/config';

/**
 * Read a file URI as base64 (needed to send image data to Edge Function)
 */
const uriToBase64 = async (uri) => {
  // For local file URIs, fetch works in RN and returns a blob
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is "data:image/jpeg;base64,ABCD..."
      const result = reader.result;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Check an image for inappropriate content via the moderate-image Edge Function
 * @param {string} imageUri - Local file URI of image to check
 * @param {string} [imageBase64] - Pre-computed base64 (skips URI read)
 * @returns {Promise<{safe: boolean, reason: string|null, scores: object}>}
 */
export const checkImageModeration = async (imageUri, imageBase64 = null) => {
  try {
    console.log('🛡️ [MODERATION] Checking image:', imageUri);

    // Get base64: either provided by caller or read from URI
    let base64 = imageBase64;
    if (!base64) {
      try {
        base64 = await uriToBase64(imageUri);
      } catch (err) {
        console.error('🛡️ [MODERATION] Could not read image:', err);
        return { safe: true, reason: null, scores: null };
      }
    }

    const { data, error } = await supabase.functions.invoke('moderate-image', {
      body: { imageBase64: base64 },
    });

    if (error) {
      console.error('🛡️ [MODERATION] Edge Function error:', error);
      // Fail-open on network/function errors
      return { safe: true, reason: null, scores: null };
    }

    console.log('🛡️ [MODERATION] Result:', JSON.stringify(data));
    return {
      safe: !!data?.safe,
      reason: data?.reason || null,
      scores: data?.scores || null,
    };
  } catch (error) {
    console.error('🛡️ [MODERATION] Error:', error);
    // Fail-open on network errors
    return { safe: true, reason: null, scores: null };
  }
};

/**
 * Log flagged content to Supabase for admin review
 * Optional - creates a moderation_flags table entry
 */
export const logFlaggedContent = async (supabase, {
  userId,
  contentType,
  contentId,
  scores,
  reason,
  imageUrl,
}) => {
  try {
    const { error } = await supabase.from('moderation_flags').insert({
      user_id: userId,
      content_type: contentType,
      content_id: contentId,
      scores: scores,
      reason: reason,
      image_url: imageUrl,
      status: 'pending_review',
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('🛡️ [MODERATION] Failed to log flag:', error);
    }
  } catch (err) {
    console.error('🛡️ [MODERATION] Error logging flag:', err);
  }
};

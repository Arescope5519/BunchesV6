/**
 * FILENAME: src/services/moderation.js
 * PURPOSE: Image content moderation via Sightengine API
 *
 * Sign up at https://sightengine.com and add your credentials below.
 * Free tier: 500 operations/month.
 */

// Sightengine API credentials - get from https://dashboard.sightengine.com
const SIGHTENGINE_API_USER = '258200243';
const SIGHTENGINE_API_SECRET = 'QG8YekqRScbrWPHPJCtgVw6mTfNhrczQ';

// Moderation models to check against
const MODELS = 'nudity-2.1,offensive,gore,weapon';

// Confidence thresholds - image is BLOCKED if any exceed these values
const THRESHOLDS = {
  nudity_raw: 0.5,           // Explicit nudity
  nudity_sexual: 0.3,        // Sexual activity/display
  nudity_suggestive: 0.85,   // Suggestive content (higher tolerance)
  offensive: 0.5,            // Offensive gestures/symbols
  gore: 0.5,                 // Gore/violence
  weapon: 0.7,               // Weapons (higher tolerance - kitchen knives etc)
};

/**
 * Check an image for inappropriate content
 * @param {string} imageUri - Local file URI of image to check
 * @returns {Promise<{safe: boolean, reason: string|null, scores: object}>}
 */
export const checkImageModeration = async (imageUri) => {
  // If credentials not configured, allow (fail-open for development)
  if (!SIGHTENGINE_API_USER || !SIGHTENGINE_API_SECRET) {
    console.warn('⚠️ [MODERATION] Sightengine credentials not configured - skipping check');
    return { safe: true, reason: null, scores: null };
  }

  try {
    console.log('🛡️ [MODERATION] Checking image:', imageUri);

    const formData = new FormData();
    formData.append('media', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'image.jpg',
    });
    formData.append('models', MODELS);
    formData.append('api_user', SIGHTENGINE_API_USER);
    formData.append('api_secret', SIGHTENGINE_API_SECRET);

    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    console.log('🛡️ [MODERATION] Result:', JSON.stringify(result));

    if (result.status !== 'success') {
      console.error('🛡️ [MODERATION] API error:', result.error);
      // Fail-open on API errors - don't block legitimate uploads
      return { safe: true, reason: null, scores: null };
    }

    // Extract scores from response
    const scores = {
      nudity_raw: result.nudity?.raw || result.nudity?.sexual_display || 0,
      nudity_sexual: Math.max(
        result.nudity?.sexual_activity || 0,
        result.nudity?.sexual_display || 0,
        result.nudity?.erotica || 0,
      ),
      nudity_suggestive: result.nudity?.suggestive || 0,
      offensive: result.offensive?.prob || 0,
      gore: result.gore?.prob || 0,
      weapon: result.weapon?.classes?.firearm || result.weapon?.prob || 0,
    };

    // Check against thresholds
    const violations = [];
    if (scores.nudity_raw > THRESHOLDS.nudity_raw) violations.push('explicit content');
    if (scores.nudity_sexual > THRESHOLDS.nudity_sexual) violations.push('sexual content');
    if (scores.nudity_suggestive > THRESHOLDS.nudity_suggestive) violations.push('suggestive content');
    if (scores.offensive > THRESHOLDS.offensive) violations.push('offensive content');
    if (scores.gore > THRESHOLDS.gore) violations.push('gore/violence');
    if (scores.weapon > THRESHOLDS.weapon) violations.push('weapons');

    if (violations.length > 0) {
      const reason = violations.join(', ');
      console.warn('🛡️ [MODERATION] BLOCKED:', reason, scores);
      return { safe: false, reason, scores };
    }

    console.log('✅ [MODERATION] Image passed moderation');
    return { safe: true, reason: null, scores };
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

/**
 * FILENAME: src/services/openaiModeration.js
 * PURPOSE: Text content moderation via OpenAI Moderation API
 *
 * Sign up at https://platform.openai.com and add your API key below.
 * The OpenAI Moderation API is FREE and does not train on your data
 * (per OpenAI's usage policy for the /moderations endpoint).
 *
 * IMPORTANT: Text sent to this API is transmitted to OpenAI's servers
 * for processing. Users should be informed of this via a disclaimer.
 */

// OpenAI API key - get from https://platform.openai.com/api-keys
const OPENAI_API_KEY = '';

// Categories to block. See https://platform.openai.com/docs/guides/moderation/overview
// for full list. We're more strict about hate/sexual/harassment.
const BLOCKED_CATEGORIES = [
  'hate',
  'hate/threatening',
  'harassment',
  'harassment/threatening',
  'sexual',
  'sexual/minors',
  'violence/graphic',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
];

/**
 * Check text with OpenAI Moderation API
 * @param {string} text - Text to check
 * @returns {Promise<{safe: boolean, reason: string|null, categories: object|null}>}
 */
export const checkTextWithOpenAI = async (text) => {
  if (!OPENAI_API_KEY) {
    // No key configured - skip (fail-open)
    return { safe: true, reason: null, categories: null };
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { safe: true, reason: null, categories: null };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: text,
        model: 'omni-moderation-latest',
      }),
    });

    if (!response.ok) {
      console.error('🛡️ [OpenAI Mod] HTTP error:', response.status);
      return { safe: true, reason: null, categories: null };
    }

    const data = await response.json();
    const result = data?.results?.[0];

    if (!result) {
      return { safe: true, reason: null, categories: null };
    }

    // Check for any blocked categories that were flagged
    const flaggedCategories = [];
    for (const category of BLOCKED_CATEGORIES) {
      if (result.categories?.[category]) {
        flaggedCategories.push(category);
      }
    }

    if (flaggedCategories.length > 0) {
      const reason = flaggedCategories.join(', ');
      console.warn('🛡️ [OpenAI Mod] BLOCKED:', reason);
      return { safe: false, reason, categories: result.categories };
    }

    return { safe: true, reason: null, categories: result.categories };
  } catch (error) {
    console.error('🛡️ [OpenAI Mod] Error:', error);
    // Fail-open on network errors
    return { safe: true, reason: null, categories: null };
  }
};

/**
 * Check multiple text fields with OpenAI (batched into one API call for efficiency)
 * @param {object} fields - { fieldName: value } (value can be string, array, or object)
 * @returns {Promise<{safe: boolean, field: string|null, reason: string|null}>}
 */
export const checkFieldsWithOpenAI = async (fields) => {
  if (!OPENAI_API_KEY) return { safe: true, field: null, reason: null };

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
    // OpenAI accepts array input - check all items in one call
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: items.map(i => i.text),
        model: 'omni-moderation-latest',
      }),
    });

    if (!response.ok) {
      console.error('🛡️ [OpenAI Mod] HTTP error:', response.status);
      return { safe: true, field: null, reason: null };
    }

    const data = await response.json();
    const results = data?.results || [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const flaggedCategories = BLOCKED_CATEGORIES.filter(c => result.categories?.[c]);
      if (flaggedCategories.length > 0) {
        return {
          safe: false,
          field: items[i].field,
          reason: flaggedCategories.join(', '),
        };
      }
    }

    return { safe: true, field: null, reason: null };
  } catch (error) {
    console.error('🛡️ [OpenAI Mod] Error:', error);
    return { safe: true, field: null, reason: null };
  }
};

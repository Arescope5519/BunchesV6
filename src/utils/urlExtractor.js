/**
 * URL Extraction Utilities
 * Extracted from your App.js
 */

/**
 * Extract URL from mixed text that may contain other content
 * @param {string} text - The text to extract URL from
 * @returns {string|null} - Extracted URL or null if none found
 */
export const extractUrlFromText = (text) => {
  if (!text) return null;

  // If it starts with http, extract just the URL part (before first space)
  if (text.startsWith('http://') || text.startsWith('https://')) {
    const firstSpace = text.indexOf(' ');
    if (firstSpace === -1) return text.trim();
    return text.substring(0, firstSpace).trim();
  }

  // Use regex to find URL in text
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);

  if (match) {
    let url = match[1];
    // Clean trailing punctuation
    url = url.replace(/[.,;:!?)\]}>]+$/, '');
    return url;
  }

  return null;
};

export default extractUrlFromText;
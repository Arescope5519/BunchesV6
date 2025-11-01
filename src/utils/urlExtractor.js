/**
 * URL Extractor Utility
 * Extracts URLs from text strings shared via Android intent
 */

export const extractUrlFromText = (text) => {
  if (!text) return null;

  // If it's already a clean URL
  if (text.startsWith('http://') || text.startsWith('https://')) {
    const firstSpace = text.indexOf(' ');
    if (firstSpace === -1) return text.trim();
    return text.substring(0, firstSpace).trim();
  }

  // Extract URL from mixed text
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);
  if (match) {
    let url = match[1];
    // Remove trailing punctuation
    url = url.replace(/[.,;:!?)\]}>]+$/, '');
    return url;
  }

  return null;
};

export default extractUrlFromText;
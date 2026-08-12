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
/**
 * Hosts that hand out a fresh short link every time you share, rather
 * than the page's real address. Chrome now wraps shares in share.google,
 * which breaks two things: the extractor gets a redirect stub instead of
 * a recipe, and the duplicate check never matches because the wrapper
 * differs on every share of the same page.
 */
const REDIRECT_HOSTS = [
  'share.google',
  'goo.gl',
  'g.co',
  'bit.ly',
  't.co',
  'tinyurl.com',
  'ow.ly',
  'buff.ly',
  'rb.gy',
  'shorturl.at',
];

const isRedirector = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return REDIRECT_HOSTS.includes(host);
  } catch {
    return false;
  }
};

/**
 * Follow a share wrapper to the page it points at.
 *
 * Only known wrappers are resolved - doing this for every import would
 * add a network round trip to a URL we are about to fetch anyway. On any
 * failure the original is returned, so a resolver problem degrades to
 * today's behaviour rather than blocking the import.
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<string>} the resolved URL, or the original
 */
export const resolveShareUrl = async (url, timeoutMs = 8000) => {
  if (!url || !isRedirector(url)) return url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    return res?.url || url;
  } catch (error) {
    console.error('Could not resolve share link:', error?.message || error);
    return url;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Query parameters that identify the SHARE, not the page. Two links to
 * the same recipe routinely differ only by these, so comparing raw URLs
 * reports a recipe as new every time it is shared.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^fb(clid|_action|_ref)$/i,
  /^(gclid|dclid|msclkid|yclid|twclid)$/i,
  /^(igshid|igsh|si|ref|ref_src|ref_url|source|share|shared_from)$/i,
  /^mc_(cid|eid)$/i,
  /^(_ga|_gl|spm|scid|cmpid|campaign)$/i,
];

const isTracking = (key) => TRACKING_PARAMS.some(re => re.test(key));

/**
 * A stable identity for a recipe URL, for comparing two links to the
 * same page. Lowercases the host, drops "www.", removes the fragment and
 * tracking parameters, and trims a trailing slash.
 *
 * Real query parameters are kept - plenty of sites identify a page with
 * "?p=123", and stripping those would merge unrelated recipes.
 *
 * Returns the input unchanged if it cannot be parsed, so a malformed URL
 * degrades to exact matching rather than throwing.
 *
 * @param {string} url
 * @returns {string}
 */
export const normalizeRecipeUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.protocol = parsed.protocol.toLowerCase();

    for (const key of [...parsed.searchParams.keys()]) {
      if (isTracking(key)) parsed.searchParams.delete(key);
    }

    let out = parsed.toString();
    // Trailing slash on a path is never meaningful; on the bare origin
    // it is what URL() produces, so leave that alone.
    if (parsed.pathname !== '/' && out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    return url;
  }
};

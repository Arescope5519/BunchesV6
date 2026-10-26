/**
 * FILENAME: src/utils/pinterestImport.js
 * PURPOSE: Turn a shared Pinterest pin into something importable,
 * on-device.
 *
 * Most pins LINK to a recipe website - the best outcome, because the
 * destination goes through the normal structured-data extractor (no
 * AI, multi-recipe detection included). The hidden WebView loads the
 * pin page and reads the outbound link (og:see_also, the /offsite/
 * anchor, or the "link" field in Pinterest's state JSON), plus the
 * pin's description and image as fallbacks. Pins with no link but a
 * recipe written in the description go through the Gemini text
 * extractor like Instagram captions do.
 *
 * pin.it short links work too - the WebView follows the redirect.
 */

import { getWebViewPageFetcher } from './webviewImageFetcher';
import { cleanCaption } from './instagramImport';
import { dbg } from './debugLog';

const PIN_RE = /(pinterest\.[a-z.]{2,10}\/pin\/[A-Za-z0-9_-]+)|(pin\.it\/[A-Za-z0-9]+)/i;

export const isPinterestUrl = (url) => PIN_RE.test(String(url || ''));

const isUsableSourceLink = (link) => {
  if (!link || !/^https?:\/\//i.test(link)) return false;
  try {
    const host = new URL(link).hostname.toLowerCase();
    // A link back into Pinterest (board, profile, another pin) is not a
    // recipe source
    return !/(^|\.)pinterest\.[a-z.]+$|(^|\.)pin\.it$|(^|\.)pinimg\.com$/.test(host);
  } catch {
    return false;
  }
};

/**
 * @returns {Promise<{link: string|null, caption: string, imageUrl: string|null}>}
 * @throws when the pin page gives up nothing usable
 */
export const fetchPinterestPin = async (pinUrl) => {
  const fetchPage = getWebViewPageFetcher();
  if (!fetchPage) throw new Error('page fetcher not ready');

  const full = /^https?:\/\//i.test(pinUrl) ? pinUrl : `https://${pinUrl}`;
  dbg('[PIN]', 'loading pin page:', full);
  const res = await fetchPage(full);

  const link = isUsableSourceLink(res?.link) ? res.link : null;
  const caption = cleanCaption(res?.caption);
  dbg('[PIN]', 'pin read:', link ? 'source link found' : 'no source link', '|', caption.length, 'chars of description');

  if (!link && caption.length <= 20) {
    throw new Error('pin had no source link and no readable description');
  }
  return { link, caption, imageUrl: res?.image || null };
};

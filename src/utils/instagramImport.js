/**
 * FILENAME: src/utils/instagramImport.js
 * PURPOSE: Pull the caption (and cover image URL) out of a shared
 * Instagram post, on-device.
 *
 * Instagram's share sheet hands over a URL, not the caption, and there
 * is no public API - so this rides the same hidden-WebView trick that
 * downloads bot-walled photos: a real Chromium on the user's phone
 * loads the post's public EMBED page (which renders the full caption
 * without a login for public posts) and the injected script reads it
 * out. Falls back to the regular post page's og:description, which is
 * sometimes truncated but better than nothing. Private posts fail -
 * there is nothing to read without the sharer's login.
 *
 * The caption text then goes through the Gemini text extractor
 * (scanRecipeText) exactly like a photo scan does.
 */

import { getWebViewPageFetcher } from './webviewImageFetcher';
import { dbg } from './debugLog';

const POST_RE = /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i;

export const isInstagramUrl = (url) => POST_RE.test(String(url || ''));

// og:description reads like:
//   123 likes, 4 comments - username on October 1, 2026: "the caption"
// Strip the stats prefix and the wrapping quotes when they are there.
const stripOgWrapper = (text) => {
  const m = String(text).match(/^[\d,.KM]+ likes?, [\d,.KM]+ comments? - .+?: ["“]([\s\S]+)["”]?$/);
  if (m) return m[1];
  return text;
};

const cleanCaption = (text) => {
  let t = String(text || '').replace(/\r/g, '').trim();
  // Collapse runs of blank lines; drop a pure-hashtag tail wall
  t = t.replace(/\n{3,}/g, '\n\n');
  const lines = t.split('\n');
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (last === '' || /^[#@\s][#@\w\s]*$/.test(last)) lines.pop();
    else break;
  }
  return lines.join('\n').slice(0, 9000);
};

/**
 * @returns {Promise<{caption: string, imageUrl: string|null}>}
 * @throws when the caption cannot be read (private post, wall, markup change)
 */
export const fetchInstagramPost = async (postUrl) => {
  const fetchPage = getWebViewPageFetcher();
  if (!fetchPage) throw new Error('page fetcher not ready');

  const m = String(postUrl).match(POST_RE);
  if (!m) throw new Error('not an Instagram post URL');
  const kind = m[1].toLowerCase() === 'reels' ? 'reel' : m[1].toLowerCase();
  const shortcode = m[2];

  // The public embed page renders the FULL caption for public posts
  const embedUrl = `https://www.instagram.com/${kind}/${shortcode}/embed/captioned/`;
  dbg('[IG]', 'fetching caption via embed:', shortcode);
  try {
    const res = await fetchPage(embedUrl);
    const caption = cleanCaption(res?.caption);
    if (caption.length > 20) {
      dbg('[IG]', 'embed caption:', caption.length, 'chars');
      return { caption, imageUrl: res?.image || null };
    }
  } catch (e) {
    dbg('[IG]', 'embed fetch failed:', e?.message);
  }

  // Fallback: the post page's og:description (may be truncated)
  dbg('[IG]', 'falling back to post page meta');
  const res2 = await fetchPage(`https://www.instagram.com/${kind}/${shortcode}/`);
  const caption2 = cleanCaption(stripOgWrapper(res2?.caption));
  if (caption2.length > 20) {
    dbg('[IG]', 'og caption:', caption2.length, 'chars');
    return { caption: caption2, imageUrl: res2?.image || null };
  }
  throw new Error('no readable caption - the post may be private');
};

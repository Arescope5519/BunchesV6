/**
 * FILENAME: src/utils/imageSource.js
 * PURPOSE: Build Image source objects for recipe photos.
 *
 * Imported recipes keep the source site's image URL, and some CDNs
 * (Akamai fronting foodnetwork.com's food.fnr.sndimg.com, for one)
 * refuse requests from bare HTTP clients - Android's image loader
 * identifies as OkHttp and gets rejected while iOS slips through, so
 * the same photo rendered on one platform and not the other. Sending
 * browser-like headers makes both platforms look like a normal
 * browser image request.
 *
 * Local files and data URIs are passed through untouched - headers
 * on a file:// source are meaningless and can break loading.
 */

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

export const imgSource = (uri) => {
  if (!uri) return undefined;
  if (typeof uri !== 'string') return uri; // already a source object / require()
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return { uri, headers: BROWSER_HEADERS };
  }
  return { uri };
};

export default imgSource;

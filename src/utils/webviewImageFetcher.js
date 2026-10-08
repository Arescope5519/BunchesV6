/**
 * FILENAME: src/utils/webviewImageFetcher.js
 * PURPOSE: Hand-off point between the service layer and the hidden
 * WebView image downloader.
 *
 * HiddenImageFetcher (a component, mounted once in App.js) registers
 * its fetch function here on mount; database.js picks it up through
 * getWebViewImageFetcher so the service layer never imports a
 * component. The fetcher takes an image URL and resolves to
 * { base64, contentType } or rejects.
 */

let fetcher = null;

export const setWebViewImageFetcher = (fn) => {
  fetcher = fn;
};

export const getWebViewImageFetcher = () => fetcher;

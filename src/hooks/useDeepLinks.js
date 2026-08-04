/**
 * FILENAME: src/hooks/useDeepLinks.js
 * PURPOSE: Handle recipe deep links - <scheme>://recipe/<globalRecipeId>
 * opens that recipe's card in the app.
 *
 * Also accepts the https form (APP_DOMAIN/r/<id>) so the app is
 * ready the moment the domain + App Links go live at launch prep.
 *
 * NOTE: <scheme>://share?url=... (share extension) is handled separately
 * by useShareIntent - this hook ignores it and vice versa.
 */

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

import { log } from '../utils/log';
import { APP_SCHEME, LEGACY_SCHEMES, APP_DOMAIN } from '../constants/app';
export const RECIPE_LINK_PREFIX = `${APP_SCHEME}://recipe/`;

export const buildRecipeLink = (globalRecipeId) =>
  `${RECIPE_LINK_PREFIX}${globalRecipeId}`;

const parseRecipeLink = (url) => {
  if (!url || typeof url !== 'string') return null;

  // Current scheme plus any legacy one, so links shared under an old
  // name keep opening
  for (const s of [APP_SCHEME, ...LEGACY_SCHEMES]) {
    const m = url.match(new RegExp(`^${s}://recipe/([A-Za-z0-9-]+)`, 'i'));
    if (m) return m[1];
  }

  // https deep links (App Links / Universal Links)
  const domain = APP_DOMAIN.replace('.', '\\.');
  const web = url.match(new RegExp(`^https?://(?:www\\.)?${domain}/r/([A-Za-z0-9-]+)`, 'i'));
  if (web) return web[1];

  return null;
};

export const useDeepLinks = (onRecipeLink) => {
  const callbackRef = useRef(onRecipeLink);
  const handledInitial = useRef(false);

  useEffect(() => {
    callbackRef.current = onRecipeLink;
  }, [onRecipeLink]);

  useEffect(() => {
    const handleUrl = (url) => {
      const globalRecipeId = parseRecipeLink(url);
      if (globalRecipeId && callbackRef.current) {
        log('🔗 Recipe deep link:', globalRecipeId);
        callbackRef.current(globalRecipeId);
      }
    };

    // Cold start: app opened via the link
    if (!handledInitial.current) {
      handledInitial.current = true;
      Linking.getInitialURL().then(url => {
        if (url) handleUrl(url);
      }).catch(() => {});
    }

    // Warm start: app already running when the link is tapped
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event?.url);
    });

    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);
};

export default useDeepLinks;

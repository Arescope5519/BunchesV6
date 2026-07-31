/**
 * FILENAME: src/hooks/useDeepLinks.js
 * PURPOSE: Handle recipe deep links - bunches://recipe/<globalRecipeId>
 * opens that recipe's card in the app.
 *
 * Also accepts the future https form (hunii.app/r/<id>) so the app is
 * ready the moment the domain + App Links go live at launch prep.
 *
 * NOTE: bunches://share?url=... (share extension) is handled separately
 * by useShareIntent - this hook ignores it and vice versa.
 */

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

export const RECIPE_LINK_PREFIX = 'bunches://recipe/';

export const buildRecipeLink = (globalRecipeId) =>
  `${RECIPE_LINK_PREFIX}${globalRecipeId}`;

const parseRecipeLink = (url) => {
  if (!url || typeof url !== 'string') return null;

  const scheme = url.match(/^bunches:\/\/recipe\/([A-Za-z0-9-]+)/);
  if (scheme) return scheme[1];

  // Future https deep links (Phase 7: domain + App Links)
  const web = url.match(/^https?:\/\/(?:www\.)?hunii\.app\/r\/([A-Za-z0-9-]+)/i);
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
        console.log('🔗 Recipe deep link:', globalRecipeId);
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

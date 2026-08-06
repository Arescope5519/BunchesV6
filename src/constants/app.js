/**
 * FILENAME: src/constants/app.js
 * PURPOSE: App-level branding, identity and contact constants.
 *
 * Everything tied to the product name lives here so a rename is a
 * one-file change: display name, URL scheme, domain, support inbox and
 * legal URLs.
 *
 * NOTE ON SCHEMES: internal recipe URLs are PERSISTED in the database
 * (see saveRecipeWithDualWrite - custom recipes get a
 * "<scheme>://user/{userId}/recipes/{recipeId}" source URL). Renaming
 * the scheme must therefore never orphan existing rows, so
 * LEGACY_SCHEMES stays populated and isInternalUrl() accepts both.
 * Only remove a legacy scheme after migrating stored data.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const APP_NAME = 'Melibri';
export const APP_TAGLINE = 'my recipe kitchen';

/**
 * Version comes from app.json, never a second hardcoded copy - that is
 * the value the stores show, and a separate constant drifts from it the
 * first time either is bumped alone.
 *
 * APP_VERSION  - marketing version (CFBundleShortVersionString /
 *                versionName), e.g. "0.9.0"
 * APP_BUILD    - the upload counter (ios.buildNumber /
 *                android.versionCode). Must increase on EVERY store
 *                upload; neither store accepts a repeat.
 */
const expoConfig = Constants?.expoConfig || {};
export const APP_VERSION = expoConfig.version || '0.0.0';
export const APP_BUILD = String(
  (Platform.OS === 'ios'
    ? expoConfig.ios?.buildNumber
    : expoConfig.android?.versionCode) ?? '0'
);

/** What to show a human, e.g. "0.9.0 (1)". */
export const APP_VERSION_LABEL = `${APP_VERSION} (${APP_BUILD})`;

// Custom URL scheme, e.g. melibri://recipe/<id>
export const APP_SCHEME = 'melibri';

// Schemes from earlier names. Still recognised when READING stored data
// so recipes saved under the old identity keep working.
export const LEGACY_SCHEMES = ['bunches'];

// Web domain - primary shareable links once App Links are configured
export const APP_DOMAIN = 'melibri.app';

// Backup file extension. Older extensions stay importable so backups
// taken under a previous name are never orphaned.
export const BACKUP_EXT = 'melibri';
export const LEGACY_BACKUP_EXTS = ['bunches'];

// Support inbox. Tied to the current name - update alongside APP_NAME.
// Also set as the contact address in App Store Connect / Play Console.
export const SUPPORT_EMAIL = 'hello@melibri.app';

// TODO: replace with real hosted documents before launch (Phase 7)
export const TERMS_URL = `https://${APP_DOMAIN}/terms`;
export const PRIVACY_URL = `https://${APP_DOMAIN}/privacy`;

/**
 * True for URLs the app itself minted (custom + scanned recipes),
 * as opposed to a real website a recipe was imported from.
 * Accepts the current scheme and every legacy one.
 */
export const isInternalUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return [APP_SCHEME, ...LEGACY_SCHEMES].some(s => url.startsWith(`${s}://`));
};

/** Every scheme the app answers to - current first, then legacy. */
export const ALL_SCHEMES = [APP_SCHEME, ...LEGACY_SCHEMES];

/** Build the internal source URL stored for a user-created recipe. */
export const buildInternalRecipeUrl = (userId, recipeId) =>
  `${APP_SCHEME}://user/${userId}/recipes/${recipeId}`;

/**
 * Every internal source URL a given recipe could have been stored under,
 * newest scheme first. For LOOKUPS against rows written before a rename -
 * building one URL and querying it would miss legacy rows entirely.
 */
export const internalRecipeUrlCandidates = (userId, recipeId) =>
  ALL_SCHEMES.map(s => `${s}://user/${userId}/recipes/${recipeId}`);

/** Friend invite link, e.g. melibri://add-friend/daniel */
export const buildFriendLink = (username) =>
  `${APP_SCHEME}://add-friend/${username}`;

/** Username from a friend invite link, accepting legacy schemes. */
export const parseFriendLink = (url) => {
  if (!url || typeof url !== 'string') return null;
  for (const s of ALL_SCHEMES) {
    const m = url.match(new RegExp(`^${s}://add-friend/([^/?]+)`, 'i'));
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
};

export default {
  APP_NAME,
  APP_BUILD,
  APP_VERSION_LABEL,
  BACKUP_EXT,
  LEGACY_BACKUP_EXTS,
  APP_TAGLINE,
  APP_VERSION,
  APP_SCHEME,
  LEGACY_SCHEMES,
  ALL_SCHEMES,
  APP_DOMAIN,
  SUPPORT_EMAIL,
  TERMS_URL,
  PRIVACY_URL,
  isInternalUrl,
  buildInternalRecipeUrl,
  internalRecipeUrlCandidates,
  buildFriendLink,
  parseFriendLink,
};

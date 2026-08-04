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

export const APP_NAME = 'Melibri';
export const APP_TAGLINE = 'my recipe kitchen';
export const APP_VERSION = 'Alpha6.07';

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

/** Build the internal source URL stored for a user-created recipe. */
export const buildInternalRecipeUrl = (userId, recipeId) =>
  `${APP_SCHEME}://user/${userId}/recipes/${recipeId}`;

export default {
  APP_NAME,
  BACKUP_EXT,
  LEGACY_BACKUP_EXTS,
  APP_TAGLINE,
  APP_VERSION,
  APP_SCHEME,
  LEGACY_SCHEMES,
  APP_DOMAIN,
  SUPPORT_EMAIL,
  TERMS_URL,
  PRIVACY_URL,
  isInternalUrl,
  buildInternalRecipeUrl,
};

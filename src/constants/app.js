/**
 * FILENAME: src/constants/app.js
 * PURPOSE: App-level branding and contact constants - single-file swap
 * when the final name is decided at launch prep (see ROADMAP Phase 7).
 *
 * When the name changes, everything here changes together: the display
 * name, the support inbox, and the legal URLs. Nothing else in the app
 * should hardcode any of these.
 */

export const APP_NAME = 'Hunii';
export const APP_TAGLINE = 'my recipe kitchen';
export const APP_VERSION = 'Alpha6.07';

// Support inbox. Tied to the current name - update alongside APP_NAME.
// Also set as the contact address in App Store Connect / Play Console.
export const SUPPORT_EMAIL = 'recipebunches@gmail.com';

// TODO: replace with real hosted documents before launch (Phase 7)
export const TERMS_URL = 'https://bunchesai.com/terms';
export const PRIVACY_URL = 'https://bunchesai.com/privacy';

export default {
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  SUPPORT_EMAIL,
  TERMS_URL,
  PRIVACY_URL,
};

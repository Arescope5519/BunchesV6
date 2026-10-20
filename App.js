/**
 * App.js - boot gate only; the real app lives in src/AppRoot.js.
 *
 * Reads the stored light/dark preference and applies it BEFORE the
 * rest of the app is required: every screen's StyleSheet.create copies
 * values out of constants/colors at module evaluation, so the palette
 * must be final first. The explicit require() inside the effect is
 * what delays that evaluation - converting it to a top-level import
 * would silently freeze the theme back to system-only.
 */

import React, { useState, useEffect } from 'react';
import { applyThemePreference } from './src/constants/colors';
import { loadThemePreference } from './src/utils/theme';

export default function App() {
  const [Root, setRoot] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        applyThemePreference(await loadThemePreference());
      } catch (e) {
        // Unreadable preference - fall through on the system scheme
      }
      const AppRoot = require('./src/AppRoot').default;
      if (!cancelled) setRoot(() => AppRoot);
    })();
    return () => { cancelled = true; };
  }, []);

  // One frame of nothing while AsyncStorage answers; the splash screen
  // is still up, so nothing visible flashes.
  if (!Root) return null;
  return <Root />;
}

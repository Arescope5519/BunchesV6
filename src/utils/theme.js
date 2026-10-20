/**
 * FILENAME: src/utils/theme.js
 * PURPOSE: Stored light/dark preference ('system' | 'light' | 'dark').
 *
 * Deliberately a DEVICE-level AsyncStorage key, not part of the
 * per-user app settings: App.js must read it before anyone signs in,
 * because the palette has to be final before the first
 * StyleSheet.create runs (see colors.js). Like a system theme change,
 * a new choice applies on the next app start.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'themePreference';

export const THEME_OPTIONS = [
  { key: 'system', label: 'Auto' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export const loadThemePreference = async () => {
  try {
    const value = await AsyncStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

export const saveThemePreference = async (value) => {
  try {
    await AsyncStorage.setItem(THEME_KEY, value);
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
};

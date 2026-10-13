/**
 * FILENAME: src/utils/cookSession.js
 * PURPOSE: Persist the in-progress Cook Mode session.
 *
 * The OS freely kills backgrounded apps, which used to dump an
 * active cooking session back to the home screen on relaunch. Cook
 * Mode saves its place here on every check-off; app launch restores
 * straight back into the same recipe's Cook Mode. Cleared when the
 * cook deliberately leaves (Finish / Leave), never on app death -
 * that is the point.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@melibri_cook_session';

// A session older than this is stale - nobody resumes dinner the
// next afternoon
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const saveCookSession = async (session) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch {}
};

export const loadCookSession = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.recipeId) return null;
    if (Date.now() - (session.savedAt || 0) > MAX_AGE_MS) {
      clearCookSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

export const clearCookSession = async () => {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
};

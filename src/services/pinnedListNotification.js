/**
 * FILENAME: src/services/pinnedListNotification.js
 * PURPOSE: Optional "pin your shopping list to the notification bar"
 * (Settings toggle, Android only). Posts a silent, sticky local
 * notification listing the unchecked items; tapping it opens the Shop
 * tab. Reposting under the same identifier updates it in place, so the
 * pinned entry follows the list as items are added and checked off.
 *
 * iOS has no ongoing/pinned notifications (the nearest thing is a Live
 * Activity, which needs a native widget extension), so everything here
 * no-ops off Android and the Settings row never shows.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { dbg } from '../utils/debugLog';

// Device-level preference, default OFF
const PIN_KEY = '@melibri_pin_shopping_list';
const NOTIF_ID = 'pinned-shopping-list';
const CHANNEL_ID = 'pinned-list';

export const isPinSupported = Platform.OS === 'android';

// The last list HomeScreen reported, so the Settings toggle can post
// the notification immediately without having the list itself
let lastKnownList = [];

export const loadPinListEnabled = async () => {
  try {
    return (await AsyncStorage.getItem(PIN_KEY)) === 'true';
  } catch (_e) {
    return false;
  }
};

/**
 * Settings toggle. Returns false when the OS notification permission is
 * denied (the caller tells the user), true otherwise.
 */
export const setPinListEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(PIN_KEY, enabled ? 'true' : 'false');
  } catch (_e) { /* worst case the pref resets to off */ }
  if (!isPinSupported) return true;
  if (!enabled) {
    try { await Notifications.dismissNotificationAsync(NOTIF_ID); } catch (_e) { /* best effort */ }
    return true;
  }
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return false;
  await updatePinnedListNotification(lastKnownList, true);
  return true;
};

/**
 * Repost the pinned notification to match the list. Called by
 * HomeScreen on every grocery-list change; cheap no-op while the
 * setting is off or off-Android.
 */
export const updatePinnedListNotification = async (groceryList, forceEnabled = false) => {
  lastKnownList = groceryList || [];
  if (!isPinSupported) return;
  try {
    if (!forceEnabled && !(await loadPinListEnabled())) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // LOW importance: lives in the tray without popping, buzzing, or
    // making a sound on every list change
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Pinned Shopping List',
      importance: Notifications.AndroidImportance.LOW,
      enableVibrate: false,
      sound: null,
    });

    const names = (groceryList || [])
      .filter(i => !i.checked)
      .map(i => i.text)
      .filter(Boolean);
    const shown = names.slice(0, 6).join(', ');
    const more = names.length > 6 ? ` +${names.length - 6} more` : '';
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID,
      content: {
        title: names.length > 0 ? `Shopping List (${names.length})` : 'Shopping List',
        body: names.length > 0 ? shown + more : 'Nothing left to buy. Tap to open your list.',
        sticky: true,
        sound: null,
        data: { kind: 'pinned_list' },
      },
      // A trigger with only a channelId presents immediately on that
      // channel; reposting the same identifier replaces in place
      trigger: { channelId: CHANNEL_ID },
    });
  } catch (err) {
    dbg('[PIN]', 'update failed:', err?.message);
  }
};

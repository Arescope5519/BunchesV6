/**
 * FILENAME: src/services/pushNotifications.js
 * PURPOSE: Register this device for social push notifications (recipe
 * shares, friend requests, shared-cookbook invites).
 *
 * The flow: device registers an Expo push token into push_tokens;
 * Supabase database webhooks fire the send-push Edge Function on
 * inserts into shared_items / friend_requests / shared_folder_members;
 * that function delivers through Expo's push service (FCM/APNs).
 *
 * Graceful degradation is the rule here: no permission, no Firebase
 * config yet (Android needs google-services.json in the build), or an
 * emulator all just mean "no push on this device" - never an error the
 * user sees. The in-app notification badges work regardless.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase/config';
import { dbg } from '../utils/debugLog';
import { log } from '../utils/log';

// Foreground behavior: show social pushes as banners even while the
// app is open (they are rare and actionable)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Ask permission (first run only), fetch the Expo push token, and
 * upsert it for this user. Safe to call on every sign-in.
 * @returns {Promise<boolean>} whether a token was registered
 */
export const registerForPushNotifications = async (userId) => {
  if (!userId) return false;
  try {
    if (!Device.isDevice) {
      log('🔔 Push skipped: not a physical device');
      return false;
    }

    // Android needs a channel before anything shows
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('social', {
        name: 'Friends & Sharing',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      dbg('[PUSH]', 'permission not granted');
      return false;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (!token) {
      dbg('[PUSH]', 'no token returned');
      return false;
    }

    const { error } = await supabase.from('push_tokens').upsert({
      user_id: userId,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token' });

    if (error) {
      dbg('[PUSH]', 'token save failed:', error.message);
      return false;
    }
    dbg('[PUSH]', 'registered', Platform.OS, 'token');
    return true;
  } catch (err) {
    // Missing Firebase config on Android lands here - fine until the
    // google-services.json step is done
    dbg('[PUSH]', 'register failed:', err?.message);
    return false;
  }
};

/**
 * Remove this device's tokens on sign-out so the next owner of the
 * account session doesn't get someone else's pushes.
 */
export const unregisterPushNotifications = async (userId) => {
  if (!userId) return;
  try {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (token) {
      await supabase.from('push_tokens').delete()
        .eq('user_id', userId).eq('token', token);
    }
  } catch (_e) { /* best effort */ }
};

/**
 * Listen for the user TAPPING a notification; the callback receives
 * the data payload ({ kind: 'share' | 'friend_request' | 'folder_invite' }).
 * Returns the subscription (caller removes it on unmount).
 */
export const addNotificationTapListener = (onTap) =>
  Notifications.addNotificationResponseReceivedListener(response => {
    try {
      const data = response?.notification?.request?.content?.data || {};
      dbg('[PUSH]', 'tapped:', data?.kind || 'unknown');
      onTap?.(data);
    } catch (_e) { /* ignore */ }
  });

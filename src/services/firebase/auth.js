/**
 * Authentication Service
 * Handles Google Sign-In WITHOUT Firebase
 * Uses @react-native-google-signin/google-signin directly
 */

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_STORAGE_KEY = '@bunches_user';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '307694075211-2s6oa4lor3ek7v204uc2tjci4hto48n0.apps.googleusercontent.com',
  offlineAccess: false,
  iosClientId: '307694075211-2s6oa4lor3ek7v204uc2tjci4hto48n0.apps.googleusercontent.com',
});

/**
 * Sign in with Google
 * @returns {Promise<Object>} User object
 */
export const signInWithGoogle = async () => {
  try {
    console.log('🔐 [AUTH] Starting Google Sign-In...');

    // Check if device supports Google Play Services
    console.log('🔐 [AUTH] Checking Play Services...');
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    console.log('✅ [AUTH] Play Services available');

    // Sign in with Google
    console.log('🔐 [AUTH] Requesting Google Sign-In...');
    const userInfo = await GoogleSignin.signIn();
    console.log('✅ [AUTH] Google Sign-In successful');

    if (!userInfo || !userInfo.data) {
      throw new Error('No user data received from Google Sign-In');
    }

    const user = {
      uid: userInfo.data.user.id,
      email: userInfo.data.user.email,
      displayName: userInfo.data.user.name,
      photoURL: userInfo.data.user.photo,
    };

    // Persist user to AsyncStorage
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    console.log('✅ [AUTH] User saved to storage:', user.email);

    return user;
  } catch (error) {
    console.error('❌ Google Sign-In Error:', error);

    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      const cancelError = new Error('Sign-in was cancelled');
      cancelError.code = 'cancelled';
      throw cancelError;
    }

    if (error.code === statusCodes.IN_PROGRESS) {
      const progressError = new Error('Sign-in already in progress');
      progressError.code = 'in_progress';
      throw progressError;
    }

    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      const servicesError = new Error('Google Play Services not available');
      servicesError.code = 'play_services_unavailable';
      throw servicesError;
    }

    throw error;
  }
};

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export const signOut = async () => {
  try {
    // Sign out from Google
    await GoogleSignin.signOut();

    // Clear stored user
    await AsyncStorage.removeItem(USER_STORAGE_KEY);

    console.log('✅ Signed out successfully');
  } catch (error) {
    console.error('❌ Sign-Out Error:', error);
    throw new Error('Failed to sign out');
  }
};

/**
 * Get current user from storage
 * @returns {Promise<Object|null>} Current user or null
 */
export const getCurrentUser = async () => {
  try {
    // First check if signed in with Google
    const isSignedIn = await GoogleSignin.isSignedIn();

    if (isSignedIn) {
      // Try to get current user from Google
      const currentUser = await GoogleSignin.getCurrentUser();
      if (currentUser && currentUser.data) {
        return {
          uid: currentUser.data.user.id,
          email: currentUser.data.user.email,
          displayName: currentUser.data.user.name,
          photoURL: currentUser.data.user.photo,
        };
      }
    }

    // Fall back to stored user
    const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      return JSON.parse(storedUser);
    }

    return null;
  } catch (error) {
    console.error('❌ Get current user error:', error);
    return null;
  }
};

/**
 * Check if user is currently signed in
 * @returns {Promise<boolean>}
 */
export const isSignedIn = async () => {
  try {
    return await GoogleSignin.isSignedIn();
  } catch (error) {
    return false;
  }
};

/**
 * Listen to authentication state changes
 * Note: Without Firebase, we can't have real-time auth listeners
 * This is a simplified version that checks on mount
 * @param {Function} callback - Called with user or null
 * @returns {Function} Cleanup function
 */
export const onAuthStateChanged = (callback) => {
  // Check auth state immediately
  getCurrentUser().then(user => {
    callback(user);
  });

  // Return a no-op unsubscribe function
  // (Without Firebase, we can't listen to real-time changes)
  return () => {};
};

export default {
  signInWithGoogle,
  signOut,
  getCurrentUser,
  isSignedIn,
  onAuthStateChanged,
};

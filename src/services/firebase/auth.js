/**
 * Firebase Authentication Service
 * Handles Google Sign-In and user authentication
 */

import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Alert } from 'react-native';

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '307694075211-2s6oa4lor3ek7v204uc2tjci4hto48n0.apps.googleusercontent.com',
  offlineAccess: false,
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

    // Check if already signed in and sign out first
    const isSignedIn = await GoogleSignin.isSignedIn();
    console.log('🔐 [AUTH] Already signed in?', isSignedIn);
    if (isSignedIn) {
      console.log('🔐 [AUTH] Signing out existing user first...');
      await GoogleSignin.signOut();
    }

    // Get user info from Google
    console.log('🔐 [AUTH] Requesting Google Sign-In...');
    const signInResult = await GoogleSignin.signIn();
    console.log('✅ [AUTH] Google Sign-In successful, got result:', !!signInResult);

    if (!signInResult || !signInResult.idToken) {
      // Show simple error without complex operations
      const hasResult = !!signInResult;
      const hasToken = signInResult ? !!signInResult.idToken : false;

      Alert.alert(
        '❌ Missing ID Token',
        `Sign-In Status:\n\nGot result from Google: ${hasResult ? 'Yes' : 'No'}\nHas idToken: ${hasToken ? 'Yes' : 'No'}\n\nThis usually means:\n\n1. google-services.json is outdated\n2. SHA-1 certificate not registered\n3. OAuth client ID incorrect`,
        [{ text: 'OK' }]
      );
      throw new Error('No ID token received from Google Sign-In');
    }

    const { idToken } = signInResult;
    console.log('✅ [AUTH] Got ID token');

    // Create Firebase credential
    console.log('🔐 [AUTH] Creating Firebase credential...');
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    console.log('✅ [AUTH] Firebase credential created');

    // Sign in to Firebase with the Google credential
    console.log('🔐 [AUTH] Signing in to Firebase...');
    const userCredential = await auth().signInWithCredential(googleCredential);
    console.log('✅ [AUTH] Firebase sign-in successful');

    console.log('✅ Signed in with Google:', userCredential.user.email);

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: userCredential.user.displayName,
      photoURL: userCredential.user.photoURL,
    };
  } catch (error) {
    console.error('❌ Google Sign-In Error:', error);

    // Ultra-simple error handling - no complex operations
    let errorCode = 'unknown';
    let errorMessage = 'Sign-in failed';

    try {
      if (error && error.code) {
        errorCode = String(error.code);
      }
    } catch (e) {
      // Ignore
    }

    try {
      if (error && error.message) {
        errorMessage = String(error.message);
      }
    } catch (e) {
      // Ignore
    }

    // Show simple debug alert
    Alert.alert(
      '🔍 Debug: Sign-In Error',
      'Error Code: ' + errorCode + '\n\nError Message: ' + errorMessage,
      [{ text: 'OK' }]
    );

    // Handle specific errors
    if (errorCode === 'sign_in_cancelled' || errorCode === '-5' || errorCode === '12501') {
      const cancelError = new Error('Sign-in was cancelled');
      cancelError.code = 'cancelled';
      throw cancelError;
    }

    if (errorCode === '12500') {
      const configError = new Error('Google Sign-In configuration error. Check SHA-1 and google-services.json');
      configError.code = '12500';
      throw configError;
    }

    // Create safe error
    const safeError = new Error(errorMessage);
    safeError.code = errorCode;
    throw safeError;
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

    // Sign out from Firebase
    await auth().signOut();

    console.log('✅ Signed out successfully');
  } catch (error) {
    console.error('❌ Sign-Out Error:', error);
    throw new Error('Failed to sign out');
  }
};

/**
 * Get current user
 * @returns {Object|null} Current user or null
 */
export const getCurrentUser = () => {
  const user = auth().currentUser;

  if (user) {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    };
  }

  return null;
};

/**
 * Listen to authentication state changes
 * @param {Function} callback - Called when auth state changes
 * @returns {Function} Unsubscribe function
 */
export const onAuthStateChanged = (callback) => {
  return auth().onAuthStateChanged((user) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
    } else {
      callback(null);
    }
  });
};

export default {
  signInWithGoogle,
  signOut,
  getCurrentUser,
  onAuthStateChanged,
};

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

    // Debug: Show what we got from Google Sign-In
    Alert.alert(
      '🔍 Debug: Sign-In Result',
      `Has result: ${!!signInResult}\nHas idToken: ${!!signInResult?.idToken}\nResult keys: ${signInResult ? Object.keys(signInResult).join(', ') : 'none'}`,
      [{ text: 'OK' }]
    );

    if (!signInResult || !signInResult.idToken) {
      Alert.alert(
        '❌ Missing ID Token',
        'Google Sign-In returned a result but no idToken was present. This usually means:\n\n1. The google-services.json file is outdated\n2. SHA-1 certificate not properly registered\n3. Google Sign-In API not enabled in Firebase Console',
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

    // Ultra-defensive error handling
    if (!error) {
      Alert.alert(
        '🔍 Debug: Sign-In Error',
        'Error object is null or undefined',
        [{ text: 'OK' }]
      );
      const safeError = new Error('Unknown error occurred (error object is null/undefined)');
      safeError.code = 'unknown';
      throw safeError;
    }

    // Safely access error properties
    const errorCode = error?.code || 'unknown';
    const errorMessage = error?.message || String(error) || 'Unknown error';

    console.error('Error code:', errorCode);
    console.error('Error message:', errorMessage);

    // Show detailed debug alert
    Alert.alert(
      '🔍 Debug: Sign-In Error Details',
      `Error Code: ${errorCode}\n\nError Message: ${errorMessage}\n\nError Type: ${typeof error}\n\nHas code property: ${error.hasOwnProperty?.('code') ? 'Yes' : 'No'}`,
      [{ text: 'OK' }]
    );

    try {
      console.error('Full error:', JSON.stringify(error, null, 2));
    } catch (e) {
      console.error('Could not stringify error');
    }

    if (errorCode === 'sign_in_cancelled' || errorCode === '-5') {
      throw new Error('Sign-in was cancelled');
    } else if (errorCode === 'in_progress') {
      throw new Error('Sign-in is already in progress');
    } else if (errorCode === 'play_services_not_available') {
      throw new Error('Google Play Services not available');
    } else if (errorCode === '12500') {
      throw new Error('Google Sign-In configuration error. Check SHA-1 certificate in Firebase Console.');
    }

    // Create a new error with safe properties
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

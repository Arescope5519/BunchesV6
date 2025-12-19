/**
 * Firebase Authentication Service
 * Handles Google Sign-In and user authentication
 * Uses Firebase compat layer for React Native compatibility
 */

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Alert } from 'react-native';
import { getFirebaseAuth } from './config';

// Track if Google Sign-In has been configured
let googleSignInConfigured = false;

/**
 * Configure Google Sign-In (must be called before any sign-in operations)
 * Uses webClientId from google-services.json to enable Firebase Auth
 */
const configureGoogleSignIn = () => {
  if (googleSignInConfigured) {
    return;
  }

  try {
    console.log('🔐 [AUTH] Configuring Google Sign-In...');
    GoogleSignin.configure({
      webClientId: '307694075211-2s6oa4lor3ek7v204uc2tjci4hto48n0.apps.googleusercontent.com',
      offlineAccess: true,
    });
    googleSignInConfigured = true;
    console.log('✅ [AUTH] Google Sign-In configured');
  } catch (error) {
    console.error('❌ [AUTH] Failed to configure Google Sign-In:', error);
    throw error;
  }
};

/**
 * Sign in with Google
 * @returns {Promise<Object>} User object
 */
export const signInWithGoogle = async () => {
  // Configure before any operations
  configureGoogleSignIn();

  try {
    console.log('🔐 [AUTH] Starting Google Sign-In...');

    // Check if device supports Google Play Services
    console.log('🔐 [AUTH] Checking Play Services...');
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    console.log('✅ [AUTH] Play Services available');

    // Force sign out first to clear any cached state
    console.log('🔐 [AUTH] Clearing cached sign-in state...');
    try {
      await GoogleSignin.signOut();
      console.log('✅ [AUTH] Cached state cleared');
    } catch (error) {
      console.log('ℹ️ [AUTH] No cached state to clear (this is fine)');
    }

    // Get user info from Google
    console.log('🔐 [AUTH] Requesting Google Sign-In...');
    const signInResult = await GoogleSignin.signIn();
    console.log('✅ [AUTH] Google Sign-In successful');

    // Try to find idToken in different possible locations
    let idToken = null;
    if (signInResult?.idToken) {
      idToken = signInResult.idToken;
    } else if (signInResult?.user?.idToken) {
      idToken = signInResult.user.idToken;
    } else if (signInResult?.data?.idToken) {
      idToken = signInResult.data.idToken;
    }

    if (!idToken) {
      Alert.alert(
        '❌ Missing ID Token',
        'Could not find idToken in sign-in result.',
        [{ text: 'OK' }]
      );
      throw new Error('No ID token received from Google Sign-In');
    }
    console.log('✅ [AUTH] Got ID token');

    // Create Firebase credential using compat API
    console.log('🔐 [AUTH] Creating Firebase credential...');
    const googleCredential = firebase.auth.GoogleAuthProvider.credential(idToken);
    console.log('✅ [AUTH] Firebase credential created');

    // Sign in to Firebase with the Google credential
    console.log('🔐 [AUTH] Signing in to Firebase...');
    const auth = getFirebaseAuth();
    const userCredential = await auth.signInWithCredential(googleCredential);
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

    let errorCode = error?.code || 'unknown';
    let errorMessage = error?.message || 'Sign-in failed';

    Alert.alert(
      '🔍 Sign-In Error',
      `Error Code: ${errorCode}\n\nError Message: ${errorMessage}`,
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

    throw error;
  }
};

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export const signOut = async () => {
  try {
    configureGoogleSignIn();

    console.log('🔐 [AUTH] Signing out from Google...');
    await GoogleSignin.signOut();
    console.log('✅ [AUTH] Signed out from Google');

    console.log('🔐 [AUTH] Signing out from Firebase...');
    const auth = getFirebaseAuth();
    await auth.signOut();
    console.log('✅ [AUTH] Signed out from Firebase');

    console.log('✅ Signed out successfully');
  } catch (error) {
    console.error('❌ Sign-Out Error:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

/**
 * Get current user
 * @returns {Object|null} Current user or null
 */
export const getCurrentUser = () => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

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
  const auth = getFirebaseAuth();
  return auth.onAuthStateChanged((user) => {
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

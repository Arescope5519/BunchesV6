/**
 * Firebase Authentication Service
 * Uses React Native Firebase Auth with Google Sign-In
 */

import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Alert } from 'react-native';

// Track if Google Sign-In has been configured
let googleSignInConfigured = false;

/**
 * Configure Google Sign-In (must be called before any sign-in operations)
 * Uses webClientId from GoogleService-Info.plist / google-services.json
 */
const configureGoogleSignIn = () => {
  if (googleSignInConfigured) {
    return;
  }

  try {
    console.log('🔐 [AUTH] Configuring Google Sign-In...');
    GoogleSignin.configure({
      // This webClientId comes from your Firebase Console -> Authentication -> Sign-in method -> Google
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
      console.error('❌ [AUTH] No ID token in result:', JSON.stringify(signInResult, null, 2));
      throw new Error('No ID token received from Google Sign-In');
    }
    console.log('✅ [AUTH] Got ID token');

    // Create Firebase credential using React Native Firebase
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

    // Get error details
    const errorCode = error?.code || 'unknown';
    const errorMessage = error?.message || 'Sign-in failed';

    console.log('🔍 [AUTH] Error code:', errorCode);
    console.log('🔍 [AUTH] Error message:', errorMessage);

    // Handle specific errors
    if (errorCode === 'sign_in_cancelled' || errorCode === '-5' || errorCode === '12501') {
      const cancelError = new Error('Sign-in was cancelled');
      cancelError.code = 'cancelled';
      throw cancelError;
    }

    if (errorCode === '12500') {
      Alert.alert(
        'Configuration Error',
        'Google Sign-In is not properly configured. Make sure GoogleService-Info.plist is added to your Xcode project.',
        [{ text: 'OK' }]
      );
      const configError = new Error('Google Sign-In configuration error');
      configError.code = '12500';
      throw configError;
    }

    // Show error to user
    Alert.alert(
      'Sign-In Failed',
      errorMessage,
      [{ text: 'OK' }]
    );

    throw error;
  }
};

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export const signOut = async () => {
  try {
    // Configure Google Sign-In before using it
    configureGoogleSignIn();

    // Sign out from Google
    console.log('🔐 [AUTH] Signing out from Google...');
    await GoogleSignin.signOut();
    console.log('✅ [AUTH] Signed out from Google');

    // Sign out from Firebase
    console.log('🔐 [AUTH] Signing out from Firebase...');
    await auth().signOut();
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

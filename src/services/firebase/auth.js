/**
 * Firebase Authentication Service
 * Handles Google Sign-In and user authentication
 */

import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

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
    // Check if device supports Google Play Services
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Get user info from Google
    const { idToken } = await GoogleSignin.signIn();

    // Create Firebase credential
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);

    // Sign in to Firebase with the Google credential
    const userCredential = await auth().signInWithCredential(googleCredential);

    console.log('✅ Signed in with Google:', userCredential.user.email);

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: userCredential.user.displayName,
      photoURL: userCredential.user.photoURL,
    };
  } catch (error) {
    console.error('❌ Google Sign-In Error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));

    if (error.code === 'sign_in_cancelled') {
      throw new Error('Sign-in was cancelled');
    } else if (error.code === 'in_progress') {
      throw new Error('Sign-in is already in progress');
    } else if (error.code === 'play_services_not_available') {
      throw new Error('Google Play Services not available');
    }

    // Pass through the actual error for better debugging
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

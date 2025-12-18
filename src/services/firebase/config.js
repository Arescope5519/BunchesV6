/**
 * Firebase Configuration
 * React Native Firebase - uses native SDKs
 *
 * Configuration is handled by:
 * - iOS: GoogleService-Info.plist (add to Xcode project)
 * - Android: google-services.json (in android/app/)
 */

import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// React Native Firebase initializes automatically from the native config files
// No manual configuration needed - it reads from GoogleService-Info.plist / google-services.json

/**
 * Get Firebase App instance
 */
export const getFirebaseApp = () => {
  return firebase.app();
};

/**
 * Get Firebase Auth instance
 */
export const getFirebaseAuth = () => {
  return auth();
};

/**
 * Get Firebase Firestore instance
 */
export const getFirebaseFirestore = () => {
  return firestore();
};

/**
 * Check if Firebase is properly configured
 */
export const isFirebaseConfigured = () => {
  try {
    const app = firebase.app();
    const options = app.options;

    // Check if we have real config (not placeholder)
    if (!options.projectId || options.projectId === 'YOUR_PROJECT_ID') {
      console.log('⚠️ [FIREBASE] Firebase not configured - missing GoogleService-Info.plist or google-services.json');
      return false;
    }

    console.log('✅ [FIREBASE] Firebase configured with project:', options.projectId);
    return true;
  } catch (error) {
    console.log('❌ [FIREBASE] Error checking config:', error.message);
    return false;
  }
};

export default {
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseFirestore,
  isFirebaseConfigured,
};

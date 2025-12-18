/**
 * Firebase Initialization Service
 * Initializes Firebase JS SDK
 */

import { getFirebaseApp, isFirebaseConfigured } from './config';

let initialized = false;

export const initializeFirebase = async () => {
  if (initialized) {
    console.log('🔥 [FIREBASE] Already initialized');
    return true;
  }

  try {
    // Check if Firebase is configured
    if (!isFirebaseConfigured()) {
      console.log('⚠️ [FIREBASE] Firebase not configured');
      return false;
    }

    // Initialize Firebase app
    const app = getFirebaseApp();

    if (app) {
      console.log('🔥 [FIREBASE] Firebase JS SDK initialized');
      console.log('   - Project ID:', app.options.projectId);
      console.log('   - App ID:', app.options.appId);

      initialized = true;
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ [FIREBASE] Initialization failed:', error);
    console.error('   - Error message:', error.message);
    return false;
  }
};

export const isFirebaseInitialized = () => initialized;

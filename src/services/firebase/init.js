/**
 * Firebase Initialization Service
 * Explicitly initializes Firebase app before use
 */

import { initializeFirebaseApp, getFirebaseApp, firebaseConfig } from './config';

let initialized = false;

export const initializeFirebase = async () => {
  if (initialized) {
    console.log('🔥 [FIREBASE] Already initialized');
    return true;
  }

  try {
    const { app } = initializeFirebaseApp();

    if (app) {
      console.log('🔥 [FIREBASE] Firebase initialized successfully');
      console.log('   - Project ID:', firebaseConfig.projectId);
      initialized = true;
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ [FIREBASE] Initialization failed:', error);
    console.error('   - Error message:', error.message);

    // Provide helpful error messages
    if (error.message.includes('invalid-api-key')) {
      console.error('   → Check your Firebase config in src/services/firebase/config.js');
    }

    return false;
  }
};

export const isFirebaseInitialized = () => initialized;

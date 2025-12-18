/**
 * Firebase Configuration
 * Uses Firebase JS SDK - works on both iOS and Android without native modules
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration from Firebase Console
const firebaseConfig = {
  apiKey: 'AIzaSyDVr5TRpOrhgdMDxMpDQuxdUnMKIlfBqEA',
  authDomain: 'bunchesv6.firebaseapp.com',
  projectId: 'bunchesv6',
  storageBucket: 'bunchesv6.firebasestorage.app',
  messagingSenderId: '307694075211',
  appId: '1:307694075211:ios:cc9943a09a04314f168073',
};

let app = null;
let auth = null;
let firestore = null;

/**
 * Initialize Firebase App
 */
const initializeFirebaseApp = () => {
  if (app) return app;

  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('✅ [FIREBASE] App initialized');
    } else {
      app = getApp();
      console.log('✅ [FIREBASE] Using existing app');
    }
    return app;
  } catch (error) {
    console.error('❌ [FIREBASE] Failed to initialize app:', error);
    return null;
  }
};

/**
 * Get Firebase App instance
 */
export const getFirebaseApp = () => {
  if (!app) {
    initializeFirebaseApp();
  }
  return app;
};

/**
 * Get Firebase Auth instance
 */
export const getFirebaseAuth = () => {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    if (firebaseApp) {
      try {
        // Try to get existing auth instance
        auth = getAuth(firebaseApp);
      } catch (error) {
        // Initialize with React Native persistence
        auth = initializeAuth(firebaseApp, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      }
      console.log('✅ [FIREBASE] Auth initialized');
    }
  }
  return auth;
};

/**
 * Get Firebase Firestore instance
 */
export const getFirebaseFirestore = () => {
  if (!firestore) {
    const firebaseApp = getFirebaseApp();
    if (firebaseApp) {
      firestore = getFirestore(firebaseApp);
      console.log('✅ [FIREBASE] Firestore initialized');
    }
  }
  return firestore;
};

/**
 * Check if Firebase is properly configured
 */
export const isFirebaseConfigured = () => {
  try {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'YOUR_API_KEY') {
      console.log('⚠️ [FIREBASE] Firebase not configured - missing API key');
      return false;
    }

    console.log('✅ [FIREBASE] Firebase configured with project:', firebaseConfig.projectId);
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

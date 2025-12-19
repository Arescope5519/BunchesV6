/**
 * Firebase Configuration
 * Using Firebase compat layer for React Native compatibility
 */

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDbCIFhGnsqWcl9m0y2k4h_v94VoN8Npqc",
  authDomain: "bunches-1f884.firebaseapp.com",
  projectId: "bunches-1f884",
  storageBucket: "bunches-1f884.firebasestorage.app",
  messagingSenderId: "307694075211",
  appId: "1:307694075211:android:0795416c14a84fa537fcce"
};

// Initialize Firebase (only once)
let app = null;
let auth = null;
let db = null;
let initError = null;

console.log('🔥 [FIREBASE] Config module loading...');

export const initializeFirebaseApp = () => {
  console.log('🔥 [FIREBASE] initializeFirebaseApp called');

  try {
    if (firebase.apps.length === 0) {
      console.log('🔥 [FIREBASE] No existing apps, initializing...');
      app = firebase.initializeApp(firebaseConfig);
      console.log('✅ [FIREBASE] App initialized');
    } else {
      console.log('🔥 [FIREBASE] App already exists');
      app = firebase.app();
    }

    auth = firebase.auth();
    console.log('✅ [FIREBASE] Auth initialized');

    db = firebase.firestore();
    console.log('✅ [FIREBASE] Firestore initialized');

    console.log('✅ [FIREBASE] Firebase fully initialized');
    console.log('   - Project ID:', firebaseConfig.projectId);

  } catch (error) {
    console.error('❌ [FIREBASE] CRITICAL ERROR:', error);
    console.error('   - Error name:', error.name);
    console.error('   - Error message:', error.message);
    initError = error;
    throw error;
  }

  return { app, auth, db };
};

export const getInitError = () => initError;

// Get Firebase instances (initialize if needed)
export const getFirebaseApp = () => {
  if (!app) {
    initializeFirebaseApp();
  }
  return app;
};

export const getFirebaseAuth = () => {
  if (!auth) {
    initializeFirebaseApp();
  }
  return auth;
};

export const getFirebaseFirestore = () => {
  if (!db) {
    initializeFirebaseApp();
  }
  return db;
};

// Auto-initialize Firebase when this module is imported
console.log('🔥 [FIREBASE] Auto-initializing...');
try {
  initializeFirebaseApp();
} catch (error) {
  console.error('❌ [FIREBASE] Auto-initialization failed:', error);
}

export { firebaseConfig };

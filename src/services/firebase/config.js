/**
 * Firebase Configuration
 * Firebase JS SDK initialization
 *
 * IMPORTANT: Get your config from Firebase Console:
 * 1. Go to https://console.firebase.google.com/
 * 2. Select your project
 * 3. Click the gear icon (Project Settings)
 * 4. Scroll down to "Your apps" section
 * 5. If you don't have a web app, click "Add app" and select Web
 * 6. Copy the firebaseConfig object values below
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

export const initializeFirebaseApp = () => {
  console.log('🔥 [FIREBASE] initializeFirebaseApp called');

  try {
    if (getApps().length === 0) {
      console.log('🔥 [FIREBASE] No existing apps, initializing...');

      // Step 1: Initialize App
      console.log('🔥 [FIREBASE] Step 1: Initializing app...');
      app = initializeApp(firebaseConfig);
      console.log('✅ [FIREBASE] Step 1 complete: App initialized');

      // Step 2: Initialize Auth (simple - no persistence)
      console.log('🔥 [FIREBASE] Step 2: Initializing Auth...');
      auth = getAuth(app);
      console.log('✅ [FIREBASE] Step 2 complete: Auth initialized');

      // Step 3: Initialize Firestore
      console.log('🔥 [FIREBASE] Step 3: Initializing Firestore...');
      db = getFirestore(app);
      console.log('✅ [FIREBASE] Step 3 complete: Firestore initialized');

      console.log('✅ [FIREBASE] Firebase JS SDK fully initialized');
      console.log('   - Project ID:', firebaseConfig.projectId);
    } else {
      console.log('🔥 [FIREBASE] App already exists, getting instances...');
      app = getApp();
      auth = getAuth(app);
      db = getFirestore(app);
      console.log('✅ [FIREBASE] Got existing instances');
    }
  } catch (error) {
    console.error('❌ [FIREBASE] CRITICAL ERROR during initialization:', error);
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
console.log('🔥 [FIREBASE] Config module loaded, auto-initializing...');
try {
  initializeFirebaseApp();
} catch (error) {
  console.error('❌ [FIREBASE] Auto-initialization failed:', error);
}

export { firebaseConfig };

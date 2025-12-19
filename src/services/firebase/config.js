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
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDbCIFhGnsqWcl9m0y2k4h_v94VoN8Npqc",
  authDomain: "bunches-1f884.firebaseapp.com",
  projectId: "bunches-1f884",
  storageBucket: "bunches-1f884.firebasestorage.app",
  messagingSenderId: "307694075211",
  appId: "1:307694075211:android:0795416c14a84fa537fcce"
};

// Initialize Firebase (only once)
let app;
let auth;
let db;
let initError = null;

export const initializeFirebaseApp = () => {
  console.log('🔥 [FIREBASE] initializeFirebaseApp called');

  try {
    if (getApps().length === 0) {
      console.log('🔥 [FIREBASE] No existing apps, initializing new Firebase JS SDK...');

      // Step 1: Initialize App
      console.log('🔥 [FIREBASE] Step 1: Initializing app...');
      app = initializeApp(firebaseConfig);
      console.log('✅ [FIREBASE] Step 1 complete: App initialized');

      // Step 2: Initialize Auth with AsyncStorage persistence
      console.log('🔥 [FIREBASE] Step 2: Initializing Auth...');
      try {
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
        console.log('✅ [FIREBASE] Step 2 complete: Auth initialized');
      } catch (authError) {
        console.error('❌ [FIREBASE] Auth init error:', authError.message);
        // Try getting existing auth instance
        auth = getAuth(app);
        console.log('✅ [FIREBASE] Got existing Auth instance');
      }

      // Step 3: Initialize Firestore (without persistent cache - can cause issues in RN)
      console.log('🔥 [FIREBASE] Step 3: Initializing Firestore...');
      try {
        db = getFirestore(app);
        console.log('✅ [FIREBASE] Step 3 complete: Firestore initialized');
      } catch (dbError) {
        console.error('❌ [FIREBASE] Firestore init error:', dbError.message);
        throw dbError;
      }

      console.log('✅ [FIREBASE] Firebase JS SDK fully initialized');
      console.log('   - Project ID:', firebaseConfig.projectId);
    } else {
      console.log('🔥 [FIREBASE] App already exists, getting instances...');
      app = getApp();
      try {
        auth = getAuth(app);
      } catch (e) {
        console.log('🔥 [FIREBASE] Getting auth failed, will try initializeAuth');
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage)
        });
      }
      db = getFirestore(app);
      console.log('✅ [FIREBASE] Got existing instances');
    }
  } catch (error) {
    console.error('❌ [FIREBASE] CRITICAL ERROR during initialization:', error);
    console.error('   - Error name:', error.name);
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);
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

export { firebaseConfig };

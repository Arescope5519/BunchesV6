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

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
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

export const initializeFirebaseApp = () => {
  if (getApps().length === 0) {
    console.log('🔥 [FIREBASE] Initializing Firebase JS SDK...');
    app = initializeApp(firebaseConfig);

    // Initialize Auth with AsyncStorage persistence
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });

    // Initialize Firestore with offline persistence
    db = initializeFirestore(app, {
      localCache: persistentLocalCache()
    });

    console.log('✅ [FIREBASE] Firebase JS SDK initialized');
    console.log('   - Project ID:', firebaseConfig.projectId);
  } else {
    app = getApps()[0];
  }

  return { app, auth, db };
};

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

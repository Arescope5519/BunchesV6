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

// TODO: Replace these with your real Firebase config values from Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
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

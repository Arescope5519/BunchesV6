/**
 * Firebase Configuration
 * Firebase is initialized in index.js using require() before this module loads
 * This module just provides access to the Firebase instances
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

console.log('🔥 [CONFIG] Config module loaded');
console.log('🔥 [CONFIG] Firebase apps count:', firebase.apps.length);

// Get Firebase instances (should already be initialized from index.js)
export const getFirebaseApp = () => {
  if (firebase.apps.length === 0) {
    console.log('⚠️ [CONFIG] Firebase not initialized, initializing now...');
    firebase.initializeApp(firebaseConfig);
  }
  return firebase.app();
};

export const getFirebaseAuth = () => {
  if (firebase.apps.length === 0) {
    console.log('⚠️ [CONFIG] Firebase not initialized, initializing now...');
    firebase.initializeApp(firebaseConfig);
  }
  return firebase.auth();
};

export const getFirebaseFirestore = () => {
  if (firebase.apps.length === 0) {
    console.log('⚠️ [CONFIG] Firebase not initialized, initializing now...');
    firebase.initializeApp(firebaseConfig);
  }
  return firebase.firestore();
};

// Legacy export for compatibility
export const initializeFirebaseApp = () => {
  console.log('🔥 [CONFIG] initializeFirebaseApp called');
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }
  return {
    app: firebase.app(),
    auth: firebase.auth(),
    db: firebase.firestore()
  };
};

export { firebaseConfig };

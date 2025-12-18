/**
 * Firebase Availability Checker
 * Checks if Firebase JS SDK is available and configured
 */

import { isFirebaseConfigured } from './config';

let firebaseAvailable = false;
let authAvailable = false;
let firestoreAvailable = false;
const errors = [];

console.log('🔍 [FIREBASE] Checking Firebase JS SDK availability...');

// Check if Firebase JS SDK is available
try {
  require('firebase/app');
  firebaseAvailable = true;
  console.log('✅ [FIREBASE] firebase/app available');
} catch (e) {
  console.log('❌ [FIREBASE] firebase/app NOT available:', e.message);
  console.log('⚠️ [FIREBASE] Running in local-only mode');
  errors.push({
    module: 'firebase/app',
    message: e.message,
  });
}

// Check if Auth is available
try {
  require('firebase/auth');
  authAvailable = firebaseAvailable;
  console.log('✅ [FIREBASE] firebase/auth available');
} catch (e) {
  console.log('❌ [FIREBASE] firebase/auth NOT available:', e.message);
  errors.push({
    module: 'firebase/auth',
    message: e.message,
  });
}

// Check if Firestore is available
try {
  require('firebase/firestore');
  firestoreAvailable = firebaseAvailable;
  console.log('✅ [FIREBASE] firebase/firestore available');
} catch (e) {
  console.log('❌ [FIREBASE] firebase/firestore NOT available:', e.message);
  errors.push({
    module: 'firebase/firestore',
    message: e.message,
  });
}

console.log('📊 [FIREBASE] Availability Summary:');
console.log('   - Firebase:', firebaseAvailable ? '✅ YES' : '❌ NO');
console.log('   - Auth:', authAvailable ? '✅ YES' : '❌ NO');
console.log('   - Firestore:', firestoreAvailable ? '✅ YES' : '❌ NO');

export const isFirebaseAvailable = () => {
  return firebaseAvailable && isFirebaseConfigured();
};

export const isAuthAvailable = () => {
  return authAvailable && isFirebaseConfigured();
};

export const isFirestoreAvailable = () => {
  return firestoreAvailable && isFirebaseConfigured();
};

export const getFirebaseDebugInfo = () => {
  return {
    firebaseAvailable,
    authAvailable,
    firestoreAvailable,
    errors,
  };
};

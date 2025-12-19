/**
 * Firebase Availability Checker
 * Safely checks if Firebase modules are available
 * Uses Firebase compat layer for React Native compatibility
 */

let firebaseAvailable = false;
let authAvailable = false;
let firestoreAvailable = false;
const errors = [];

console.log('🔍 [FIREBASE] Checking Firebase availability...');

// Check if Firebase compat SDK is available
try {
  require('firebase/compat/app');
  firebaseAvailable = true;
  console.log('✅ [FIREBASE] firebase/compat/app available');
} catch (e) {
  console.log('❌ [FIREBASE] firebase/compat/app NOT available:', e.message);
  console.log('⚠️ [FIREBASE] Running in local-only mode');
  errors.push({
    module: 'firebase/compat/app',
    message: e.message,
  });
}

// Check if Auth is available
try {
  require('firebase/compat/auth');
  authAvailable = firebaseAvailable;
  console.log('✅ [FIREBASE] firebase/compat/auth available');
} catch (e) {
  console.log('❌ [FIREBASE] firebase/compat/auth NOT available:', e.message);
  errors.push({
    module: 'firebase/compat/auth',
    message: e.message,
  });
}

// Check if Firestore is available
try {
  require('firebase/compat/firestore');
  firestoreAvailable = firebaseAvailable;
  console.log('✅ [FIREBASE] firebase/compat/firestore available');
} catch (e) {
  console.log('❌ [FIREBASE] firebase/compat/firestore NOT available:', e.message);
  errors.push({
    module: 'firebase/compat/firestore',
    message: e.message,
  });
}

console.log('📊 [FIREBASE] Availability Summary:');
console.log('   - Firebase:', firebaseAvailable ? '✅ YES' : '❌ NO');
console.log('   - Auth:', authAvailable ? '✅ YES' : '❌ NO');
console.log('   - Firestore:', firestoreAvailable ? '✅ YES' : '❌ NO');

export const isFirebaseAvailable = () => {
  console.log('🔍 [FIREBASE] isFirebaseAvailable() called, returning:', firebaseAvailable);
  return firebaseAvailable;
};

export const isAuthAvailable = () => {
  console.log('🔍 [FIREBASE] isAuthAvailable() called, returning:', authAvailable);
  return authAvailable;
};

export const isFirestoreAvailable = () => {
  console.log('🔍 [FIREBASE] isFirestoreAvailable() called, returning:', firestoreAvailable);
  return firestoreAvailable;
};

export const getFirebaseDebugInfo = () => {
  return {
    firebaseAvailable,
    authAvailable,
    firestoreAvailable,
    errors,
  };
};

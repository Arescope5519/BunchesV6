/**
 * Firebase Availability Checker
 * Safely checks if Firebase modules are available
 */

let firebaseAvailable = false;
let authAvailable = false;
let firestoreAvailable = false;
const errors = [];

console.log('🔍 [FIREBASE] Checking Firebase availability...');

// Check if Firebase is available
try {
  require('@react-native-firebase/app');
  firebaseAvailable = true;
  console.log('✅ [FIREBASE] @react-native-firebase/app available');
} catch (e) {
  console.log('❌ [FIREBASE] @react-native-firebase/app NOT available:', e.message);
  console.log('⚠️ [FIREBASE] Running in local-only mode');
  errors.push({
    module: '@react-native-firebase/app',
    message: e.message,
  });
}

// Check if Auth is available
try {
  require('@react-native-firebase/auth');
  authAvailable = firebaseAvailable;
  console.log('✅ [FIREBASE] @react-native-firebase/auth available');
} catch (e) {
  console.log('❌ [FIREBASE] @react-native-firebase/auth NOT available:', e.message);
  errors.push({
    module: '@react-native-firebase/auth',
    message: e.message,
  });
}

// Check if Firestore is available
try {
  require('@react-native-firebase/firestore');
  firestoreAvailable = firebaseAvailable;
  console.log('✅ [FIREBASE] @react-native-firebase/firestore available');
} catch (e) {
  console.log('❌ [FIREBASE] @react-native-firebase/firestore NOT available:', e.message);
  errors.push({
    module: '@react-native-firebase/firestore',
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

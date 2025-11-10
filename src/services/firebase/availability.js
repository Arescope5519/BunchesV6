/**
 * Firebase Availability Checker
 * Safely checks if Firebase modules are available
 */

let firebaseAvailable = false;
let authAvailable = false;
let firestoreAvailable = false;

// Check if Firebase is available
try {
  require('@react-native-firebase/app');
  firebaseAvailable = true;
  console.log('✅ Firebase available');
} catch (e) {
  console.log('⚠️ Firebase not available - running in local-only mode');
}

// Check if Auth is available
try {
  require('@react-native-firebase/auth');
  authAvailable = firebaseAvailable;
} catch (e) {
  console.log('⚠️ Firebase Auth not available');
}

// Check if Firestore is available
try {
  require('@react-native-firebase/firestore');
  firestoreAvailable = firebaseAvailable;
} catch (e) {
  console.log('⚠️ Firebase Firestore not available');
}

export const isFirebaseAvailable = () => firebaseAvailable;
export const isAuthAvailable = () => authAvailable;
export const isFirestoreAvailable = () => firestoreAvailable;

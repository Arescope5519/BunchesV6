/**
 * Firebase Availability Checker
 * Firebase has been removed - running in local-only mode
 */

console.log('📱 [MODE] Running in local-only mode (Firebase disabled)');

export const isFirebaseAvailable = () => false;
export const isAuthAvailable = () => false;
export const isFirestoreAvailable = () => false;

export const getFirebaseDebugInfo = () => ({
  firebaseAvailable: false,
  authAvailable: false,
  firestoreAvailable: false,
  errors: [{ module: 'Firebase', message: 'Firebase removed - using local storage' }],
  mode: 'local-only',
});

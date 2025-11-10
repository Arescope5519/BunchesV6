/**
 * Firebase Initialization Service
 * Explicitly initializes Firebase app before use
 */

let initialized = false;

export const initializeFirebase = async () => {
  if (initialized) {
    console.log('🔥 [FIREBASE] Already initialized');
    return true;
  }

  try {
    const firebase = require('@react-native-firebase/app').default;

    // Check if Firebase is already initialized
    const apps = firebase.apps;

    if (apps && apps.length > 0) {
      console.log('🔥 [FIREBASE] Firebase already initialized');
      initialized = true;
      return true;
    }

    // Firebase should auto-initialize with google-services.json
    // Just verify it's working
    const app = firebase.app();
    console.log('🔥 [FIREBASE] Firebase initialized successfully');
    console.log('   - Project ID:', app.options.projectId);
    console.log('   - App ID:', app.options.appId);
    initialized = true;
    return true;
  } catch (error) {
    console.error('❌ [FIREBASE] Initialization failed:', error);
    console.error('   - Error code:', error.code);
    console.error('   - Error message:', error.message);

    // Provide helpful error messages
    if (error.message.includes('google-services.json')) {
      console.error('   → Make sure google-services.json is in android/app/');
    } else if (error.message.includes('initializeApp')) {
      console.error('   → Firebase not properly configured in build.gradle');
    }

    return false;
  }
};

export const isFirebaseInitialized = () => initialized;

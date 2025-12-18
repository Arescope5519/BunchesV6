/**
 * Firebase Initialization Service
 * React Native Firebase initializes automatically from native config files
 */

import firebase from '@react-native-firebase/app';
import { isFirebaseConfigured } from './config';

let initialized = false;

export const initializeFirebase = async () => {
  if (initialized) {
    console.log('🔥 [FIREBASE] Already initialized');
    return true;
  }

  try {
    // React Native Firebase auto-initializes from GoogleService-Info.plist / google-services.json
    // We just need to verify it's configured
    const app = firebase.app();

    if (app) {
      const options = app.options;
      console.log('🔥 [FIREBASE] React Native Firebase initialized');
      console.log('   - Project ID:', options.projectId);
      console.log('   - App ID:', options.appId);

      initialized = true;
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ [FIREBASE] Initialization failed:', error);
    console.error('   - Error message:', error.message);

    // Provide helpful error messages
    if (error.message.includes('No Firebase App')) {
      console.error('   → Make sure GoogleService-Info.plist is added to your Xcode project');
      console.error('   → Make sure google-services.json is in android/app/');
    }

    return false;
  }
};

export const isFirebaseInitialized = () => initialized;

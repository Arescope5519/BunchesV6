/**
 * Supabase Authentication Service
 * Handles Google Sign-In and user authentication
 */

import { supabase } from './config';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Alert, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

// Client IDs for Google Sign-In
const WEB_CLIENT_ID = '307694075211-2s6oa4lor3ek7v204uc2tjci4hto48n0.apps.googleusercontent.com';
const IOS_CLIENT_ID = '307694075211-20jdrtjddj9tqa3klhkgnj7hocbhjkm1.apps.googleusercontent.com';

// Track if Google Sign-In has been configured
let googleSignInConfigured = false;

/**
 * Generate a random nonce for authentication
 */
const generateNonce = async () => {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  const nonce = Array.from(new Uint8Array(randomBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return nonce;
};

/**
 * Hash a nonce using SHA256
 */
const hashNonce = async (nonce) => {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce
  );
  return hash;
};

/**
 * Configure Google Sign-In
 */
const configureGoogleSignIn = () => {
  if (googleSignInConfigured) {
    return;
  }

  try {
    console.log('🔐 [AUTH] Configuring Google Sign-In...');
    const config = {
      webClientId: WEB_CLIENT_ID,
      offlineAccess: true,
    };

    // On iOS, add the iOS client ID
    if (Platform.OS === 'ios') {
      config.iosClientId = IOS_CLIENT_ID;
    }

    GoogleSignin.configure(config);
    googleSignInConfigured = true;
    console.log('✅ [AUTH] Google Sign-In configured');
  } catch (error) {
    console.error('❌ [AUTH] Failed to configure Google Sign-In:', error);
    throw error;
  }
};

/**
 * Sign in with Google
 * @returns {Promise<Object>} User object
 */
export const signInWithGoogle = async () => {
  configureGoogleSignIn();

  try {
    console.log('🔐 [AUTH] Starting Google Sign-In...');

    // Check Play Services (Android) or just proceed (iOS)
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    // Clear any cached state
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore
    }

    // Generate nonce for iOS
    let rawNonce = null;
    if (Platform.OS === 'ios') {
      rawNonce = await generateNonce();
      const hashedNonce = await hashNonce(rawNonce);
      // Note: react-native-google-signin doesn't support passing nonce directly
      // So we'll try without it first, and if it fails, use a different approach
    }

    // Sign in with Google
    const signInResult = await GoogleSignin.signIn();
    console.log('✅ [AUTH] Google Sign-In successful');

    // Get ID token
    let idToken = signInResult?.idToken || signInResult?.data?.idToken;

    if (!idToken) {
      throw new Error('No ID token received from Google Sign-In');
    }

    // Sign in to Supabase with the Google ID token
    console.log('🔐 [AUTH] Signing in to Supabase...');

    // For Supabase, we need to handle the case where Google's token may or may not have a nonce
    // Try without nonce first (works for Android and some iOS cases)
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      throw error;
    }

    console.log('✅ [AUTH] Supabase sign-in successful:', data.user?.email);

    return {
      uid: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.full_name || data.user.email,
      photoURL: data.user.user_metadata?.avatar_url,
    };
  } catch (error) {
    console.error('❌ Google Sign-In Error:', error);

    Alert.alert(
      'Sign-In Error',
      error.message || 'Failed to sign in',
      [{ text: 'OK' }]
    );

    throw error;
  }
};

/**
 * Sign out current user
 */
export const signOut = async () => {
  try {
    configureGoogleSignIn();

    console.log('🔐 [AUTH] Signing out...');
    await GoogleSignin.signOut();
    await supabase.auth.signOut();
    console.log('✅ [AUTH] Signed out successfully');
  } catch (error) {
    console.error('❌ Sign-Out Error:', error);
    throw error;
  }
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return {
      uid: user.id,
      email: user.email,
      displayName: user.user_metadata?.full_name || user.email,
      photoURL: user.user_metadata?.avatar_url,
    };
  }

  return null;
};

/**
 * Listen to authentication state changes
 * @param {Function} callback - Called when auth state changes
 * @returns {Object} Object with unsubscribe function
 */
export const onAuthStateChanged = (callback) => {
  // Check initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      callback({
        uid: session.user.id,
        email: session.user.email,
        displayName: session.user.user_metadata?.full_name || session.user.email,
        photoURL: session.user.user_metadata?.avatar_url,
      });
    } else {
      callback(null);
    }
  });

  // Listen for auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 [AUTH] Auth state change:', event);

    if (session?.user) {
      callback({
        uid: session.user.id,
        email: session.user.email,
        displayName: session.user.user_metadata?.full_name || session.user.email,
        photoURL: session.user.user_metadata?.avatar_url,
      });
    } else {
      callback(null);
    }
  });

  return {
    unsubscribe: () => subscription.unsubscribe(),
  };
};

export default {
  signInWithGoogle,
  signOut,
  getCurrentUser,
  onAuthStateChanged,
};

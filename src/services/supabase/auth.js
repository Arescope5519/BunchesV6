/**
 * Supabase Authentication Service
 * Handles Google Sign-In and user authentication
 */

import { supabase } from './config';
import { Alert, Platform } from 'react-native';

import { log } from '../../utils/log';
// Lazy load GoogleSignin
let GoogleSignin = null;
const getGoogleSignin = () => {
  if (!GoogleSignin) {
    try {
      GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    } catch (e) {
      log('Google Sign-In not available');
      return null;
    }
  }
  return GoogleSignin;
};

// Client IDs for Google Sign-In
const WEB_CLIENT_ID = '307694075211-2s6oa4lor3ek7v204uc2tjci4hto48n0.apps.googleusercontent.com';
// The Melibri iOS client (bundle app.melibri) - NOT the old
// com.bunchesai.v6 one, which breaks sign-in on the renamed app
const IOS_CLIENT_ID = '307694075211-r3fgaejh8i9auqv2dj5tj3bposcgb7vh.apps.googleusercontent.com';

// Track if Google Sign-In has been configured
let googleSignInConfigured = false;

/**
 * Configure Google Sign-In
 */
const configureGoogleSignIn = () => {
  if (googleSignInConfigured) {
    return;
  }

  try {
    log('🔐 [AUTH] Configuring Google Sign-In...');

    const config = {
      webClientId: WEB_CLIENT_ID,
      scopes: ['profile', 'email'],
      iosClientId: IOS_CLIENT_ID,
    };

    const gs = getGoogleSignin();
    if (gs) {
      gs.configure(config);
      googleSignInConfigured = true;
      log('✅ [AUTH] Google Sign-In configured');
    }
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
  try {
    configureGoogleSignIn();
  } catch (configError) {
    console.error('❌ [AUTH] Configuration failed:', configError);
    Alert.alert('Configuration Error', configError.message);
    throw configError;
  }

  try {
    log('🔐 [AUTH] Starting Google Sign-In...');
    const gs = getGoogleSignin();

    if (!gs) {
      throw new Error('Google Sign-In not available');
    }

    // Clear any cached state
    try {
      await gs.signOut();
    } catch (e) {
      log('🔐 [AUTH] No previous state to clear');
    }

    // Sign in with Google
    const signInResult = await gs.signIn();
    log('✅ [AUTH] Google Sign-In successful');

    // Get ID token
    let idToken = signInResult?.idToken || signInResult?.data?.idToken;

    if (!idToken) {
      throw new Error('No ID token received from Google Sign-In');
    }

    // Sign in to Supabase with the Google ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      throw error;
    }

    log('✅ [AUTH] Supabase sign-in successful:', data.user?.email);

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
 * Sign in with Apple (iOS only). Required by App Store Guideline 4.8
 * because the app offers Google Sign-In. Same token flow as Google:
 * native credential -> identity token -> supabase.auth.signInWithIdToken.
 * Returns null when the user cancels the Apple sheet.
 */
export const signInWithApple = async () => {
  let AppleAuthentication;
  try {
    AppleAuthentication = require('expo-apple-authentication');
  } catch (e) {
    throw new Error('Apple Sign-In is not available on this device');
  }

  let credential;
  try {
    log('🍎 [AUTH] Starting Apple Sign-In...');
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      log('🍎 [AUTH] Apple Sign-In canceled by user');
      return null;
    }
    throw error;
  }

  try {
    if (!credential.identityToken) {
      throw new Error('No identity token received from Apple');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) throw error;

    // Apple only provides the name on the FIRST authorization ever, so
    // persist it into user metadata when we have it - later sign-ins
    // return null and would otherwise leave the account nameless
    const appleName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');
    if (appleName && !data.user.user_metadata?.full_name) {
      supabase.auth.updateUser({ data: { full_name: appleName } })
        .catch(e => log('🍎 Could not store Apple name:', e.message));
    }

    log('✅ [AUTH] Apple sign-in successful:', data.user?.email);

    return {
      uid: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.full_name || appleName || data.user.email,
      photoURL: data.user.user_metadata?.avatar_url || null,
    };
  } catch (error) {
    console.error('❌ Apple Sign-In Error:', error);
    Alert.alert(
      'Sign-In Error',
      error.message || 'Failed to sign in with Apple',
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
    log('🔐 [AUTH] Signing out...');

    const gs = getGoogleSignin();
    if (gs) {
      try {
        await gs.signOut();
      } catch (e) {
        log('🔐 [AUTH] Google sign out failed (may not be signed in):', e.message);
      }
    }

    await supabase.auth.signOut();
    log('✅ [AUTH] Signed out successfully');
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
    log('🔐 [AUTH] Auth state change:', event);

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
  signInWithApple,
  signOut,
  getCurrentUser,
  onAuthStateChanged,
};

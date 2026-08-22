/**
 * FILENAME: src/screens/AuthScreen.js
 * PURPOSE: Authentication screen with Google Sign-In
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import colors from '../constants/colors';
import { signInWithGoogle, signInWithApple } from '../services/supabase/auth';

import { log } from '../utils/log';
import { APP_NAME } from '../constants/app';
export const AuthScreen = ({ onSignIn, onSkipToLocalMode }) => {
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Sign in with Apple only exists on real iOS devices (13+); the
  // module is a safe no-op elsewhere
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      log('✅ User signed in:', user.email);
      if (onSignIn) {
        onSignIn(user);
      }
    } catch (error) {
      console.error('❌ Sign-in error:', error);
      Alert.alert(
        'Sign-In Failed',
        error.message || 'Could not sign in with Google. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const user = await signInWithApple();
      if (!user) return; // canceled the Apple sheet - not an error
      log('✅ User signed in via Apple');
      if (onSignIn) {
        onSignIn(user);
      }
    } catch (error) {
      console.error('❌ Apple sign-in error:', error);
      // signInWithApple already alerted
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.content}>
        {/* Logo/Icon Section */}
        <View style={styles.logoSection}>
          <Ionicons name="restaurant" size={56} color={colors.primary} style={styles.logoIcon} />
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.tagline}>Your Recipe Collection</Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresSection}>
          <View style={styles.feature}>
            <Ionicons name="cloud-done" size={20} color={colors.primary} style={styles.featureIcon} />
            <Text style={styles.featureText}>Cloud Backup</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="sync" size={20} color={colors.primary} style={styles.featureIcon} />
            <Text style={styles.featureText}>Sync Across Devices</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="phone-portrait" size={20} color={colors.primary} style={styles.featureIcon} />
            <Text style={styles.featureText}>Access Anywhere</Text>
          </View>
        </View>

        {/* Sign In Button */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <View style={styles.googleIconContainer}>
                  <Text style={styles.googleIcon}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign in with Apple - App Store Guideline 4.8 requires it
              alongside any third-party sign-in. Official Apple button. */}
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={loading ? () => {} : handleAppleSignIn}
            />
          )}

          <Text style={styles.disclaimer}>
            Sign in to save your recipes to the cloud{'\n'}and sync across all your devices
          </Text>

          {/* Local Mode Button */}
          {onSkipToLocalMode && (
            <TouchableOpacity
              style={styles.localModeButton}
              onPress={onSkipToLocalMode}
              activeOpacity={0.8}
            >
              <Text style={styles.localModeButtonText}>Continue in Local Mode</Text>
              <Text style={styles.localModeSubtext}>
                Use the app without cloud sync
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By signing in, you agree to store your recipes{'\n'}securely in the cloud
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  featuresSection: {
    width: '100%',
    marginBottom: 60,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  featureText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  buttonSection: {
    width: '100%',
    alignItems: 'center',
  },
  appleButton: {
    width: '100%',
    height: 52,
    marginTop: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 20,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  googleButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  disclaimer: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  localModeButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    marginTop: 16,
  },
  localModeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  localModeSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default AuthScreen;

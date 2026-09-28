/**
 * App.js - Main Application Entry Point
 * Handles authentication state and navigation
 */

import React, { useState, useEffect, Component } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, ScrollView, TextInput } from 'react-native';

// Cap how far app text follows the system font-size setting. iOS
// Dynamic Type at large settings scales text 1.3x+ and pushes fixed-row
// layouts (settings switches, dietary chips) off the screen edge. 1.2
// keeps accessibility scaling meaningful while layouts stay intact.
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.maxFontSizeMultiplier = 1.2;
if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.maxFontSizeMultiplier = 1.2;

// iOS: keep the focused text box visible above the keyboard in every
// ScrollView (FlatLists inherit this too). Android ignores the prop and
// resizes the window instead (adjustResize, the Expo default). Screens
// that manage the keyboard themselves can opt out per-instance with
// automaticallyAdjustKeyboardInsets={false}.
if (ScrollView.defaultProps == null) ScrollView.defaultProps = {};
ScrollView.defaultProps.automaticallyAdjustKeyboardInsets = true;

import { onAuthStateChanged, signOut } from './src/services/supabase/auth';
import { getDeletionStatus } from './src/services/supabase/account';
import { getUserProfile, setupUserProfile, isUsernameAvailable } from './src/services/supabase/social';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import PendingDeletionScreen from './src/components/PendingDeletionScreen';
import UsernameSetupModal from './src/components/UsernameSetupModal';
import colors from './src/constants/colors';

import { log } from './src/utils/log';
// Error Boundary to catch crashes
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ERROR BOUNDARY] Caught error:', error);
    console.error('[ERROR BOUNDARY] Error info:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <ScrollView style={errorStyles.scroll}>
            <Text style={errorStyles.title}>App Crashed</Text>
            <Text style={errorStyles.subtitle}>Error Details:</Text>
            <Text style={errorStyles.error}>
              {this.state.error?.toString()}
            </Text>
            <Text style={errorStyles.subtitle}>Stack:</Text>
            <Text style={errorStyles.stack}>
              {this.state.error?.stack}
            </Text>
            <Text style={errorStyles.subtitle}>Component Stack:</Text>
            <Text style={errorStyles.stack}>
              {this.state.errorInfo?.componentStack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20, paddingTop: 50 },
  scroll: { flex: 1 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#ff6b6b', marginBottom: 20 },
  subtitle: { fontSize: 16, fontWeight: 'bold', color: '#ffd93d', marginTop: 15, marginBottom: 5 },
  error: { fontSize: 14, color: '#ffffff', fontFamily: 'monospace' },
  stack: { fontSize: 10, color: '#aaaaaa', fontFamily: 'monospace' },
});

function MainApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(null);
  // null = not checked yet for this user
  const [pendingDeletion, setPendingDeletion] = useState(null);
  // First-run gate: the main app must not mount until the account's
  // profile row (with username) exists. Mounting it earlier lets the
  // Feed and the feature-flag check race profile creation and error
  // out on brand-new accounts. null = checking, 'needs-setup' = show
  // the username screen, 'ready' = profile exists.
  const [profileStatus, setProfileStatus] = useState(null);

  useEffect(() => {
    if (!user) {
      setProfileStatus(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile(user.uid || user.id);
        if (!cancelled) {
          setProfileStatus(profile?.username ? 'ready' : 'needs-setup');
        }
      } catch (err) {
        // Can't reach the profile (offline?). Fail open: existing
        // accounts must still get into the app to read their recipes.
        console.error('[APP] Profile check failed:', err);
        if (!cancelled) setProfileStatus('ready');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, user?.id]);

  const handleUsernameSetup = async (username) => {
    // Throws on failure - the setup screen shows the message
    await setupUserProfile(user.uid || user.id, username);
    setProfileStatus('ready');
    return true;
  };

  // An account in its 30-day grace period is blocked from the app until
  // the user restores it or signs out.
  useEffect(() => {
    if (!user) {
      setPendingDeletion(null);
      return;
    }
    let cancelled = false;
    getDeletionStatus(user.uid || user.id).then(status => {
      if (!cancelled) setPendingDeletion(status);
    });
    return () => { cancelled = true; };
  }, [user?.uid, user?.id]);

  useEffect(() => {
    log('[APP] Setting up auth state listener...');
    try {
      const { unsubscribe } = onAuthStateChanged((userData) => {
        log('[APP] Auth state changed:', userData ? 'Signed in' : 'Signed out');
        setUser(userData);
        setLoading(false);
      });

      return () => {
        log('[APP] Cleaning up auth state listener');
        unsubscribe();
      };
    } catch (error) {
      console.error('[APP] Error setting up auth listener:', error);
      setInitError(error);
      setLoading(false);
    }
  }, []);

  const handleSignIn = (userData) => {
    log('[APP] User signed in:', userData.email);
    setUser(userData);
  };

  if (initError) {
    return (
      <View style={errorStyles.container}>
        <ScrollView>
          <Text style={errorStyles.title}>Initialization Error</Text>
          <Text style={errorStyles.error}>{initError.toString()}</Text>
          <Text style={errorStyles.stack}>{initError.stack}</Text>
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: '#fff', marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  // No local mode: an account is required, so every recipe has a cloud
  // home and devices can't drift apart. Signed-in users still work
  // OFFLINE - the session and recipes live on the device, and sync
  // resumes when the connection returns.
  if (!user) {
    return <AuthScreen onSignIn={handleSignIn} />;
  }

  if (pendingDeletion?.pending) {
    return (
      <PendingDeletionScreen
        purgeAfter={pendingDeletion.purgeAfter}
        onRestored={() => setPendingDeletion({ pending: false, purgeAfter: null })}
        onSignOut={async () => {
          try {
            await signOut();
          } catch (err) {
            console.error('[APP] Sign out failed:', err);
          }
          setUser(null);
          setPendingDeletion(null);
        }}
      />
    );
  }

  // Hold the main app until the profile check settles; brand-new
  // accounts pick their username on a dedicated screen FIRST, so
  // nothing in HomeScreen ever queries before the profile row exists
  if (profileStatus === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: '#fff', marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  if (profileStatus === 'needs-setup') {
    return (
      <View style={styles.loadingContainer}>
        <UsernameSetupModal
          visible
          onSetup={handleUsernameSetup}
          checkAvailability={isUsernameAvailable}
        />
      </View>
    );
  }

  return <HomeScreen user={user} />;
}

export default function App() {
  log('[APP] App component mounting...');
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

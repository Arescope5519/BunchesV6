/**
 * App.js - Main Application Entry Point
 * BunchesV6 - Recipe Extractor with Firebase Authentication
 *
 * REFACTORED: All logic moved to modular components
 */

import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import colors from './src/constants/colors';
import { isFirebaseAvailable, isAuthAvailable, isFirestoreAvailable } from './src/services/firebase/availability';

// Conditionally import Firebase components
let AuthScreen = null;
let onAuthStateChanged = null;
let enableOfflinePersistence = null;

if (isAuthAvailable()) {
  try {
    AuthScreen = require('./src/screens/AuthScreen').default;
    onAuthStateChanged = require('./src/services/firebase/auth').onAuthStateChanged;
  } catch (e) {
    console.error('Failed to load Auth:', e);
  }
}

if (isFirestoreAvailable()) {
  try {
    enableOfflinePersistence = require('./src/services/firebase/firestore').enableOfflinePersistence;
  } catch (e) {
    console.error('Failed to load Firestore:', e);
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseEnabled, setFirebaseEnabled] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      // Safety timeout - stop loading after 3 seconds no matter what
      const timeoutId = setTimeout(() => {
        console.log('⏱️ Initialization timeout - proceeding to app');
        setLoading(false);
      }, 3000);

      try {
        // Check if Firebase is available
        if (isFirebaseAvailable()) {
          console.log('🔥 Firebase enabled');
          setFirebaseEnabled(true);

          // Enable offline persistence for Firestore
          if (enableOfflinePersistence) {
            try {
              await enableOfflinePersistence();
            } catch (e) {
              console.error('Failed to enable offline persistence:', e);
            }
          }

          // Listen for authentication state changes
          if (onAuthStateChanged) {
            const unsubscribe = onAuthStateChanged((authUser) => {
              console.log('Auth state changed:', authUser ? authUser.email : 'Not signed in');
              setUser(authUser);
              setLoading(false);
              clearTimeout(timeoutId);
            });

            // Cleanup subscription on unmount
            return () => {
              unsubscribe();
              clearTimeout(timeoutId);
            };
          } else {
            // No auth available, proceed without it
            console.log('⚠️ Auth not available, skipping authentication');
            setLoading(false);
            clearTimeout(timeoutId);
          }
        } else {
          console.log('📱 Running in local-only mode (Firebase not available)');
          setFirebaseEnabled(false);
          setLoading(false);
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        // Fallback to local-only mode on any error
        setFirebaseEnabled(false);
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    initializeApp();
  }, []);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If Firebase is not available, skip auth and go to HomeScreen
  if (!firebaseEnabled) {
    return <HomeScreen user={null} />;
  }

  // Show Auth screen if not signed in, otherwise show HomeScreen
  if (!user && AuthScreen) {
    return <AuthScreen onSignIn={setUser} />;
  }

  return <HomeScreen user={user} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
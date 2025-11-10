/**
 * App.js - Main Application Entry Point
 * BunchesV6 - Recipe Extractor with Firebase Authentication
 *
 * REFACTORED: All logic moved to modular components
 */

import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import AuthScreen from './src/screens/AuthScreen';
import { onAuthStateChanged } from './src/services/firebase/auth';
import { enableOfflinePersistence } from './src/services/firebase/firestore';
import colors from './src/constants/colors';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Enable offline persistence for Firestore
    enableOfflinePersistence();

    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged((authUser) => {
      console.log('Auth state changed:', authUser ? authUser.email : 'Not signed in');
      setUser(authUser);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show Auth screen if not signed in, otherwise show HomeScreen
  if (!user) {
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
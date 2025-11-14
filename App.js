/**
 * App.js - Main Application Entry Point
 * Handles authentication state and navigation
 */

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { onAuthStateChanged } from './src/services/firebase/auth';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import colors from './src/constants/colors';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    console.log('🔐 [APP] Setting up auth state listener...');
    const unsubscribe = onAuthStateChanged((userData) => {
      console.log('🔐 [APP] Auth state changed:', userData ? 'Signed in' : 'Signed out');
      setUser(userData);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      console.log('🔐 [APP] Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  const handleSignIn = (userData) => {
    console.log('🔐 [APP] User signed in:', userData.email);
    setUser(userData);
  };

  // Show loading screen while checking authentication state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show auth screen if not signed in
  if (!user) {
    return <AuthScreen onSignIn={handleSignIn} />;
  }

  // Show home screen if signed in
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

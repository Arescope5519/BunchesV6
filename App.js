/**
 * App.js - Main Application Entry Point
 * Handles authentication state and navigation
 */

import React, { useState, useEffect, Component } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, ScrollView } from 'react-native';
import { onAuthStateChanged } from './src/services/supabase/auth';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import colors from './src/constants/colors';

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
    console.error('💥 [ERROR BOUNDARY] Caught error:', error);
    console.error('💥 [ERROR BOUNDARY] Error info:', errorInfo);
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

  useEffect(() => {
    console.log('🔐 [APP] Setting up auth state listener...');
    try {
      const { unsubscribe } = onAuthStateChanged((userData) => {
        console.log('🔐 [APP] Auth state changed:', userData ? 'Signed in' : 'Signed out');
        setUser(userData);
        setLoading(false);
      });

      return () => {
        console.log('🔐 [APP] Cleaning up auth state listener');
        unsubscribe();
      };
    } catch (error) {
      console.error('💥 [APP] Error setting up auth listener:', error);
      setInitError(error);
      setLoading(false);
    }
  }, []);

  const handleSignIn = (userData) => {
    console.log('🔐 [APP] User signed in:', userData.email);
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

  if (!user) {
    return <AuthScreen onSignIn={handleSignIn} />;
  }

  return <HomeScreen user={user} />;
}

export default function App() {
  console.log('🚀 [APP] App component mounting...');
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

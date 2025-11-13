/**
 * App.js - Firebase Connection Test
 * Tests Firebase initialization and Google Sign-In module
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, SafeAreaView } from 'react-native';
import colors from './src/constants/colors';

export default function App() {
  const [testResults, setTestResults] = useState([]);
  const [testing, setTesting] = useState(false);

  const addResult = (emoji, message) => {
    setTestResults(prev => [...prev, { emoji, message, time: new Date().toLocaleTimeString() }]);
  };

  const runFirebaseTest = async () => {
    setTesting(true);
    setTestResults([]);
    addResult('🔄', 'Starting Firebase connectivity test...');

    try {
      // Test 1: Check if Firebase module exists
      addResult('🔍', 'Checking Firebase module...');
      const firebase = require('@react-native-firebase/app').default;
      addResult('✅', 'Firebase module loaded');

      // Test 2: Initialize Firebase
      addResult('🔍', 'Initializing Firebase...');
      const app = firebase.app();
      addResult('✅', `Firebase initialized: ${app.options.projectId}`);

      // Test 3: Check GoogleSignin module
      addResult('🔍', 'Checking Google Sign-In module...');
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      addResult('✅', 'Google Sign-In module loaded');

      // Test 4: Check Auth module
      addResult('🔍', 'Checking Firebase Auth...');
      const auth = require('@react-native-firebase/auth').default;
      const authInstance = auth();
      addResult('✅', 'Firebase Auth initialized');

      // Summary
      addResult('🎉', 'ALL TESTS PASSED! Firebase is ready.');
      Alert.alert('✅ Success', 'Firebase is properly configured and ready to use!');

    } catch (error) {
      addResult('❌', `Test failed: ${error.message}`);
      Alert.alert('❌ Test Failed', error.message);
    } finally {
      setTesting(false);
    }
  };

  // Run test automatically on mount
  useEffect(() => {
    runFirebaseTest();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔥 Firebase Connection Test</Text>
      </View>

      <ScrollView style={styles.resultsContainer}>
        {testResults.length === 0 ? (
          <Text style={styles.noResults}>No tests run yet</Text>
        ) : (
          testResults.map((result, index) => (
            <View key={index} style={styles.resultRow}>
              <Text style={styles.resultEmoji}>{result.emoji}</Text>
              <View style={styles.resultTextContainer}>
                <Text style={styles.resultMessage}>{result.message}</Text>
                <Text style={styles.resultTime}>{result.time}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.testButton}
          onPress={runFirebaseTest}
          disabled={testing}
        >
          <Text style={styles.buttonText}>
            {testing ? '⏳ Testing...' : '🔄 Run Test Again'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.clearButton]}
          onPress={() => setTestResults([])}
        >
          <Text style={styles.buttonText}>🗑️ Clear Results</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  resultsContainer: {
    flex: 1,
    padding: 15,
  },
  noResults: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 50,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resultEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultMessage: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  resultTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  buttonContainer: {
    padding: 15,
    gap: 10,
  },
  testButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: colors.textSecondary,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
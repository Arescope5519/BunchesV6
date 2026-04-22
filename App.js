import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  const [log, setLog] = useState([]);

  const addLog = (msg) => {
    console.log(msg);
    setLog(prev => [...prev, msg]);
  };

  useEffect(() => {
    const run = async () => {
      addLog('=== Module Test ===');

      const tests = [
        ['AsyncStorage', () => {
          const AS = require('@react-native-async-storage/async-storage').default;
          return AS.setItem('test', 'value');
        }],
        ['@supabase/supabase-js', () => require('@supabase/supabase-js')],
        ['expo-clipboard', () => require('expo-clipboard')],
        ['expo-file-system', () => require('expo-file-system')],
        ['expo-document-picker', () => require('expo-document-picker')],
        ['expo-sharing', () => require('expo-sharing')],
        ['expo-navigation-bar', () => require('expo-navigation-bar')],
        ['expo-status-bar', () => require('expo-status-bar')],
        ['html-entities', () => require('html-entities')],
        ['./src/constants/colors', () => require('./src/constants/colors')],
        ['./src/services/supabase/config', () => require('./src/services/supabase/config')],
        ['./src/services/supabase/auth', () => require('./src/services/supabase/auth')],
        ['./src/hooks/useShareIntent', () => require('./src/hooks/useShareIntent')],
        ['./src/hooks/useRecipes', () => require('./src/hooks/useRecipes')],
        ['./RecipeExtractor', () => require('./RecipeExtractor')],
        ['./src/screens/AuthScreen', () => require('./src/screens/AuthScreen')],
        ['./src/screens/HomeScreen', () => require('./src/screens/HomeScreen')],
      ];

      for (const [name, test] of tests) {
        try {
          addLog(`Loading: ${name}`);
          await test();
          addLog(`  ✓ OK`);
        } catch (e) {
          addLog(`  ✗ FAIL: ${e.message}`);
          addLog(`  stack: ${(e.stack || '').substring(0, 200)}`);
        }
      }

      addLog('=== Done ===');
    };

    run().catch(e => addLog('UNCAUGHT: ' + e.message));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Module Test</Text>
      <ScrollView style={styles.scroll}>
        {log.map((msg, i) => (
          <Text key={i} style={
            msg.includes('FAIL') || msg.includes('UNCAUGHT') ? styles.error :
            msg.includes('OK') ? styles.success :
            styles.log
          }>
            {msg}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  scroll: { flex: 1 },
  log: { color: '#fff', fontSize: 11, marginBottom: 2, fontFamily: 'monospace' },
  success: { color: '#4ade80', fontSize: 11, marginBottom: 2, fontFamily: 'monospace' },
  error: { color: '#ff6b6b', fontSize: 11, marginBottom: 2, fontFamily: 'monospace' },
});

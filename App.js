import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  const [log, setLog] = useState(['Starting tests...']);

  const addLog = (msg) => {
    console.log(msg);
    setLog(prev => [...prev, msg]);
  };

  useEffect(() => {
    const run = async () => {
      const tests = [
        ['1. AsyncStorage', async () => {
          const AS = require('@react-native-async-storage/async-storage').default;
          await AS.setItem('test', 'ok');
        }],
        ['2. Supabase', () => require('@supabase/supabase-js')],
        ['3. expo-clipboard', () => require('expo-clipboard')],
        ['4. expo-file-system', () => require('expo-file-system')],
        ['5. expo-sharing', () => require('expo-sharing')],
        ['6. expo-navigation-bar', () => require('expo-navigation-bar')],
        ['7. html-entities', () => require('html-entities')],
        ['8. colors constant', () => require('./src/constants/colors')],
        ['9. supabase config', () => require('./src/services/supabase/config')],
        ['10. supabase auth', () => require('./src/services/supabase/auth')],
        ['11. RecipeExtractor', () => require('./RecipeExtractor')],
        ['12. useShareIntent', () => require('./src/hooks/useShareIntent')],
        ['13. useRecipes', () => require('./src/hooks/useRecipes')],
        ['14. AuthScreen', () => require('./src/screens/AuthScreen')],
        ['15. HomeScreen', () => require('./src/screens/HomeScreen')],
      ];

      for (const [name, test] of tests) {
        addLog(`Testing ${name}...`);
        try {
          await test();
          addLog(`  ✓ OK`);
        } catch (e) {
          addLog(`  ✗ FAIL: ${e.message}`);
          break;
        }
      }
      addLog('=== DONE ===');
    };
    run();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import Tester</Text>
      <ScrollView style={styles.scroll}>
        {log.map((msg, i) => (
          <Text key={i} style={msg.includes('FAIL') ? styles.error : msg.includes('OK') ? styles.ok : styles.log}>{msg}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  scroll: { flex: 1 },
  log: { color: '#fff', fontSize: 12, marginBottom: 2 },
  ok: { color: '#4ade80', fontSize: 12, marginBottom: 2 },
  error: { color: '#ff6b6b', fontSize: 12, marginBottom: 2 },
});

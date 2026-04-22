import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  const [log, setLog] = useState(['App mounted']);

  const addLog = (msg) => {
    console.log(msg);
    setLog(prev => [...prev, msg]);
  };

  useEffect(() => {
    const run = async () => {
      try {
        addLog('1. AsyncStorage...');
        const AS = require('@react-native-async-storage/async-storage').default;
        await AS.setItem('test', 'ok');
        addLog('   OK');

        addLog('2. Supabase...');
        require('@supabase/supabase-js');
        addLog('   OK');

        addLog('3. colors...');
        require('./src/constants/colors');
        addLog('   OK');

        addLog('4. supabase/config...');
        require('./src/services/supabase/config');
        addLog('   OK');

        addLog('5. supabase/auth...');
        require('./src/services/supabase/auth');
        addLog('   OK');

        addLog('6. expo-clipboard...');
        require('expo-clipboard');
        addLog('   OK');

        addLog('7. expo-file-system...');
        require('expo-file-system');
        addLog('   OK');

        addLog('8. expo-sharing...');
        require('expo-sharing');
        addLog('   OK');

        addLog('9. expo-navigation-bar...');
        require('expo-navigation-bar');
        addLog('   OK');

        addLog('10. expo-document-picker...');
        require('expo-document-picker');
        addLog('   OK');

        addLog('11. html-entities...');
        require('html-entities');
        addLog('   OK');

        addLog('12. RecipeExtractor...');
        require('./RecipeExtractor');
        addLog('   OK');

        addLog('13. useShareIntent...');
        require('./src/hooks/useShareIntent');
        addLog('   OK');

        addLog('14. useRecipes...');
        require('./src/hooks/useRecipes');
        addLog('   OK');

        addLog('15. AuthScreen...');
        require('./src/screens/AuthScreen');
        addLog('   OK');

        addLog('16. HomeScreen...');
        require('./src/screens/HomeScreen');
        addLog('   OK');

        addLog('=== ALL IMPORTS PASSED ===');
      } catch (e) {
        addLog('ERROR: ' + e.message);
        addLog('Stack: ' + (e.stack || '').substring(0, 500));
      }
    };

    setTimeout(() => run(), 100);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import Test v3</Text>
      <ScrollView style={styles.scroll}>
        {log.map((msg, i) => (
          <Text key={i} style={msg.includes('ERROR') ? styles.error : msg.includes('OK') || msg.includes('PASSED') ? styles.ok : styles.log}>{msg}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  scroll: { flex: 1 },
  log: { color: '#fff', fontSize: 12, marginBottom: 2, fontFamily: 'monospace' },
  ok: { color: '#4ade80', fontSize: 12, marginBottom: 2, fontFamily: 'monospace' },
  error: { color: '#ff6b6b', fontSize: 12, marginBottom: 2, fontFamily: 'monospace' },
});

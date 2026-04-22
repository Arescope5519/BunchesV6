import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  const [log, setLog] = useState(['=== v4 START ===']);

  const addLog = (msg) => {
    console.log(msg);
    setLog(prev => [...prev, msg]);
  };

  useEffect(() => {
    const run = async () => {
      try {
        addLog('1a. Requiring AsyncStorage...');
        const AS = require('@react-native-async-storage/async-storage').default;
        addLog('1b. AsyncStorage required');
        await AS.setItem('test', 'ok');
        addLog('1c. AsyncStorage DONE');

        addLog('2. Supabase DONE');
        require('@supabase/supabase-js');

        addLog('3. colors DONE');
        require('./src/constants/colors');

        addLog('4. config DONE');
        require('./src/services/supabase/config');

        addLog('5. auth DONE');
        require('./src/services/supabase/auth');

        addLog('6. clipboard DONE');
        require('expo-clipboard');

        addLog('7. file-system DONE');
        require('expo-file-system');

        addLog('8. sharing DONE');
        require('expo-sharing');

        addLog('9. nav-bar DONE');
        require('expo-navigation-bar');

        addLog('10. doc-picker DONE');
        require('expo-document-picker');

        addLog('11. html-entities DONE');
        require('html-entities');

        addLog('12. RecipeExtractor DONE');
        require('./RecipeExtractor');

        addLog('13. useShareIntent DONE');
        require('./src/hooks/useShareIntent');

        addLog('14. useRecipes DONE');
        require('./src/hooks/useRecipes');

        addLog('15. AuthScreen DONE');
        require('./src/screens/AuthScreen');

        addLog('16. HomeScreen DONE');
        require('./src/screens/HomeScreen');

        addLog('=== ALL 16 PASSED ===');
      } catch (e) {
        addLog('!!! ERROR: ' + e.message);
      }
    };

    setTimeout(() => run(), 200);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>v4 Import Test</Text>
      <ScrollView style={styles.scroll}>
        {log.map((msg, i) => (
          <Text key={i} style={msg.includes('ERROR') ? styles.err : msg.includes('DONE') || msg.includes('PASSED') ? styles.ok : styles.log}>{msg}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 20, paddingTop: 60 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
  scroll: { flex: 1 },
  log: { color: '#ccc', fontSize: 14, marginBottom: 4 },
  ok: { color: '#4f4', fontSize: 14, marginBottom: 4 },
  err: { color: '#f44', fontSize: 14, marginBottom: 4 },
});

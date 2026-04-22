import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  const [log, setLog] = useState(['=== v5 MINIMAL ===']);

  const addLog = (msg) => {
    console.log(msg);
    setLog(prev => [...prev, msg]);
  };

  useEffect(() => {
    const run = async () => {
      try {
        addLog('1. Requiring AsyncStorage...');
        const AS = require('@react-native-async-storage/async-storage').default;
        addLog('2. Got AsyncStorage');

        addLog('3. Calling setItem...');
        await AS.setItem('test', 'ok');
        addLog('4. setItem DONE');

        addLog('5. Supabase...');
        require('@supabase/supabase-js');
        addLog('6. Supabase DONE');

        addLog('7. colors...');
        require('./src/constants/colors');
        addLog('8. colors DONE');

        addLog('9. config...');
        require('./src/services/supabase/config');
        addLog('10. config DONE');

        addLog('11. auth...');
        require('./src/services/supabase/auth');
        addLog('12. auth DONE');

        addLog('=== ALL PASSED ===');
      } catch (e) {
        addLog('ERROR: ' + e.message);
      }
    };

    setTimeout(() => run(), 200);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>v5 Minimal</Text>
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

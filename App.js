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
        addLog('Step 1: About to require async-storage module');
        const asModule = require('@react-native-async-storage/async-storage');
        addLog('Step 2: Module required successfully');
        addLog('Step 3: Module keys: ' + Object.keys(asModule).join(', '));

        const AsyncStorage = asModule.default;
        addLog('Step 4: Got default export: ' + (AsyncStorage ? 'yes' : 'null'));
        addLog('Step 5: AsyncStorage methods: ' + (AsyncStorage ? Object.keys(AsyncStorage).slice(0,5).join(', ') : 'N/A'));

        addLog('Step 6: About to call getItem...');
        const val = await AsyncStorage.getItem('_test_key_');
        addLog('Step 7: getItem returned: ' + (val === null ? 'null' : val));

        addLog('Step 8: About to call setItem...');
        await AsyncStorage.setItem('_test_key_', 'hello');
        addLog('Step 9: setItem completed!');

        addLog('=== ASYNCSTORAGE OK ===');

        addLog('Step 10: Testing Supabase...');
        require('@supabase/supabase-js');
        addLog('Step 11: Supabase OK');

        addLog('Step 12: Testing colors...');
        require('./src/constants/colors');
        addLog('Step 13: Colors OK');

        addLog('Step 14: Testing supabase config...');
        require('./src/services/supabase/config');
        addLog('Step 15: Config OK');

        addLog('Step 16: Testing auth...');
        require('./src/services/supabase/auth');
        addLog('Step 17: Auth OK');

        addLog('=== ALL TESTS PASSED ===');
      } catch (e) {
        addLog('ERROR: ' + e.message);
        addLog('Stack: ' + (e.stack || '').substring(0, 300));
      }
    };

    setTimeout(() => run(), 100);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug v2</Text>
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
  log: { color: '#fff', fontSize: 11, marginBottom: 2, fontFamily: 'monospace' },
  ok: { color: '#4ade80', fontSize: 11, marginBottom: 2, fontFamily: 'monospace' },
  error: { color: '#ff6b6b', fontSize: 11, marginBottom: 2, fontFamily: 'monospace' },
});

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
      addLog('Step 1: Component mounted');

      try {
        addLog('Step 2: About to require AsyncStorage');
        const asModule = require('@react-native-async-storage/async-storage');
        addLog('Step 3: AsyncStorage module required');

        addLog('Step 4: Getting default export');
        const AsyncStorage = asModule.default;
        addLog('Step 5: Got default: ' + (AsyncStorage ? 'yes' : 'null'));

        addLog('Step 6: About to call getItem');
        const val = await AsyncStorage.getItem('test');
        addLog('Step 7: getItem returned: ' + val);

        addLog('Step 8: About to call setItem');
        await AsyncStorage.setItem('test', 'hello');
        addLog('Step 9: setItem worked!');

        addLog('ALL TESTS PASSED');
      } catch (e) {
        addLog('ERROR: ' + e.message);
        addLog('STACK: ' + (e.stack || 'no stack'));
      }
    };

    run().catch(e => addLog('UNCAUGHT: ' + e.message));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AsyncStorage Debug</Text>
      <ScrollView style={styles.scroll}>
        {log.map((msg, i) => (
          <Text key={i} style={styles.log}>
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
  log: { color: '#fff', fontSize: 12, marginBottom: 3, fontFamily: 'monospace' },
});

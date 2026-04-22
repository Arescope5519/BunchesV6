import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  const [log, setLog] = useState(['=== v7 TEST CLIPBOARD ===']);

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
        addLog('   DONE');

        addLog('2. expo-clipboard...');
        require('expo-clipboard');
        addLog('   DONE');

        addLog('=== CLIPBOARD OK ===');
      } catch (e) {
        addLog('ERROR: ' + e.message);
      }
    };

    setTimeout(() => run(), 200);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>v7 Clipboard</Text>
      <ScrollView style={styles.scroll}>
        {log.map((msg, i) => (
          <Text key={i} style={msg.includes('ERROR') ? styles.err : msg.includes('DONE') || msg.includes('OK') ? styles.ok : styles.log}>{msg}</Text>
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

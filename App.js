import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  const [status, setStatus] = useState('Starting...');
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    const tests = async () => {
      const results = [];

      try {
        setStatus('Testing AsyncStorage...');
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('test', 'value');
        results.push('✓ AsyncStorage works');
      } catch (e) {
        results.push('✗ AsyncStorage: ' + e.message);
      }

      try {
        setStatus('Testing Supabase...');
        const { createClient } = require('@supabase/supabase-js');
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const client = createClient('https://azdhiunzwslogbaiwtgi.supabase.co', 'sb_publishable_9bZ28FxZyT0G5T6_nM8GCg_qyyFVsEc', {
          auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
        });
        results.push('✓ Supabase client created');
      } catch (e) {
        results.push('✗ Supabase: ' + e.message);
      }

      try {
        setStatus('Testing expo-clipboard...');
        require('expo-clipboard');
        results.push('✓ expo-clipboard loaded');
      } catch (e) {
        results.push('✗ expo-clipboard: ' + e.message);
      }

      try {
        setStatus('Testing expo-file-system...');
        require('expo-file-system');
        results.push('✓ expo-file-system loaded');
      } catch (e) {
        results.push('✗ expo-file-system: ' + e.message);
      }

      try {
        setStatus('Testing expo-document-picker...');
        require('expo-document-picker');
        results.push('✓ expo-document-picker loaded');
      } catch (e) {
        results.push('✗ expo-document-picker: ' + e.message);
      }

      try {
        setStatus('Testing expo-sharing...');
        require('expo-sharing');
        results.push('✓ expo-sharing loaded');
      } catch (e) {
        results.push('✗ expo-sharing: ' + e.message);
      }

      try {
        setStatus('Testing expo-navigation-bar...');
        require('expo-navigation-bar');
        results.push('✓ expo-navigation-bar loaded');
      } catch (e) {
        results.push('✗ expo-navigation-bar: ' + e.message);
      }

      try {
        setStatus('Testing html-entities...');
        require('html-entities');
        results.push('✓ html-entities loaded');
      } catch (e) {
        results.push('✗ html-entities: ' + e.message);
      }

      setErrors(results);
      setStatus('Tests complete');
    };

    tests().catch(e => {
      setErrors(['FATAL: ' + e.message]);
      setStatus('Failed');
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Module Test</Text>
      <Text style={styles.status}>{status}</Text>
      <ScrollView style={styles.scroll}>
        {errors.map((err, i) => (
          <Text key={i} style={err.startsWith('✓') ? styles.success : styles.error}>
            {err}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', padding: 20, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  status: { color: '#ffd93d', fontSize: 16, marginBottom: 20 },
  scroll: { flex: 1 },
  success: { color: '#4ade80', fontSize: 14, marginBottom: 5, fontFamily: 'monospace' },
  error: { color: '#ff6b6b', fontSize: 14, marginBottom: 5, fontFamily: 'monospace' },
});

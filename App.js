import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Test Build</Text>
      <Text style={styles.sub}>No plugins, no custom imports</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  text: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  sub: { color: '#aaa', fontSize: 14, marginTop: 10 },
});

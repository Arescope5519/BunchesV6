import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello World</Text>
      <Text style={styles.subtext}>If you see this, the app works!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  text: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtext: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 10,
  },
});

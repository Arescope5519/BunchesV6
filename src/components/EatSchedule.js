/**
 * FILENAME: src/components/EatSchedule.js
 * PURPOSE: Weekly calendar for planning meals - pulls from cooked items in fridge.
 *
 * STATUS: Placeholder for Chunk 2. Basic structure only.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

const EatSchedule = ({ userId, recipes, onOpenRecipe }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🍽️</Text>
      <Text style={styles.title}>Eat Schedule</Text>
      <Text style={styles.text}>
        Coming next: plan when to eat each meal, choosing from what's in the fridge or scheduling a fresh cook.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  icon: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 12 },
  text: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});

export default EatSchedule;

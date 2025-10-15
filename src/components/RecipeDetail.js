/**
 * RecipeDetail Component
 * Displays full recipe details
 * Extracted from your App.js RecipeDetailView
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

export const RecipeDetail = ({ recipe }) => {
  if (!recipe) return null;

  return (
    <>
      <Text style={styles.modalTitle}>{recipe.title}</Text>

      {(recipe.prep_time || recipe.cook_time || recipe.servings) && (
        <View style={styles.metaContainer}>
          {recipe.prep_time && <Text style={styles.metaText}>⏱️ Prep: {recipe.prep_time}</Text>}
          {recipe.cook_time && <Text style={styles.metaText}>🔥 Cook: {recipe.cook_time}</Text>}
          {recipe.servings && <Text style={styles.metaText}>🍽️ Serves: {recipe.servings}</Text>}
        </View>
      )}

      <Text style={styles.sectionTitle}>Ingredients</Text>
      {Object.entries(recipe.ingredients).map(([section, items]) => (
        <View key={section} style={styles.ingredientSection}>
          {section !== 'main' && (
            <Text style={styles.subsectionTitle}>{section}</Text>
          )}
          {items.map((item, idx) => (
            <Text key={idx} style={styles.ingredientItem}>• {item}</Text>
          ))}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Instructions</Text>
      {recipe.instructions.map((step, idx) => (
        <View key={idx} style={styles.instructionStep}>
          <Text style={styles.stepNumber}>{idx + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}

      <View style={styles.sourceContainer}>
        <Text style={styles.sourceLabel}>Source:</Text>
        <Text style={styles.sourceUrl}>{recipe.url}</Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 15,
  },
  metaText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  ingredientSection: {
    marginBottom: 15,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: colors.text,
  },
  ingredientItem: {
    fontSize: 15,
    marginBottom: 5,
    color: colors.text,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: 10,
    minWidth: 25,
  },
  stepText: {
    fontSize: 15,
    flex: 1,
    color: colors.text,
  },
  sourceContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
  },
  sourceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 5,
  },
  sourceUrl: {
    fontSize: 12,
    color: colors.primary,
  },
});

export default RecipeDetail;
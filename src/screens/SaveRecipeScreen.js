/**
 * FILENAME: src/screens/SaveRecipeScreen.js
 * PURPOSE: Dedicated screen for reviewing and saving extracted recipes
 * USED BY: HomeScreen when sharing recipes from browser
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import colors from '../constants/colors';

export const SaveRecipeScreen = ({ recipe, folders, onSave, onCancel }) => {
  const [selectedFolder, setSelectedFolder] = useState('All Recipes');

  const handleSave = () => {
    if (onSave) {
      onSave(selectedFolder);
    }
  };

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>No Recipe</Text>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancelButton}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.errorText}>No recipe data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ingredientCount = recipe.ingredients
    ? Object.values(recipe.ingredients).flat().length
    : 0;

  const instructionCount = recipe.instructions?.length || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Save Recipe</Text>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancelButton}>✕ Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Recipe Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>

          <View style={styles.metaRow}>
            {recipe.source && (
              <Text style={styles.metaText}>📍 {recipe.source}</Text>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{ingredientCount}</Text>
              <Text style={styles.statLabel}>Ingredients</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{instructionCount}</Text>
              <Text style={styles.statLabel}>Steps</Text>
            </View>
            {recipe.prep_time && (
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{recipe.prep_time}</Text>
                <Text style={styles.statLabel}>Prep</Text>
              </View>
            )}
            {recipe.cook_time && (
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{recipe.cook_time}</Text>
                <Text style={styles.statLabel}>Cook</Text>
              </View>
            )}
          </View>

          {recipe.url && (
            <Text style={styles.urlText} numberOfLines={1}>
              🔗 {recipe.url}
            </Text>
          )}
        </View>

        {/* Folder Selection */}
        <View style={styles.folderSection}>
          <Text style={styles.sectionTitle}>Save to Cookbook:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.folderScroll}
          >
            {folders
              .filter(f => f !== 'Favorites' && f !== 'Recently Deleted')
              .map((folder) => (
                <TouchableOpacity
                  key={folder}
                  style={[
                    styles.folderChip,
                    selectedFolder === folder && styles.folderChipSelected
                  ]}
                  onPress={() => setSelectedFolder(folder)}
                >
                  <Text style={[
                    styles.folderChipText,
                    selectedFolder === folder && styles.folderChipTextSelected
                  ]}>
                    {folder}
                  </Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>

        {/* Preview of ingredients and instructions */}
        {recipe.ingredients && Object.keys(recipe.ingredients).length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Ingredients Preview:</Text>
            {Object.entries(recipe.ingredients).slice(0, 2).map(([section, items]) => (
              <View key={section} style={styles.ingredientSection}>
                {section !== 'main' && (
                  <Text style={styles.subsectionTitle}>{section}</Text>
                )}
                {items.slice(0, 3).map((item, idx) => (
                  <Text key={idx} style={styles.ingredientItem}>• {item}</Text>
                ))}
                {items.length > 3 && (
                  <Text style={styles.moreText}>+ {items.length - 3} more...</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {recipe.instructions && recipe.instructions.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Instructions Preview:</Text>
            {recipe.instructions.slice(0, 2).map((instruction, idx) => (
              <Text key={idx} style={styles.instructionItem}>
                {idx + 1}. {instruction}
              </Text>
            ))}
            {recipe.instructions.length > 2 && (
              <Text style={styles.moreText}>+ {recipe.instructions.length - 2} more steps...</Text>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>💾 Save to {selectedFolder}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  cancelButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  previewSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  metaRow: {
    marginBottom: 12,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  urlText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 8,
  },
  folderSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  folderScroll: {
    marginHorizontal: -4,
  },
  folderChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.lightGray,
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  folderChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  folderChipText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  folderChipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  detailSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
  },
  ingredientSection: {
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  ingredientItem: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  instructionItem: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
    lineHeight: 20,
  },
  moreText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
});

export default SaveRecipeScreen;

/**
 * FILENAME: src/screens/CreateRecipeScreen.js
 * PURPOSE: Manual recipe creation/editing
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import colors from '../constants/colors';

export const CreateRecipeScreen = ({ onSave, onClose, folders }) => {
  const [title, setTitle] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('All Recipes');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a recipe title');
      return;
    }

    if (!ingredients.trim()) {
      Alert.alert('Missing Ingredients', 'Please add at least one ingredient');
      return;
    }

    // Parse ingredients (one per line)
    const ingredientLines = ingredients
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Parse instructions (one per line for steps)
    const instructionLines = instructions
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const recipe = {
      id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title.trim(),
      folder: selectedFolder,
      ingredients: {
        main: ingredientLines,
      },
      instructions: instructionLines.length > 0 ? instructionLines : ['No instructions provided'],
      source: 'manual',
      createdAt: Date.now(),
      isFavorite: false,
    };

    onSave(recipe);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" hidden={true} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Recipe</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Recipe Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Grandma's Chocolate Cake"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
        </View>

        {/* Cookbook Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Cookbook</Text>
          <TouchableOpacity
            style={styles.folderSelector}
            onPress={() => setShowFolderPicker(!showFolderPicker)}
          >
            <Text style={styles.folderSelectorText}>📖 {selectedFolder}</Text>
            <Text style={styles.folderSelectorArrow}>▼</Text>
          </TouchableOpacity>

          {showFolderPicker && (
            <View style={styles.folderPicker}>
              {folders.map((folder) => (
                <TouchableOpacity
                  key={folder}
                  style={[
                    styles.folderOption,
                    selectedFolder === folder && styles.folderOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedFolder(folder);
                    setShowFolderPicker(false);
                  }}
                >
                  <Text style={[
                    styles.folderOptionText,
                    selectedFolder === folder && styles.folderOptionTextSelected
                  ]}>
                    {folder}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.label}>Ingredients *</Text>
          <Text style={styles.hint}>One ingredient per line</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="2 cups flour&#10;1 cup sugar&#10;3 eggs&#10;1 tsp vanilla extract"
            value={ingredients}
            onChangeText={setIngredients}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.label}>Instructions</Text>
          <Text style={styles.hint}>One step per line (optional)</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Preheat oven to 350°F&#10;Mix dry ingredients&#10;Add wet ingredients&#10;Bake for 30 minutes"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  closeButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  multilineInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  folderSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
  },
  folderSelectorText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  folderSelectorArrow: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  folderPicker: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  folderOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  folderOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  folderOptionText: {
    fontSize: 15,
    color: colors.text,
  },
  folderOptionTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  bottomSpacer: {
    height: 60,
  },
});

export default CreateRecipeScreen;

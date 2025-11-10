/**
 * FILENAME: src/screens/CreateRecipeScreen.js
 * PURPOSE: Manual recipe creation/editing with structured inputs
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
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  // Structured ingredients: [{ quantity: '', text: '' }]
  const [ingredients, setIngredients] = useState([{ quantity: '', text: '' }]);

  // Instructions: ['instruction 1', 'instruction 2', ...]
  const [instructions, setInstructions] = useState(['']);
  const [selectedInstructionIndex, setSelectedInstructionIndex] = useState(0);

  // Add ingredient
  const addIngredient = () => {
    setIngredients([...ingredients, { quantity: '', text: '' }]);
  };

  // Remove ingredient
  const removeIngredient = (index) => {
    if (ingredients.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one ingredient');
      return;
    }
    const newIngredients = ingredients.filter((_, i) => i !== index);
    setIngredients(newIngredients);
  };

  // Update ingredient
  const updateIngredient = (index, field, value) => {
    const newIngredients = [...ingredients];
    newIngredients[index][field] = value;
    setIngredients(newIngredients);
  };

  // Add instruction below currently selected
  const addInstructionBelow = () => {
    const newInstructions = [...instructions];
    newInstructions.splice(selectedInstructionIndex + 1, 0, '');
    setInstructions(newInstructions);
    setSelectedInstructionIndex(selectedInstructionIndex + 1);
  };

  // Remove instruction
  const removeInstruction = (index) => {
    if (instructions.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one instruction');
      return;
    }
    const newInstructions = instructions.filter((_, i) => i !== index);
    setInstructions(newInstructions);
    if (selectedInstructionIndex >= newInstructions.length) {
      setSelectedInstructionIndex(newInstructions.length - 1);
    }
  };

  // Update instruction
  const updateInstruction = (index, value) => {
    const newInstructions = [...instructions];
    newInstructions[index] = value;
    setInstructions(newInstructions);
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a recipe title');
      return;
    }

    // Validate ingredients
    const validIngredients = ingredients.filter(ing => ing.text.trim().length > 0);
    if (validIngredients.length === 0) {
      Alert.alert('Missing Ingredients', 'Please add at least one ingredient');
      return;
    }

    // Format ingredients for storage
    const formattedIngredients = validIngredients.map(ing => {
      const quantity = ing.quantity.trim();
      const text = ing.text.trim();
      return quantity ? `${quantity} ${text}` : text;
    });

    // Validate instructions
    const validInstructions = instructions.filter(inst => inst.trim().length > 0);
    if (validInstructions.length === 0) {
      Alert.alert('Missing Instructions', 'Please add at least one instruction');
      return;
    }

    const recipe = {
      id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title.trim(),
      folder: selectedFolder,
      ingredients: {
        main: formattedIngredients,
      },
      instructions: validInstructions,
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
              <ScrollView style={styles.folderPickerScroll} nestedScrollEnabled={true}>
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
              </ScrollView>
            </View>
          )}
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Ingredients *</Text>
            <TouchableOpacity onPress={addIngredient} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {ingredients.map((ingredient, index) => (
            <View key={index} style={styles.ingredientRow}>
              <TextInput
                style={styles.quantityInput}
                placeholder="Qty"
                value={ingredient.quantity}
                onChangeText={(text) => updateIngredient(index, 'quantity', text)}
                keyboardType="default"
              />
              <TextInput
                style={styles.ingredientTextInput}
                placeholder="e.g., cups flour"
                value={ingredient.text}
                onChangeText={(text) => updateIngredient(index, 'text', text)}
              />
              {ingredients.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeIngredient(index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Instructions *</Text>
            <TouchableOpacity
              onPress={addInstructionBelow}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Add Below</Text>
            </TouchableOpacity>
          </View>

          {instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionRow}>
              <View style={styles.instructionHeader}>
                <Text style={styles.stepNumber}>Step {index + 1}</Text>
                {instructions.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeInstruction(index)}
                    style={styles.removeInstructionButton}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[
                  styles.instructionInput,
                  selectedInstructionIndex === index && styles.instructionInputSelected
                ]}
                placeholder={`Enter step ${index + 1}...`}
                value={instruction}
                onChangeText={(text) => updateInstruction(index, text)}
                onFocus={() => setSelectedInstructionIndex(index)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ))}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  folderPickerScroll: {
    maxHeight: 250,
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
  ingredientRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  quantityInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    width: 80,
    marginRight: 8,
  },
  ingredientTextInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  removeButton: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionRow: {
    marginBottom: 16,
  },
  instructionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  removeInstructionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  instructionInputSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  bottomSpacer: {
    height: 60,
  },
});

export default CreateRecipeScreen;

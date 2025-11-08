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
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import colors from '../constants/colors';

export const SaveRecipeScreen = ({ recipe, folders, onSave, onCancel }) => {
  const [selectedFolder, setSelectedFolder] = useState('All Recipes');

  // Local editable copy of recipe data
  const [localRecipe, setLocalRecipe] = useState(recipe);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editField, setEditField] = useState('');
  const [editValue, setEditValue] = useState('');

  const handleSave = () => {
    if (onSave) {
      onSave(selectedFolder, localRecipe); // Pass modified recipe
    }
  };

  const handleLongPress = (field, currentValue) => {
    setEditField(field);
    setEditValue(currentValue || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (editField) {
      setLocalRecipe({
        ...localRecipe,
        [editField]: editValue.trim()
      });
    }
    setShowEditModal(false);
    setEditField('');
    setEditValue('');
  };

  const getFieldLabel = (field) => {
    const labels = {
      title: 'Recipe Title',
      prep_time: 'Prep Time',
      cook_time: 'Cook Time',
      total_time: 'Total Time',
      servings: 'Servings',
    };
    return labels[field] || field;
  };

  if (!localRecipe) {
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

  const ingredientCount = localRecipe.ingredients
    ? Object.values(localRecipe.ingredients).flat().length
    : 0;

  const instructionCount = localRecipe.instructions?.length || 0;

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
          <TouchableOpacity
            onLongPress={() => handleLongPress('title', localRecipe.title)}
            delayLongPress={500}
          >
            <Text style={styles.recipeTitle}>{localRecipe.title}</Text>
            <Text style={styles.editHint}>Long press to edit</Text>
          </TouchableOpacity>

          <View style={styles.metaRow}>
            {localRecipe.source && (
              <Text style={styles.metaText}>📍 {localRecipe.source}</Text>
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
            {localRecipe.prep_time && (
              <TouchableOpacity
                style={styles.statItem}
                onLongPress={() => handleLongPress('prep_time', localRecipe.prep_time)}
                delayLongPress={500}
              >
                <Text style={styles.statNumber}>{localRecipe.prep_time}</Text>
                <Text style={styles.statLabel}>Prep</Text>
              </TouchableOpacity>
            )}
            {localRecipe.cook_time && (
              <TouchableOpacity
                style={styles.statItem}
                onLongPress={() => handleLongPress('cook_time', localRecipe.cook_time)}
                delayLongPress={500}
              >
                <Text style={styles.statNumber}>{localRecipe.cook_time}</Text>
                <Text style={styles.statLabel}>Cook</Text>
              </TouchableOpacity>
            )}
            {localRecipe.total_time && (
              <TouchableOpacity
                style={styles.statItem}
                onLongPress={() => handleLongPress('total_time', localRecipe.total_time)}
                delayLongPress={500}
              >
                <Text style={styles.statNumber}>{localRecipe.total_time}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </TouchableOpacity>
            )}
            {localRecipe.servings && (
              <TouchableOpacity
                style={styles.statItem}
                onLongPress={() => handleLongPress('servings', localRecipe.servings)}
                delayLongPress={500}
              >
                <Text style={styles.statNumber}>{localRecipe.servings}</Text>
                <Text style={styles.statLabel}>Servings</Text>
              </TouchableOpacity>
            )}
          </View>

          {localRecipe.url && (
            <Text style={styles.urlText} numberOfLines={1}>
              🔗 {localRecipe.url}
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

        {/* Full Ingredients List */}
        {localRecipe.ingredients && Object.keys(localRecipe.ingredients).length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Ingredients:</Text>
            {Object.entries(localRecipe.ingredients).map(([section, items]) => (
              <View key={section} style={styles.ingredientSection}>
                {section !== 'main' && (
                  <Text style={styles.subsectionTitle}>{section}</Text>
                )}
                {items.map((item, idx) => (
                  <Text key={idx} style={styles.ingredientItem}>• {item}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Full Instructions List */}
        {localRecipe.instructions && localRecipe.instructions.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Instructions:</Text>
            {localRecipe.instructions.map((instruction, idx) => (
              <Text key={idx} style={styles.instructionItem}>
                {idx + 1}. {instruction}
              </Text>
            ))}
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

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>Edit {getFieldLabel(editField)}</Text>
            <TextInput
              style={styles.editInput}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={`Enter ${getFieldLabel(editField).toLowerCase()}`}
              autoFocus
              multiline={editField === 'title'}
            />
            <View style={styles.editModalButtons}>
              <TouchableOpacity
                style={[styles.editModalButton, styles.cancelEditButton]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelEditButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editModalButton, styles.saveEditButton]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveEditButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 4,
  },
  editHint: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  editInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    maxHeight: 120,
  },
  editModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelEditButton: {
    backgroundColor: colors.lightGray,
  },
  cancelEditButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  saveEditButton: {
    backgroundColor: colors.primary,
  },
  saveEditButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default SaveRecipeScreen;

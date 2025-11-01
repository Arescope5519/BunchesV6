/**
 * FILENAME: src/components/RecipeDetail/SectionEditor.js
 * PURPOSE: Edit section headers with improved UX
 * NEW: Hold to edit, tap other sections to swap, tap ingredients to move
 * USED BY: src/components/RecipeDetail/IngredientsSection.js
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../constants/colors';

const SectionEditor = ({
  section,
  isEditing,
  actionMode,
  onLongPress,
  onTap,
  onRename,
  onDelete,
  onCancel
}) => {
  const [tempName, setTempName] = useState(section);

  const handleSave = () => {
    if (tempName.trim() && tempName !== section) {
      onRename(tempName.trim());
    }
    onCancel();
  };

  // Show editing controls when this section is being edited
  if (isEditing && actionMode?.type === 'editing') {
    return (
      <View style={styles.editContainer}>
        <TextInput
          style={styles.sectionInput}
          value={tempName}
          onChangeText={setTempName}
          placeholder="Section name..."
          autoFocus
        />
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>✓ Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>
          📍 Tap another section to swap, or tap an ingredient to move above it
        </Text>
      </View>
    );
  }

  // Check if another section is being edited (for highlighting swap targets)
  const isSwapTarget = actionMode?.type === 'editing' && actionMode?.sectionKey !== section;

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      onPress={onTap}
      delayLongPress={300}
    >
      <Text style={[
        styles.sectionTitle,
        isSwapTarget && styles.swapTarget
      ]}>
        {section}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: colors.text,
    padding: 4,
    borderRadius: 4,
  },
  swapTarget: {
    backgroundColor: colors.lightPrimary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  editContainer: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: colors.highlightYellow,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  sectionInput: {
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.success,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: colors.error,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default SectionEditor;

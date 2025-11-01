/**
 * FILENAME: src/components/RecipeDetail/IngredientItem.js
 * PURPOSE: Display and edit individual ingredient items
 * FIXES: No auto-keyboard, save-then-add-below, move places below target
 * USED BY: src/components/RecipeDetail/IngredientsSection.js
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../constants/colors';

const IngredientItem = ({
  item,
  section,
  index,
  isEditing,
  isMoveMode,
  isMoveTarget,
  onTap,
  onLongPress,
  onEditChange,
  onSave,
  onDelete,
  onStartMove,
  onAddBelow
}) => {
  const [showAddField, setShowAddField] = useState(false);
  const [newItemValue, setNewItemValue] = useState('');

  // Format the displayed item
  const formatIngredient = (ingredient) => {
    if (typeof ingredient === 'string') return ingredient;

    const parts = [];
    if (ingredient.quantity) parts.push(ingredient.quantity);
    if (ingredient.unit) parts.push(ingredient.unit);
    if (ingredient.item) parts.push(ingredient.item);
    if (ingredient.notes) parts.push(`(${ingredient.notes})`);

    return parts.join(' ');
  };

  const displayText = formatIngredient(item);

  const handleAddBelow = () => {
    // First save any current edits
    if (onSave) {
      onSave();
    }
    // Then show the add field
    setShowAddField(true);
    setNewItemValue('');
  };

  const saveNewItem = () => {
    if (newItemValue.trim()) {
      onAddBelow(newItemValue.trim());
      setShowAddField(false);
      setNewItemValue('');
    }
  };

  const cancelAdd = () => {
    setShowAddField(false);
    setNewItemValue('');
  };

  // Editing mode for this ingredient
  if (isEditing) {
    return (
      <View style={styles.editContainer}>
        <TextInput
          style={styles.ingredientInput}
          value={typeof item === 'string' ? item : displayText}
          onChangeText={onEditChange}
          autoFocus={false}  // Don't auto-show keyboard on long press
          multiline
        />
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Text style={styles.buttonText}>✓ Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moveButton} onPress={onStartMove}>
            <Text style={styles.buttonText}>↕️ Move</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddBelow}>
            <Text style={styles.buttonText}>+ Below</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.buttonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show add field below this item
  if (showAddField) {
    return (
      <>
        <Text style={styles.ingredientItem}>{displayText}</Text>
        <View style={styles.addBelowContainer}>
          <Text style={styles.addBelowPrefix}>→</Text>
          <TextInput
            style={styles.addBelowInput}
            value={newItemValue}
            onChangeText={setNewItemValue}
            placeholder="New ingredient..."
            autoFocus={true}  // DO focus here since user explicitly wants to add
            onSubmitEditing={saveNewItem}
          />
          <TouchableOpacity style={styles.inlineButton} onPress={saveNewItem}>
            <Text style={styles.inlineButtonText}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inlineButton} onPress={cancelAdd}>
            <Text style={styles.inlineButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // Normal display mode
  return (
    <TouchableOpacity
      onLongPress={() => onLongPress(typeof item === 'string' ? item : displayText)}
      onPress={onTap}
      delayLongPress={300}
    >
      <View style={[
        styles.itemContainer,
        isMoveMode && styles.moveMode,
        isMoveTarget && styles.moveTarget
      ]}>
        {isMoveMode && (
          <Text style={styles.dragHandle}>≡</Text>
        )}
        <Text style={styles.ingredientItem}>
          {displayText}
        </Text>
        {isMoveTarget && (
          <Text style={styles.dropHint}>↓ Drop here</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 5,
    borderRadius: 4,
  },
  moveMode: {
    backgroundColor: colors.highlightYellow,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  moveTarget: {
    backgroundColor: colors.lightPrimary || '#E3F2FD',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'solid',
    marginVertical: 8,
  },
  dragHandle: {
    fontSize: 18,
    marginRight: 8,
    color: colors.primary,
    fontWeight: 'bold',
  },
  dropHint: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 'auto',
    fontStyle: 'italic',
  },
  ingredientItem: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  editContainer: {
    marginBottom: 8,
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ingredientInput: {
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.white,
    marginBottom: 8,
    minHeight: 40,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  saveButton: {
    backgroundColor: colors.success,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  moveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: colors.error,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButton: {
    backgroundColor: colors.secondary || '#6C757D',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  addBelowContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginLeft: 20,
    alignItems: 'center',
  },
  addBelowPrefix: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
  addBelowInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    padding: 8,
    backgroundColor: colors.white,
    fontSize: 14,
  },
  inlineButton: {
    padding: 8,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  inlineButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default IngredientItem;
/**
 * FILENAME: src/components/RecipeDetail/IngredientsSection.js
 * PURPOSE: Display and manage recipe ingredients with sections
 * NEW: Improved move mode and immediate add-below functionality
 * USED BY: src/components/RecipeDetail.js
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import colors from '../../constants/colors';
import IngredientItem from './IngredientItem';
import SectionEditor from './SectionEditor';

const IngredientsSection = ({
  ingredients,
  displayedIngredients,
  editingSection,
  sectionActionMode,
  onEditSection,
  onSectionAction,
  onUpdate
}) => {
  const [editingItem, setEditingItem] = useState(null);
  const [moveMode, setMoveMode] = useState(null); // { sectionKey, index }

  // Handle move mode
  const startMoveMode = () => {
    if (editingItem) {
      setMoveMode({ sectionKey: editingItem.sectionKey, index: editingItem.index });
      setEditingItem(null);
    }
  };

  const handleIngredientTap = (targetSection, targetIndex) => {
    // If in move mode, move the item
    if (moveMode) {
      moveIngredient(moveMode.sectionKey, moveMode.index, targetSection, targetIndex);
      setMoveMode(null);
      return;
    }

    // If section is being edited, move section above ingredient
    if (sectionActionMode?.type === 'editing') {
      moveSectionAboveIngredient(sectionActionMode.sectionKey, targetSection, targetIndex);
      onSectionAction(null);
      onEditSection(null);
    }
  };

  const moveIngredient = (fromSection, fromIndex, toSection, toIndex) => {
    const updated = { ...ingredients };

    // Get the item to move
    const itemToMove = updated[fromSection][fromIndex];

    // Remove from original position
    updated[fromSection].splice(fromIndex, 1);

    // Add BELOW the target position (so +1 to index)
    if (fromSection === toSection && toIndex > fromIndex) {
      // If moving within same section after removal, no adjustment needed
      updated[toSection].splice(toIndex, 0, itemToMove);
    } else {
      // Add after the target item (below it)
      updated[toSection].splice(toIndex + 1, 0, itemToMove);
    }

    // Clean up empty sections (except 'main')
    if (updated[fromSection].length === 0 && fromSection !== 'main') {
      delete updated[fromSection];
    }

    onUpdate(updated);
  };

  const handleAddBelow = (sectionKey, index, newValue) => {
    const updated = { ...ingredients };
    updated[sectionKey].splice(index + 1, 0, newValue);
    onUpdate(updated);
  };

  // Handle section operations
  const handleSectionLongPress = (sectionKey) => {
    onEditSection(sectionKey);
    onSectionAction({ type: 'editing', sectionKey });
  };

  const handleSectionTap = (sectionKey) => {
    if (!sectionActionMode) return;

    if (sectionActionMode.type === 'editing' && sectionActionMode.sectionKey !== sectionKey) {
      swapSections(sectionActionMode.sectionKey, sectionKey);
      onSectionAction(null);
      onEditSection(null);
    }
  };

  const swapSections = (section1, section2) => {
    const entries = Object.entries(ingredients);
    const index1 = entries.findIndex(([key]) => key === section1);
    const index2 = entries.findIndex(([key]) => key === section2);

    if (index1 === -1 || index2 === -1) return;

    [entries[index1], entries[index2]] = [entries[index2], entries[index1]];

    const updated = Object.fromEntries(entries);
    onUpdate(updated);
  };

  const moveSectionAboveIngredient = (movingSection, targetSection, targetIndex) => {
    const newIngredients = {};
    const movingSectionItems = ingredients[movingSection] || [];

    Object.entries(ingredients).forEach(([key, items]) => {
      if (key === targetSection) {
        const newItems = [...items];
        newItems.splice(targetIndex, 0, ...movingSectionItems);
        newIngredients[key] = newItems;
      } else if (key !== movingSection) {
        newIngredients[key] = [...items];
      }
    });

    onUpdate(newIngredients);
  };

  const deleteSection = (sectionKey) => {
    Alert.alert(
      'Delete Section?',
      `This will delete the "${sectionKey}" section and all its ingredients.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = { ...ingredients };
            delete updated[sectionKey];
            onUpdate(updated);
            onSectionAction(null);
            onEditSection(null);
          }
        }
      ]
    );
  };

  const renameSection = (oldKey, newKey) => {
    if (!newKey.trim() || oldKey === newKey) return;

    const updated = {};
    Object.entries(ingredients).forEach(([key, items]) => {
      if (key === oldKey) {
        updated[newKey.trim()] = items;
      } else {
        updated[key] = items;
      }
    });
    onUpdate(updated);
  };

  const saveEdit = () => {
    if (!editingItem) return;
    const { sectionKey, index, value } = editingItem;

    const items = [...ingredients[sectionKey]];
    items[index] = value;

    onUpdate({
      ...ingredients,
      [sectionKey]: items
    });

    setEditingItem(null);
  };

  const deleteItem = () => {
    if (!editingItem) return;

    Alert.alert(
      'Delete Ingredient?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const { sectionKey, index } = editingItem;
            const items = [...ingredients[sectionKey]];
            items.splice(index, 1);

            // Clean up empty sections (except 'main')
            if (items.length === 0 && sectionKey !== 'main') {
              const updated = { ...ingredients };
              delete updated[sectionKey];
              onUpdate(updated);
            } else {
              onUpdate({
                ...ingredients,
                [sectionKey]: items
              });
            }

            setEditingItem(null);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>🥘 Ingredients</Text>
        {moveMode && (
          <TouchableOpacity
            style={styles.cancelMoveButton}
            onPress={() => setMoveMode(null)}
          >
            <Text style={styles.cancelMoveText}>Cancel Move</Text>
          </TouchableOpacity>
        )}
      </View>

      {moveMode && (
        <View style={styles.moveBanner}>
          <Text style={styles.moveBannerText}>
            📍 Tap an item to place this ingredient below it
          </Text>
        </View>
      )}

      {displayedIngredients && Object.entries(displayedIngredients).map(([section, items]) => (
        <View key={section} style={styles.ingredientSection}>
          {section !== 'main' && (
            <SectionEditor
              section={section}
              isEditing={editingSection === section}
              actionMode={sectionActionMode}
              onLongPress={() => handleSectionLongPress(section)}
              onTap={() => handleSectionTap(section)}
              onRename={(newName) => renameSection(section, newName)}
              onDelete={() => deleteSection(section)}
              onCancel={() => {
                onEditSection(null);
                onSectionAction(null);
              }}
            />
          )}

          {items.map((item, index) => (
            <IngredientItem
              key={`${section}-${index}`}
              item={item}
              section={section}
              index={index}
              isEditing={editingItem?.sectionKey === section && editingItem?.index === index}
              isMoveMode={moveMode?.sectionKey === section && moveMode?.index === index}
              isMoveTarget={moveMode && !(moveMode.sectionKey === section && moveMode.index === index)}
              onTap={() => handleIngredientTap(section, index)}
              onLongPress={(value) => setEditingItem({ sectionKey: section, index, value })}
              onEditChange={(value) => setEditingItem({ ...editingItem, value })}
              onSave={saveEdit}
              onDelete={deleteItem}
              onStartMove={startMoveMode}
              onAddBelow={(newValue) => handleAddBelow(section, index, newValue)}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  ingredientSection: {
    marginBottom: 15,
  },
  cancelMoveButton: {
    backgroundColor: colors.error,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  cancelMoveText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  moveBanner: {
    backgroundColor: colors.highlightYellow,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  moveBannerText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default IngredientsSection;
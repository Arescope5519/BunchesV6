/**
 * FILENAME: src/components/RecipeDetail.js
 * PURPOSE: Display and edit recipe details
 * CHANGES: Fixed swap functionality and add below bugs
 * DEPENDENCIES: React, React Native components, colors
 * USED BY: src/screens/HomeScreen.js
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import colors from '../constants/colors';
import {
  parseRecipeIngredients,
  scaleRecipeIngredients,
  convertRecipeIngredients
} from '../utils/IngredientParser';

export const RecipeDetail = ({ recipe, onUpdate, onAddToGroceryList }) => {
  // Local editable copy of recipe
  const [localRecipe, setLocalRecipe] = useState(recipe);

  // Scaling and conversion state
  const [scaleFactor, setScaleFactor] = useState(1);
  const [useMetric, setUseMetric] = useState(false);
  const [parsedIngredients, setParsedIngredients] = useState(null);
  const [displayedIngredients, setDisplayedIngredients] = useState(null);

  // Editing state
  const [editingItem, setEditingItem] = useState(null); // { type, sectionKey, index, value }
  const [swapMode, setSwapMode] = useState(null); // { type, sectionKey, index }
  const [addingBelow, setAddingBelow] = useState(null); // { type, sectionKey, index }
  const [newItemValue, setNewItemValue] = useState('');

  // Grocery list selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState({});

  // Undo history state
  const [undoHistory, setUndoHistory] = useState([]);
  const [showUndoButton, setShowUndoButton] = useState(false);

  // Update local recipe when prop changes
  useEffect(() => {
    setLocalRecipe(recipe);
    // Parse ingredients when recipe changes
    const parsed = parseRecipeIngredients(recipe.ingredients);
    setParsedIngredients(parsed);
    // Clear undo history when recipe changes
    setUndoHistory([]);
    setShowUndoButton(false);
  }, [recipe]);

  // Update displayed ingredients when scale or unit system changes
  useEffect(() => {
    if (!parsedIngredients) return;

    // First scale
    let ingredients = scaleRecipeIngredients(parsedIngredients, scaleFactor);

    // Then convert units if needed
    if (useMetric) {
      ingredients = convertRecipeIngredients(parsedIngredients, true);
      // Scale after conversion
      const parsedConverted = {};
      for (const [section, items] of Object.entries(ingredients)) {
        parsedConverted[section] = items.map(item => {
          if (typeof item === 'string') {
            const { parseIngredient } = require('../utils/IngredientParser');
            return parseIngredient(item);
          }
          return item;
        });
      }
      ingredients = scaleRecipeIngredients(parsedConverted, scaleFactor);
    }

    setDisplayedIngredients(ingredients);
  }, [parsedIngredients, scaleFactor, useMetric]);

  /**
   * Save current state to undo history
   */
  const saveToHistory = () => {
    const snapshot = JSON.parse(JSON.stringify(localRecipe));
    setUndoHistory(prev => [...prev, snapshot]);
    setShowUndoButton(true);

    // Auto-hide undo button after 10 seconds
    setTimeout(() => {
      setShowUndoButton(false);
    }, 10000);
  };

  /**
   * Undo last change
   */
  const undoLastChange = () => {
    if (undoHistory.length === 0) return;

    const previousState = undoHistory[undoHistory.length - 1];
    setLocalRecipe(previousState);
    onUpdate(previousState);

    // Remove the last item from history
    setUndoHistory(prev => prev.slice(0, -1));

    // Hide undo button if no more history
    if (undoHistory.length <= 1) {
      setShowUndoButton(false);
    }
  };

  /**
   * Handle long press on ingredient/instruction/section
   */
  const handleLongPress = (type, sectionKey, index, value) => {
    console.log('Long press:', type, sectionKey, index, value);
    setEditingItem({ type, sectionKey, index, value });
    setSwapMode(null);
    setAddingBelow(null);
  };

  /**
   * Save edited text
   */
  const saveEdit = () => {
    if (!editingItem) return;

    // Save to undo history before making changes
    saveToHistory();

    const { type, sectionKey, index, value } = editingItem;
    let updated = { ...localRecipe };

    if (type === 'ingredient') {
      const items = [...updated.ingredients[sectionKey]];
      items[index] = value;
      updated.ingredients = { ...updated.ingredients, [sectionKey]: items };
    } else if (type === 'instruction') {
      const items = [...updated.instructions];
      items[index] = value;
      updated.instructions = items;
    } else if (type === 'section') {
      // Rename section header
      const oldKey = sectionKey;
      const newKey = value;
      const ingredients = { ...updated.ingredients };
      ingredients[newKey] = ingredients[oldKey];
      delete ingredients[oldKey];
      updated.ingredients = ingredients;
    }

    setLocalRecipe(updated);
    onUpdate(updated);
    setEditingItem(null);
  };

  /**
   * Delete item
   */
  const handleDelete = () => {
    if (!editingItem) {
      console.log('No editing item to delete');
      return;
    }

    console.log('Delete button pressed for:', editingItem);

    Alert.alert(
      'Delete Item?',
      'You can undo this change using the Undo button.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('Delete cancelled')
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('Delete confirmed');

            // Save to undo history before deleting
            saveToHistory();

            const { type, sectionKey, index } = editingItem;
            let updated = { ...localRecipe };

            if (type === 'ingredient') {
              const items = [...updated.ingredients[sectionKey]];
              items.splice(index, 1);

              // If section is now empty and not 'main', delete the section
              if (items.length === 0 && sectionKey !== 'main') {
                const ingredients = { ...updated.ingredients };
                delete ingredients[sectionKey];
                updated.ingredients = ingredients;
              } else {
                updated.ingredients = { ...updated.ingredients, [sectionKey]: items };
              }
            } else if (type === 'instruction') {
              const items = [...updated.instructions];
              items.splice(index, 1);
              updated.instructions = items;
            } else if (type === 'section') {
              // Delete entire section
              const ingredients = { ...updated.ingredients };
              delete ingredients[sectionKey];
              updated.ingredients = ingredients;
            }

            console.log('Updating recipe after delete');
            setLocalRecipe(updated);
            onUpdate(updated);
            setEditingItem(null);
          }
        }
      ],
      { cancelable: true }
    );
  };

  /**
   * Start swap mode
   */
  const startSwap = () => {
    if (!editingItem) return;
    console.log('Starting swap mode for:', editingItem);
    setSwapMode({ ...editingItem });
    setEditingItem(null); // Clear editing to allow tapping other items
  };

  /**
   * Handle swap selection
   */
  const handleSwapWith = (type, sectionKey, index) => {
    if (!swapMode) {
      console.log('No swap mode active');
      return;
    }

    console.log('Attempting swap:', { type, sectionKey, index }, 'with', swapMode);

    if (swapMode.type !== type) {
      Alert.alert('Cannot Swap', "Can't swap ingredients with instructions");
      return;
    }

    // Save to undo history before swapping
    saveToHistory();

    const { sectionKey: sourceSectionKey, index: sourceIndex } = swapMode;
    let updated = { ...localRecipe };

    if (type === 'ingredient') {
      // Can only swap within same section
      if (sourceSectionKey !== sectionKey) {
        Alert.alert('Cannot Swap', 'Can only swap ingredients within the same section');
        return;
      }

      const items = [...updated.ingredients[sectionKey]];
      console.log('Swapping ingredients:', sourceIndex, '<->', index);
      [items[sourceIndex], items[index]] = [items[index], items[sourceIndex]];
      updated.ingredients = { ...updated.ingredients, [sectionKey]: items };
    } else if (type === 'instruction') {
      const items = [...updated.instructions];
      console.log('Swapping instructions:', sourceIndex, '<->', index);
      [items[sourceIndex], items[index]] = [items[index], items[sourceIndex]];
      updated.instructions = items;
    }

    setLocalRecipe(updated);
    onUpdate(updated);
    setSwapMode(null);
  };

  /**
   * Start adding below
   */
  const startAddBelow = () => {
    if (!editingItem) return;
    console.log('Starting add below for:', editingItem);
    setAddingBelow({ ...editingItem });
    setNewItemValue('');
  };

  /**
   * Save new item
   */
  const saveNewItem = () => {
    if (!addingBelow || !newItemValue.trim()) {
      console.log('Cannot save - no addingBelow or empty value');
      return;
    }

    // Save to undo history before adding
    saveToHistory();

    const { type, sectionKey, index } = addingBelow;
    console.log('Saving new item below:', type, sectionKey, index, newItemValue);
    let updated = { ...localRecipe };

    if (type === 'ingredient') {
      const items = [...updated.ingredients[sectionKey]];
      items.splice(index + 1, 0, newItemValue.trim());
      updated.ingredients = { ...updated.ingredients, [sectionKey]: items };
    } else if (type === 'instruction') {
      const items = [...updated.instructions];
      items.splice(index + 1, 0, newItemValue.trim());
      updated.instructions = items;
    }

    setLocalRecipe(updated);
    onUpdate(updated);
    setAddingBelow(null);
    setNewItemValue('');
  };

  /**
   * Cancel adding below
   */
  const cancelAddBelow = () => {
    setAddingBelow(null);
    setNewItemValue('');
    setEditingItem(null);
  };

  /**
   * Add new section
   */
  const addNewSection = () => {
    Alert.prompt(
      'New Section',
      'Enter section name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (sectionName) => {
            if (sectionName && sectionName.trim()) {
              // Save to undo history before adding section
              saveToHistory();

              const updated = {
                ...localRecipe,
                ingredients: {
                  ...localRecipe.ingredients,
                  [sectionName.trim()]: []
                }
              };
              setLocalRecipe(updated);
              onUpdate(updated);
            }
          }
        }
      ],
      'plain-text'
    );
  };

  /**
   * Toggle selection mode for grocery list
   */
  const toggleSelectionMode = () => {
    if (selectionMode) {
      // Exiting selection mode
      setSelectedIngredients({});
    }
    setSelectionMode(!selectionMode);
  };

  /**
   * Toggle ingredient selection
   */
  const toggleIngredientSelection = (section, index) => {
    const key = `${section}_${index}`;
    setSelectedIngredients(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  /**
   * Select all ingredients
   */
  const selectAllIngredients = () => {
    const allSelected = {};
    Object.entries(displayedIngredients || {}).forEach(([section, items]) => {
      items.forEach((_, index) => {
        allSelected[`${section}_${index}`] = true;
      });
    });
    setSelectedIngredients(allSelected);
  };

  /**
   * Add selected ingredients to grocery list
   */
  const addSelectedToGroceryList = () => {
    const selectedItems = [];
    Object.entries(displayedIngredients || {}).forEach(([section, items]) => {
      items.forEach((item, index) => {
        const key = `${section}_${index}`;
        if (selectedIngredients[key]) {
          // Get the display text (scaled/converted if applicable)
          const displayText = typeof item === 'object' && item.original
            ? item.original
            : localRecipe.ingredients[section][index];
          selectedItems.push({ text: displayText, section });
        }
      });
    });

    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one ingredient to add to your grocery list.');
      return;
    }

    // Call the callback with selected items
    if (onAddToGroceryList) {
      onAddToGroceryList(selectedItems);
    }

    Alert.alert(
      'Added to Grocery List',
      `${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} added to your grocery list!`,
      [{ text: 'OK', onPress: () => {
        setSelectionMode(false);
        setSelectedIngredients({});
      }}]
    );
  };

  if (!localRecipe) return null;

  return (
    <>
      <Text style={styles.modalTitle}>{localRecipe.title}</Text>

      {(localRecipe.prep_time || localRecipe.cook_time || localRecipe.servings) && (
        <View style={styles.metaContainer}>
          {localRecipe.prep_time && <Text style={styles.metaText}>⏱️ Prep: {localRecipe.prep_time}</Text>}
          {localRecipe.cook_time && <Text style={styles.metaText}>🔥 Cook: {localRecipe.cook_time}</Text>}
          {localRecipe.servings && <Text style={styles.metaText}>🍽️ Serves: {localRecipe.servings}</Text>}
        </View>
      )}

      {/* Undo Button */}
      {showUndoButton && undoHistory.length > 0 && (
        <TouchableOpacity
          style={styles.undoButton}
          onPress={undoLastChange}
        >
          <Text style={styles.undoButtonText}>↶ Undo Last Change</Text>
        </TouchableOpacity>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {!selectionMode && (
          <TouchableOpacity onPress={addNewSection} style={styles.addSectionButton}>
            <Text style={styles.addSectionText}>+ Section</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Grocery List Add Button - Always visible when not in selection mode */}
      {!selectionMode && onAddToGroceryList && (
        <TouchableOpacity
          style={styles.addToGroceryListMainButton}
          onPress={toggleSelectionMode}
        >
          <Text style={styles.addToGroceryListMainButtonText}>🛒 Add Ingredients to Grocery List</Text>
        </TouchableOpacity>
      )}

      {/* Grocery List Selection Controls */}
      {selectionMode && (
        <View style={styles.selectionControlsContainer}>
          <TouchableOpacity onPress={selectAllIngredients} style={styles.selectAllButton}>
            <Text style={styles.selectAllButtonText}>✓ Select All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={addSelectedToGroceryList} style={styles.addToListButton}>
            <Text style={styles.addToListButtonText}>🛒 Add to List</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleSelectionMode} style={styles.cancelSelectionButton}>
            <Text style={styles.cancelSelectionButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scale and Unit Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.scaleControls}>
          <Text style={styles.controlLabel}>Scale:</Text>
          <TouchableOpacity
            style={[styles.scaleButton, scaleFactor === 0.5 && styles.scaleButtonActive]}
            onPress={() => setScaleFactor(0.5)}
          >
            <Text style={[styles.scaleButtonText, scaleFactor === 0.5 && styles.scaleButtonTextActive]}>½×</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scaleButton, scaleFactor === 1 && styles.scaleButtonActive]}
            onPress={() => setScaleFactor(1)}
          >
            <Text style={[styles.scaleButtonText, scaleFactor === 1 && styles.scaleButtonTextActive]}>1×</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scaleButton, scaleFactor === 2 && styles.scaleButtonActive]}
            onPress={() => setScaleFactor(2)}
          >
            <Text style={[styles.scaleButtonText, scaleFactor === 2 && styles.scaleButtonTextActive]}>2×</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scaleButton, scaleFactor === 3 && styles.scaleButtonActive]}
            onPress={() => setScaleFactor(3)}
          >
            <Text style={[styles.scaleButtonText, scaleFactor === 3 && styles.scaleButtonTextActive]}>3×</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.unitToggle}
          onPress={() => setUseMetric(!useMetric)}
        >
          <Text style={styles.unitToggleText}>
            {useMetric ? '📏 Metric' : '📏 Imperial'}
          </Text>
        </TouchableOpacity>
      </View>

      {displayedIngredients && Object.entries(displayedIngredients).map(([section, items]) => (
        <View key={section} style={styles.ingredientSection}>
          {section !== 'main' && (
            <TouchableOpacity
              onLongPress={() => handleLongPress('section', section, 0, section)}
              delayLongPress={300}
            >
              {editingItem?.type === 'section' && editingItem?.sectionKey === section ? (
                <TextInput
                  style={styles.subsectionTitleInput}
                  value={editingItem.value}
                  onChangeText={(text) => setEditingItem({ ...editingItem, value: text })}
                  onBlur={saveEdit}
                />
              ) : (
                <Text
                  style={[
                    styles.subsectionTitle,
                    swapMode?.type === 'section' && swapMode?.sectionKey === section && styles.highlightedItem
                  ]}
                >
                  {section}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {items.map((item, idx) => {
            // Get the original ingredient for editing
            const originalItem = localRecipe.ingredients[section]?.[idx] || item;
            const displayItem = typeof item === 'string' ? item : item.original || originalItem;
            const selectionKey = `${section}_${idx}`;
            const isSelected = selectedIngredients[selectionKey];

            return (
            <View key={`${section}-${idx}`}>
              <View style={styles.ingredientRow}>
                {/* Checkbox for selection mode */}
                {selectionMode && (
                  <TouchableOpacity
                    onPress={() => toggleIngredientSelection(section, idx)}
                    style={styles.checkboxContainer}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.ingredientTouchable}
                  onLongPress={() => !selectionMode && handleLongPress('ingredient', section, idx, originalItem)}
                  onPress={() => {
                    if (selectionMode) {
                      toggleIngredientSelection(section, idx);
                    } else if (swapMode && swapMode.type === 'ingredient') {
                      handleSwapWith('ingredient', section, idx);
                    }
                  }}
                  delayLongPress={300}
                >
                  {editingItem?.type === 'ingredient' &&
                   editingItem?.sectionKey === section &&
                   editingItem?.index === idx && !selectionMode ? (
                    <TextInput
                      style={styles.ingredientItemInput}
                      value={editingItem.value}
                      onChangeText={(text) => setEditingItem({ ...editingItem, value: text })}
                      onBlur={saveEdit}
                      multiline
                    />
                  ) : (
                    <Text
                      style={[
                        styles.ingredientItem,
                        swapMode?.type === 'ingredient' &&
                        swapMode?.sectionKey === section &&
                        swapMode?.index === idx && styles.highlightedItem,
                        selectionMode && isSelected && styles.selectedIngredientItem
                      ]}
                    >
                      • {displayItem}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Action buttons */}
              {editingItem?.type === 'ingredient' &&
               editingItem?.sectionKey === section &&
               editingItem?.index === idx && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>❌ Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={startSwap} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>🔄 Swap</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={startAddBelow} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>➕ Add Below</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Add below input */}
              {addingBelow?.type === 'ingredient' &&
               addingBelow?.sectionKey === section &&
               addingBelow?.index === idx && (
                <View style={styles.addBelowContainer}>
                  <TextInput
                    style={styles.addBelowInput}
                    placeholder="New ingredient..."
                    value={newItemValue}
                    onChangeText={setNewItemValue}
                    onSubmitEditing={saveNewItem}
                  />
                  <TouchableOpacity onPress={saveNewItem} style={styles.saveButton}>
                    <Text style={styles.saveButtonText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelAddBelow} style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )})}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Instructions</Text>
      {localRecipe.instructions.map((step, idx) => (
        <View key={`instruction-${idx}`}>
          <TouchableOpacity
            onLongPress={() => handleLongPress('instruction', null, idx, step)}
            onPress={() => {
              if (swapMode && swapMode.type === 'instruction') {
                handleSwapWith('instruction', null, idx);
              }
            }}
            delayLongPress={300}
          >
            <View style={styles.instructionStep}>
              <Text style={styles.stepNumber}>{idx + 1}</Text>
              {editingItem?.type === 'instruction' && editingItem?.index === idx ? (
                <TextInput
                  style={styles.stepTextInput}
                  value={editingItem.value}
                  onChangeText={(text) => setEditingItem({ ...editingItem, value: text })}
                  onBlur={saveEdit}
                  multiline
                />
              ) : (
                <Text
                  style={[
                    styles.stepText,
                    swapMode?.type === 'instruction' &&
                    swapMode?.index === idx && styles.highlightedItem
                  ]}
                >
                  {step}
                </Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Action buttons */}
          {editingItem?.type === 'instruction' && editingItem?.index === idx && (
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>❌ Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={startSwap} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>🔄 Swap</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={startAddBelow} style={styles.actionButton}>
                <Text style={styles.actionButtonText}>➕ Add Below</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Add below input */}
          {addingBelow?.type === 'instruction' && addingBelow?.index === idx && (
            <View style={styles.addBelowContainer}>
              <TextInput
                style={styles.addBelowInput}
                placeholder="New instruction..."
                value={newItemValue}
                onChangeText={setNewItemValue}
                onSubmitEditing={saveNewItem}
                multiline
              />
              <TouchableOpacity onPress={saveNewItem} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelAddBelow} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      <View style={styles.sourceContainer}>
        <Text style={styles.sourceLabel}>Source:</Text>
        <Text style={styles.sourceUrl}>{localRecipe.url}</Text>
      </View>

      {swapMode && (
        <View style={styles.swapModeNotice}>
          <Text style={styles.swapModeText}>🔄 Swap Mode: Tap another {swapMode.type} to swap</Text>
          <TouchableOpacity
            onPress={() => setSwapMode(null)}
            style={styles.cancelSwapButton}
          >
            <Text style={styles.cancelSwapText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
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
  undoButton: {
    backgroundColor: colors.warning,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  undoButtonText: {
    fontSize: 15,
    color: colors.white,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addSectionButton: {
    padding: 5,
  },
  addSectionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
  },
  scaleControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: 4,
  },
  scaleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scaleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scaleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  scaleButtonTextActive: {
    color: colors.white,
  },
  unitToggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
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
  subsectionTitleInput: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 5,
    borderRadius: 4,
  },
  ingredientItem: {
    fontSize: 15,
    marginBottom: 5,
    color: colors.text,
    paddingVertical: 4,
  },
  ingredientItemInput: {
    fontSize: 15,
    marginBottom: 5,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
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
    paddingVertical: 4,
  },
  stepTextInput: {
    fontSize: 15,
    flex: 1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
  },
  highlightedItem: {
    backgroundColor: colors.highlightYellow,
    padding: 5,
    borderRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 5,
  },
  actionButton: {
    backgroundColor: colors.lightGray,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  addBelowContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 5,
  },
  addBelowInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 10,
    borderRadius: 6,
    fontSize: 14,
    backgroundColor: colors.background,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
  // Grocery list selection styles
  addToGroceryListMainButton: {
    backgroundColor: colors.success,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 0,
    marginBottom: 10,
    alignItems: 'center',
  },
  addToGroceryListMainButtonText: {
    fontSize: 15,
    color: colors.white,
    fontWeight: '600',
  },
  selectionControlsContainer: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    marginBottom: 10,
  },
  selectAllButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: 6,
    alignItems: 'center',
  },
  selectAllButtonText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '600',
  },
  addToListButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.success,
    borderRadius: 6,
    alignItems: 'center',
  },
  addToListButtonText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '600',
  },
  cancelSelectionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.textSecondary,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelSelectionButtonText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '600',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    padding: 5,
    marginRight: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  checkboxSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkboxCheck: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  ingredientTouchable: {
    flex: 1,
  },
  selectedIngredientItem: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  swapModeNotice: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  swapModeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    flex: 1,
  },
  cancelSwapButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  cancelSwapText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default RecipeDetail;
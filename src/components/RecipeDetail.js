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

export const RecipeDetail = ({ recipe, onUpdate }) => {
  // Local editable copy of recipe
  const [localRecipe, setLocalRecipe] = useState(recipe);

  // Editing state
  const [editingItem, setEditingItem] = useState(null); // { type, sectionKey, index, value }
  const [swapMode, setSwapMode] = useState(null); // { type, sectionKey, index }
  const [addingBelow, setAddingBelow] = useState(null); // { type, sectionKey, index }
  const [newItemValue, setNewItemValue] = useState('');

  // Update local recipe when prop changes
  useEffect(() => {
    setLocalRecipe(recipe);
  }, [recipe]);

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
      'This cannot be undone.',
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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <TouchableOpacity onPress={addNewSection} style={styles.addSectionButton}>
          <Text style={styles.addSectionText}>+ Section</Text>
        </TouchableOpacity>
      </View>

      {Object.entries(localRecipe.ingredients).map(([section, items]) => (
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

          {items.map((item, idx) => (
            <View key={`${section}-${idx}`}>
              <TouchableOpacity
                onLongPress={() => handleLongPress('ingredient', section, idx, item)}
                onPress={() => {
                  if (swapMode && swapMode.type === 'ingredient') {
                    handleSwapWith('ingredient', section, idx);
                  }
                }}
                delayLongPress={300}
              >
                {editingItem?.type === 'ingredient' &&
                 editingItem?.sectionKey === section &&
                 editingItem?.index === idx ? (
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
                      swapMode?.index === idx && styles.highlightedItem
                    ]}
                  >
                    • {item}
                  </Text>
                )}
              </TouchableOpacity>

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
          ))}
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
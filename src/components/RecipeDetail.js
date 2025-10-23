/**
 * FILENAME: src/components/RecipeDetail.js
 * PURPOSE: Display and edit recipe details
 * NEW: Now scales ingredients in instructions too!
 * DEPENDENCIES: React, React Native components, colors, IngredientParser
 * USED BY: src/screens/HomeScreen.js
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import colors from '../constants/colors';
import {
  parseRecipeIngredients,
  scaleRecipeIngredients,
  scaleRecipeInstructions,
  convertRecipeIngredients
} from '../utils/IngredientParser';

const RecipeDetail = ({ recipe, onUpdate }) => {
  // Local editable copy of recipe
  const [localRecipe, setLocalRecipe] = useState(recipe);

  // Scaling and conversion state
  const [scaleFactor, setScaleFactor] = useState(1);
  const [useMetric, setUseMetric] = useState(false);
  const [parsedIngredients, setParsedIngredients] = useState(null);
  const [displayedIngredients, setDisplayedIngredients] = useState(null);
  const [displayedInstructions, setDisplayedInstructions] = useState(null);

  // Editing state
  const [editingItem, setEditingItem] = useState(null);
  const [swapMode, setSwapMode] = useState(null);
  const [addingBelow, setAddingBelow] = useState(null);
  const [newItemValue, setNewItemValue] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [movingSectionMode, setMovingSectionMode] = useState(null);

  // Update local recipe when prop changes
  useEffect(() => {
    setLocalRecipe(recipe);
    const parsed = parseRecipeIngredients(recipe.ingredients);
    setParsedIngredients(parsed);
  }, [recipe]);

  // Scale ingredients and instructions
  useEffect(() => {
    if (!parsedIngredients) return;

    let ingredients = scaleRecipeIngredients(parsedIngredients, scaleFactor);

    if (useMetric) {
      ingredients = convertRecipeIngredients(parsedIngredients, true);
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
    const scaledInstructions = scaleRecipeInstructions(localRecipe.instructions, scaleFactor);
    setDisplayedInstructions(scaledInstructions);
  }, [parsedIngredients, scaleFactor, useMetric, localRecipe.instructions]);

  const handleLongPress = (type, sectionKey, index, value) => {
    setEditingItem({ type, sectionKey, index, value });
    setSwapMode(null);
    setAddingBelow(null);
  };

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

  const handleDelete = () => {
    if (!editingItem) return;

    Alert.alert(
      'Delete Item?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const { type, sectionKey, index } = editingItem;
            let updated = { ...localRecipe };

            if (type === 'ingredient') {
              const items = [...updated.ingredients[sectionKey]];
              items.splice(index, 1);
              updated.ingredients = { ...updated.ingredients, [sectionKey]: items };
              if (items.length === 0 && sectionKey !== 'main') {
                delete updated.ingredients[sectionKey];
              }
            } else if (type === 'instruction') {
              const items = [...updated.instructions];
              items.splice(index, 1);
              updated.instructions = items;
            } else if (type === 'section') {
              const ingredients = { ...updated.ingredients };
              delete ingredients[sectionKey];
              updated.ingredients = ingredients;
            }

            setLocalRecipe(updated);
            onUpdate(updated);
            setEditingItem(null);
          },
        },
      ]
    );
  };

  const startSwap = () => {
    if (!editingItem) return;
    setSwapMode({ ...editingItem });
    setEditingItem(null);
  };

  const cancelSwap = () => {
    setSwapMode(null);
  };

  const handleSwapWith = (type, sectionKey, index) => {
    if (!swapMode && !movingSectionMode) return;

    // Handle move section mode
    if (movingSectionMode && type === 'section') {
      const movingSection = movingSectionMode.sectionKey;
      const entries = Object.entries(localRecipe.ingredients);
      const sourceIdx = entries.findIndex(([key]) => key === movingSection);
      const targetIdx = entries.findIndex(([key]) => key === sectionKey);

      [entries[sourceIdx], entries[targetIdx]] = [entries[targetIdx], entries[sourceIdx]];

      const updated = { ...localRecipe };
      updated.ingredients = Object.fromEntries(entries);

      setLocalRecipe(updated);
      onUpdate(updated);
      setMovingSectionMode(null);
      return;
    }

    if (!swapMode) return;

    if (swapMode.type !== type) {
      Alert.alert('Cannot Swap', "Can't swap different types");
      return;
    }

    const { sectionKey: sourceSectionKey, index: sourceIndex } = swapMode;
    let updated = { ...localRecipe };

    if (type === 'ingredient') {
      if (sourceSectionKey !== sectionKey) {
        Alert.alert('Cannot Swap', 'Can only swap ingredients within the same section');
        return;
      }
      const items = [...updated.ingredients[sectionKey]];
      [items[sourceIndex], items[index]] = [items[index], items[sourceIndex]];
      updated.ingredients = { ...updated.ingredients, [sectionKey]: items };
    } else if (type === 'instruction') {
      const items = [...updated.instructions];
      [items[sourceIndex], items[index]] = [items[index], items[sourceIndex]];
      updated.instructions = items;
    } else if (type === 'section') {
      const entries = Object.entries(updated.ingredients);
      const sourceIdx = entries.findIndex(([key]) => key === sourceSectionKey);
      const targetIdx = entries.findIndex(([key]) => key === sectionKey);

      [entries[sourceIdx], entries[targetIdx]] = [entries[targetIdx], entries[sourceIdx]];
      updated.ingredients = Object.fromEntries(entries);
    }

    setLocalRecipe(updated);
    onUpdate(updated);
    setSwapMode(null);
  };

  const startAddBelow = () => {
    if (!editingItem) return;
    setAddingBelow({ ...editingItem });
    setNewItemValue('');
  };

  const saveNewItem = () => {
    if (!addingBelow || !newItemValue.trim()) return;

    const { type, sectionKey, index } = addingBelow;
    let updated = { ...localRecipe };

    if (type === 'ingredient') {
      const items = [...updated.ingredients[sectionKey]];
      items.splice(index + 1, 0, newItemValue);
      updated.ingredients = { ...updated.ingredients, [sectionKey]: items };
    } else if (type === 'instruction') {
      const items = [...updated.instructions];
      items.splice(index + 1, 0, newItemValue);
      updated.instructions = items;
    }

    setLocalRecipe(updated);
    onUpdate(updated);
    setAddingBelow(null);
    setNewItemValue('');
  };

  const cancelAddBelow = () => {
    setAddingBelow(null);
    setNewItemValue('');
  };

  const addNewSection = () => {
    setShowAddSection(true);
    setNewSectionName('');
  };

  const saveNewSection = () => {
    if (newSectionName && newSectionName.trim()) {
      const updated = {
        ...localRecipe,
        ingredients: {
          ...localRecipe.ingredients,
          [newSectionName.trim()]: []
        }
      };
      setLocalRecipe(updated);
      onUpdate(updated);
      setShowAddSection(false);
      setNewSectionName('');
    }
  };

  const cancelAddSection = () => {
    setShowAddSection(false);
    setNewSectionName('');
  };

  const moveSectionUp = (sectionKey) => {
    const entries = Object.entries(localRecipe.ingredients);
    const currentIndex = entries.findIndex(([key]) => key === sectionKey);
    if (currentIndex <= 0) return;

    [entries[currentIndex - 1], entries[currentIndex]] = [entries[currentIndex], entries[currentIndex - 1]];

    const updated = { ...localRecipe };
    updated.ingredients = Object.fromEntries(entries);
    setLocalRecipe(updated);
    onUpdate(updated);
  };

  const moveSectionDown = (sectionKey) => {
    const entries = Object.entries(localRecipe.ingredients);
    const currentIndex = entries.findIndex(([key]) => key === sectionKey);
    if (currentIndex < 0 || currentIndex >= entries.length - 1) return;

    [entries[currentIndex], entries[currentIndex + 1]] = [entries[currentIndex + 1], entries[currentIndex]];

    const updated = { ...localRecipe };
    updated.ingredients = Object.fromEntries(entries);
    setLocalRecipe(updated);
    onUpdate(updated);
  };

  const moveSectionAboveIngredient = (targetSection, targetIndex) => {
    if (!movingSectionMode) return;

    const movingSection = movingSectionMode.sectionKey;
    const newIngredients = {};
    const movingSectionItems = localRecipe.ingredients[movingSection] || [];

    Object.entries(localRecipe.ingredients).forEach(([key, items]) => {
      if (key !== movingSection) {
        newIngredients[key] = [...items];
      }
    });

    if (targetSection !== movingSection) {
      const targetItems = newIngredients[targetSection];
      const beforeSplit = targetItems.slice(0, targetIndex);
      const afterSplit = targetItems.slice(targetIndex);

      newIngredients[targetSection] = beforeSplit;
      newIngredients[movingSection] = [...movingSectionItems, ...afterSplit];
    }

    const updated = { ...localRecipe, ingredients: newIngredients };
    setLocalRecipe(updated);
    onUpdate(updated);
    setMovingSectionMode(null);
  };

  const cancelMoveSection = () => {
    setMovingSectionMode(null);
  };

  return (
    <>
      <Text style={styles.recipeTitle}>{localRecipe.title}</Text>

      {swapMode && (
        <View style={styles.swapBanner}>
          <Text style={styles.swapBannerText}>
            🔄 Tap another {swapMode.type} to swap
          </Text>
          <TouchableOpacity onPress={cancelSwap}>
            <Text style={styles.swapBannerCancel}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {movingSectionMode && (
        <View style={styles.swapBanner}>
          <Text style={styles.swapBannerText}>
            📍 Tap an ingredient to move "{movingSectionMode.sectionKey}" above it
          </Text>
          <TouchableOpacity onPress={cancelMoveSection}>
            <Text style={styles.swapBannerCancel}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <TouchableOpacity
          onPress={addNewSection}
          activeOpacity={0.6}
          style={styles.addSectionButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Text style={styles.addSectionText}>+ Section</Text>
        </TouchableOpacity>
      </View>

      {showAddSection && (
        <View style={styles.addSectionContainer}>
          <Text style={styles.addSectionLabel}>New Section:</Text>
          <TextInput
            style={styles.addSectionInput}
            placeholder="Section name (e.g., 'Topping', 'Optional')"
            value={newSectionName}
            onChangeText={setNewSectionName}
            onSubmitEditing={saveNewSection}
            autoFocus
          />
          <TouchableOpacity onPress={saveNewSection} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={cancelAddSection} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {displayedIngredients && Object.entries(displayedIngredients).map(([section, items], sectionIndex) => (
        <View key={section} style={styles.ingredientSection}>
          {section !== 'main' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <TouchableOpacity
                  onLongPress={() => handleLongPress('section', section, 0, section)}
                  onPress={() => {
                    if (swapMode && swapMode.type === 'section') {
                      handleSwapWith('section', section, 0);
                    } else if (movingSectionMode) {
                      handleSwapWith('section', section, 0);
                    }
                  }}
                  delayLongPress={300}
                  style={{ flex: 1 }}
                >
                  {editingItem?.type === 'section' && editingItem?.sectionKey === section ? (
                    <TextInput
                      style={styles.subsectionTitleInput}
                      value={editingItem.value}
                      onChangeText={(text) => setEditingItem({ ...editingItem, value: text })}
                      onBlur={saveEdit}
                      autoFocus
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

                {editingItem?.type === 'section' && editingItem?.sectionKey === section && (
                  <View style={styles.sectionArrows}>
                    <TouchableOpacity
                      onPress={() => moveSectionUp(section)}
                      style={styles.arrowButton}
                      disabled={sectionIndex === 0 || (sectionIndex === 1 && Object.keys(displayedIngredients)[0] === 'main')}
                    >
                      <Text style={styles.arrowText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveSectionDown(section)}
                      style={styles.arrowButton}
                      disabled={sectionIndex === Object.keys(displayedIngredients).length - 1}
                    >
                      <Text style={styles.arrowText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {editingItem?.type === 'section' && editingItem?.sectionKey === section && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    onPress={() => {
                      const sectionToDelete = section;
                      setEditingItem(null);
                      setTimeout(() => {
                        Alert.alert(
                          'Delete Section?',
                          `This will delete "${sectionToDelete}" and all its ingredients.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                const updated = { ...localRecipe };
                                const ingredients = { ...updated.ingredients };
                                delete ingredients[sectionToDelete];
                                updated.ingredients = ingredients;
                                setLocalRecipe(updated);
                                onUpdate(updated);
                              },
                            },
                          ]
                        );
                      }, 100);
                    }}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>❌ Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      const currentSection = section;
                      setEditingItem(null);
                      setTimeout(() => {
                        setMovingSectionMode({ sectionKey: currentSection });
                      }, 100);
                    }}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>📍 Move</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      const currentSection = section;
                      setEditingItem(null);
                      setTimeout(() => {
                        setSwapMode({ type: 'section', sectionKey: currentSection, index: 0 });
                      }, 100);
                    }}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>🔄 Swap</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      saveEdit();
                      setEditingItem(null);
                    }}
                    style={[styles.actionButton, styles.doneButton]}
                  >
                    <Text style={[styles.actionButtonText, styles.doneButtonText]}>✓ Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {items.map((item, idx) => {
            const originalItem = localRecipe.ingredients[section]?.[idx] || item;
            const displayItem = typeof item === 'string' ? item : item.original || originalItem;

            return (
              <View key={`${section}-${idx}`}>
                <TouchableOpacity
                  onLongPress={() => handleLongPress('ingredient', section, idx, originalItem)}
                  onPress={() => {
                    if (swapMode && swapMode.type === 'ingredient') {
                      handleSwapWith('ingredient', section, idx);
                    } else if (movingSectionMode) {
                      moveSectionAboveIngredient(section, idx);
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
                    />
                  ) : (
                    <Text
                      style={[
                        styles.ingredientItem,
                        (swapMode?.type === 'ingredient' &&
                        swapMode?.sectionKey === section &&
                        swapMode?.index === idx) || movingSectionMode ? styles.highlightedItem : null
                      ]}
                    >
                      • {displayItem}
                    </Text>
                  )}
                </TouchableOpacity>

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
            );
          })}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Instructions</Text>
      {displayedInstructions && displayedInstructions.map((step, idx) => {
        const originalStep = localRecipe.instructions[idx];

        return (
          <View key={`instruction-${idx}`}>
            <TouchableOpacity
              onLongPress={() => handleLongPress('instruction', null, idx, originalStep)}
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
        );
      })}

      <View style={styles.sourceContainer}>
        <Text style={styles.sourceLabel}>Source:</Text>
        <Text style={styles.sourceUrl}>{localRecipe.url}</Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  recipeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: colors.text,
  },
  swapBanner: {
    backgroundColor: colors.warning,
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swapBannerText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  swapBannerCancel: {
    color: colors.white,
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
    color: colors.text,
  },
  addSectionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  addSectionText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionArrows: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 10,
  },
  arrowButton: {
    padding: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  arrowText: {
    fontSize: 16,
    color: colors.primary,
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
    marginBottom: 10,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 13,
    color: colors.text,
  },
  doneButton: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  doneButtonText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  addBelowContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  addBelowInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    padding: 8,
    backgroundColor: colors.background,
    fontSize: 14,
  },
  addSectionContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 15,
    paddingHorizontal: 4,
    paddingVertical: 10,
    backgroundColor: colors.highlightYellow,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  addSectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    alignSelf: 'center',
    marginLeft: 5,
  },
  addSectionInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 6,
    padding: 10,
    backgroundColor: colors.white,
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  sourceContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sourceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  sourceUrl: {
    fontSize: 12,
    color: colors.primary,
  },
});

export default RecipeDetail;
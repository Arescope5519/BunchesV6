/**
 * FILENAME: src/components/RecipeDetail.js
 * PURPOSE: Display and edit recipe details
 * CHANGES: Fixed swap functionality and add below bugs
 * DEPENDENCIES: React, React Native components, colors
 * USED BY: src/screens/HomeScreen.js
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Linking, Modal, ScrollView } from 'react-native';
import colors from '../constants/colors';
import { PREDEFINED_TAGS, getTagColor, getPredefinedTagNames } from '../constants/tags';
import {
  parseRecipeIngredients,
  scaleRecipeIngredients,
  convertRecipeIngredients
} from '../utils/IngredientParser';
import { formatDuration, formatServings, buildNutritionItems } from '../utils/recipeFormat';

// Helper to safely parse JSON if it's a string
const tryParseJSON = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Helper to normalize recipe format
const normalizeRecipe = (recipe) => {
  if (!recipe) return { ingredients: { main: [] }, instructions: [] };

  const normalized = { ...recipe };

  // Try to parse ingredients if it's a JSON string
  let ingredients = tryParseJSON(normalized.ingredients);

  // Ensure ingredients is an object with sections
  if (!ingredients) {
    normalized.ingredients = { main: [] };
  } else if (typeof ingredients === 'string') {
    // Handle string ingredients (from share extension imports)
    // Check if it looks like a stringified array "[...]"
    if (ingredients.trim().startsWith('[')) {
      const parsed = tryParseJSON(ingredients);
      if (Array.isArray(parsed)) {
        normalized.ingredients = { main: parsed };
      } else {
        normalized.ingredients = { main: ingredients.split('\n').filter(line => line.trim()) };
      }
    } else {
      normalized.ingredients = { main: ingredients.split('\n').filter(line => line.trim()) };
    }
  } else if (Array.isArray(ingredients)) {
    normalized.ingredients = { main: ingredients };
  } else if (typeof ingredients === 'object') {
    // It's an object - make sure each section value is an array
    normalized.ingredients = {};
    for (const [key, value] of Object.entries(ingredients)) {
      const parsedValue = tryParseJSON(value);
      if (Array.isArray(parsedValue)) {
        normalized.ingredients[key] = parsedValue;
      } else if (typeof parsedValue === 'string') {
        normalized.ingredients[key] = parsedValue.split('\n').filter(line => line.trim());
      } else {
        normalized.ingredients[key] = [];
      }
    }
    // Ensure at least one section exists
    if (Object.keys(normalized.ingredients).length === 0) {
      normalized.ingredients = { main: [] };
    }
  } else {
    normalized.ingredients = { main: [] };
  }

  // Try to parse instructions if it's a JSON string
  let instructions = tryParseJSON(normalized.instructions);

  // Ensure instructions is an array
  if (!instructions) {
    normalized.instructions = [];
  } else if (typeof instructions === 'string') {
    // Check if it looks like a stringified array "[...]"
    if (instructions.trim().startsWith('[')) {
      const parsed = tryParseJSON(instructions);
      if (Array.isArray(parsed)) {
        normalized.instructions = parsed;
      } else {
        normalized.instructions = instructions.split('\n').filter(line => line.trim());
      }
    } else {
      normalized.instructions = instructions.split('\n').filter(line => line.trim());
    }
  } else if (Array.isArray(instructions)) {
    normalized.instructions = instructions;
  } else {
    normalized.instructions = [];
  }

  return normalized;
};

export const RecipeDetail = ({
  recipe,
  onUpdate,
  onAddToGroceryList,
  allRecipes = [],
  isFolderPrivate = false,
  onToggleVersion, // For switching between original and edited versions
  onSelectVariant, // For selecting a variant
  onCreateVariant, // For creating a new variant
  onDeleteVariant, // For deleting a variant
  onShare, // For sharing with edit options
  onViewOwnerProfile, // For opening the recipe owner's profile
}) => {
  const isReadOnly = !!recipe?.isReadOnly;
  // Local editable copy of recipe - initialize with normalized data
  const [localRecipe, setLocalRecipe] = useState(() => normalizeRecipe(recipe));

  // Get all custom tags from user's recipes (tags not in predefined list)
  const predefinedTagNames = getPredefinedTagNames().map(t => t.toLowerCase());
  const myCustomTags = React.useMemo(() => {
    const customTagSet = new Set();
    allRecipes.forEach(r => {
      if (r.tags && Array.isArray(r.tags)) {
        r.tags.forEach(tag => {
          if (!predefinedTagNames.includes(tag.toLowerCase())) {
            customTagSet.add(tag);
          }
        });
      }
    });
    return Array.from(customTagSet).sort();
  }, [allRecipes]);

  // Scaling and conversion state
  const [scaleFactor, setScaleFactor] = useState(1);
  const [useMetric, setUseMetric] = useState(false);
  const [parsedIngredients, setParsedIngredients] = useState(null);
  const [displayedIngredients, setDisplayedIngredients] = useState(null);
  const [scaledInstructions, setScaledInstructions] = useState(null);

  // Editing state
  const [editingItem, setEditingItem] = useState(null); // { type, sectionKey, index, value }
  const [swapMode, setSwapMode] = useState(null); // { type, sectionKey, index }
  const [addingBelow, setAddingBelow] = useState(null); // { type, sectionKey, index }
  const [newItemValue, setNewItemValue] = useState('');

  // Grocery list selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState({});

  // Add section modal state
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Tag editing state
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // Variant selector state
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [showCreateVariant, setShowCreateVariant] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');

  // Update local recipe when prop changes
  useEffect(() => {
    console.log('🍳 [RecipeDetail] Recipe prop received');

    const normalizedRecipe = normalizeRecipe(recipe);
    console.log('🍳 [RecipeDetail] Normalized - ingredients sections:', Object.keys(normalizedRecipe.ingredients || {}));
    console.log('🍳 [RecipeDetail] Normalized - instructions count:', (normalizedRecipe.instructions || []).length);

    setLocalRecipe(normalizedRecipe);

    // Parse ingredients when recipe changes
    try {
      const parsed = parseRecipeIngredients(normalizedRecipe.ingredients);
      setParsedIngredients(parsed);
    } catch (parseError) {
      console.error('🍳 [RecipeDetail] Error parsing ingredients:', parseError);
      setParsedIngredients({ main: [] });
    }
  }, [recipe]);

  /**
   * Scale numbers in instructions
   */
  const scaleInstructionNumbers = (instruction, scale) => {
    if (scale === 1) return instruction;

    // Match numbers (including decimals and fractions) followed by units
    return instruction.replace(/(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?|degrees?|°[CF]?)/gi, (match, number, unit) => {
      try {
        // Handle fractions
        let value;
        if (number.includes('/')) {
          const [num, den] = number.split('/').map(s => parseFloat(s.trim()));
          value = num / den;
        } else {
          value = parseFloat(number);
        }

        // Scale the value
        const scaled = value * scale;

        // Format nicely
        let formattedNumber;
        if (scaled % 1 === 0) {
          formattedNumber = scaled.toString();
        } else {
          formattedNumber = scaled.toFixed(1).replace(/\.0$/, '');
        }

        return `${formattedNumber} ${unit}`;
      } catch (e) {
        return match; // Return original if parsing fails
      }
    });
  };

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
      for (const [section, items] of Object.entries(ingredients || {})) {
        if (!Array.isArray(items)) {
          parsedConverted[section] = [];
          continue;
        }
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

    // Scale instructions
    if (localRecipe?.instructions && Array.isArray(localRecipe.instructions)) {
      const scaled = localRecipe.instructions.map(step => scaleInstructionNumbers(step, scaleFactor));
      setScaledInstructions(scaled);
    }
  }, [parsedIngredients, scaleFactor, useMetric, localRecipe?.instructions]);


  /**
   * Handle long press on ingredient/instruction/section
   */
  const handleLongPress = (type, sectionKey, index, value) => {
    if (isReadOnly) return;
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
    if (onUpdate) onUpdate(updated);
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
      'Are you sure you want to delete this item?',
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
            if (onUpdate) onUpdate(updated);
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
   * Handle swap selection or move ingredient to different section
   */
  const handleSwapWith = (type, sectionKey, index) => {
    console.log('📍 handleSwapWith called:', { type, sectionKey, index });
    console.log('📍 Current swapMode:', swapMode);

    if (!swapMode) {
      console.log('❌ No swap mode active');
      return;
    }

    console.log('✅ Swap mode is active, proceeding...');
    console.log('  swapMode.type:', swapMode.type);
    console.log('  incoming type:', type);

    const { sectionKey: sourceSectionKey, index: sourceIndex } = swapMode;

    // Special case: Moving ingredient to a different section
    console.log('🔍 Checking if ingredient->section move:', swapMode.type === 'ingredient', '&&', type === 'section');
    if (swapMode.type === 'ingredient' && type === 'section') {
      console.log('✅ YES! Moving ingredient to different section:', sourceSectionKey, '->', sectionKey);
      let updated = { ...localRecipe };

      // Get the ingredient to move
      const sourceItems = [...updated.ingredients[sourceSectionKey]];
      const ingredientToMove = sourceItems[sourceIndex];

      // Remove from source section
      sourceItems.splice(sourceIndex, 1);

      // If source section is now empty and not 'main', delete it
      if (sourceItems.length === 0 && sourceSectionKey !== 'main') {
        const ingredients = { ...updated.ingredients };
        delete ingredients[sourceSectionKey];
        updated.ingredients = ingredients;
      } else {
        updated.ingredients = { ...updated.ingredients, [sourceSectionKey]: sourceItems };
      }

      // Add to target section at the beginning
      const targetItems = [...(updated.ingredients[sectionKey] || [])];
      targetItems.unshift(ingredientToMove);
      updated.ingredients = { ...updated.ingredients, [sectionKey]: targetItems };

      setLocalRecipe(updated);
      if (onUpdate) onUpdate(updated);
      setSwapMode(null);
      return;
    }

    // Regular swap operations
    if (swapMode.type !== type) {
      Alert.alert('Cannot Swap', "Can't swap different types of items");
      return;
    }

    let updated = { ...localRecipe };

    if (type === 'ingredient') {
      // Can only swap within same section
      if (sourceSectionKey !== sectionKey) {
        Alert.alert('Cannot Swap', 'Can only swap ingredients within the same section. To move to a different section, tap the section header.');
        setSwapMode(null);
        return;
      }

      const items = [...updated.ingredients[sectionKey]];
      console.log('Swapping ingredients:', sourceIndex, '<->', index);
      [items[sourceIndex], items[index]] = [items[index], items[sourceIndex]];
      updated.ingredients = { ...updated.ingredients, [sectionKey]: items };
    } else if (type === 'section') {
      // Swap section order
      console.log('Swapping sections:', sourceSectionKey, '<->', sectionKey);

      // Get all section keys in order
      const sectionKeys = Object.keys(updated.ingredients);
      const sourceIdx = sectionKeys.indexOf(sourceSectionKey);
      const targetIdx = sectionKeys.indexOf(sectionKey);

      if (sourceIdx === -1 || targetIdx === -1) {
        Alert.alert('Error', 'Could not find sections to swap');
        return;
      }

      // Swap positions in array
      [sectionKeys[sourceIdx], sectionKeys[targetIdx]] = [sectionKeys[targetIdx], sectionKeys[sourceIdx]];

      // Rebuild ingredients object with new order
      const reorderedIngredients = {};
      sectionKeys.forEach(key => {
        reorderedIngredients[key] = updated.ingredients[key];
      });

      updated.ingredients = reorderedIngredients;
    } else if (type === 'instruction') {
      const items = [...updated.instructions];
      console.log('Swapping instructions:', sourceIndex, '<->', index);
      [items[sourceIndex], items[index]] = [items[index], items[sourceIndex]];
      updated.instructions = items;
    }

    setLocalRecipe(updated);
    if (onUpdate) onUpdate(updated);
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
    } else if (type === 'section') {
      // Add ingredient to the beginning of this section
      const items = [...(updated.ingredients[sectionKey] || [])];
      items.unshift(newItemValue.trim());
      updated.ingredients = { ...updated.ingredients, [sectionKey]: items };
    } else if (type === 'instruction') {
      const items = [...updated.instructions];
      items.splice(index + 1, 0, newItemValue.trim());
      updated.instructions = items;
    }

    setLocalRecipe(updated);
    if (onUpdate) onUpdate(updated);
    setAddingBelow(null);
    setNewItemValue('');
    setEditingItem(null);
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
    setNewSectionName('');
    setShowAddSectionModal(true);
  };

  const confirmAddSection = () => {
    if (newSectionName && newSectionName.trim()) {
      const updated = {
        ...localRecipe,
        ingredients: {
          ...localRecipe.ingredients,
          [newSectionName.trim()]: []
        }
      };
      setLocalRecipe(updated);
      if (onUpdate) onUpdate(updated);
      setShowAddSectionModal(false);
      setNewSectionName('');
    } else {
      Alert.alert('Error', 'Please enter a section name');
    }
  };

  /**
   * Add a tag to the recipe
   */
  const addTag = (tagName) => {
    const normalizedTag = tagName.trim();
    if (!normalizedTag) return;

    const currentTags = localRecipe.tags || [];
    if (currentTags.some(t => t.toLowerCase() === normalizedTag.toLowerCase())) {
      return; // Tag already exists
    }

    const updated = {
      ...localRecipe,
      tags: [...currentTags, normalizedTag]
    };
    setLocalRecipe(updated);
    if (onUpdate) onUpdate(updated);
  };

  /**
   * Remove a tag from the recipe
   */
  const removeTag = (tagName) => {
    const currentTags = localRecipe.tags || [];
    const updated = {
      ...localRecipe,
      tags: currentTags.filter(t => t !== tagName)
    };
    setLocalRecipe(updated);
    if (onUpdate) onUpdate(updated);
  };

  /**
   * Add custom tag from input
   */
  const addCustomTag = () => {
    if (customTagInput.trim()) {
      addTag(customTagInput.trim());
      setCustomTagInput('');
    }
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
          // Use the displayed text which includes scaling/conversion
          const displayText = typeof item === 'string'
            ? item
            : typeof item === 'object' && item.original
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

  // Check if this recipe has original version (imported from URL and potentially edited)
  const hasOriginalVersion = localRecipe.originalRecipe && localRecipe.hasEdits;
  const isViewingOriginal = localRecipe.viewingOriginal === true;

  // Variants support
  const variants = localRecipe.variants || [];
  const hasVariants = variants.length > 0 || hasOriginalVersion;
  const selectedVariantId = localRecipe.selectedVariantId;
  const currentVariant = selectedVariantId
    ? variants.find(v => v.id === selectedVariantId)
    : null;
  const currentVersionName = currentVariant?.name || (isViewingOriginal ? 'Original' : (hasOriginalVersion ? 'My Edits' : 'Original'));

  return (
    <>
      {/* Folder badge - shown if recipe is in a cookbook */}
      {localRecipe.folder && localRecipe.folder !== 'All Recipes' && (
        <Text style={styles.folderBadge}>{typeof localRecipe.folder === 'string' ? localRecipe.folder : localRecipe.folder?.name || ''}</Text>
      )}
      <Text style={styles.modalTitle}>{localRecipe.title}</Text>

      {/* Tags - right below title (only shows if tags exist) */}
      {localRecipe.tags && localRecipe.tags.length > 0 && (
        <View style={styles.tagsRow}>
          <View style={styles.tagsInlineContainer}>
            {(tagsExpanded ? localRecipe.tags : localRecipe.tags.slice(0, 3)).map(tag => (
              <View key={tag} style={styles.tagChipSimple}>
                <Text style={styles.tagChipSimpleText}>{tag}</Text>
              </View>
            ))}
            {localRecipe.tags.length > 3 && (
              <TouchableOpacity
                onPress={() => setTagsExpanded(!tagsExpanded)}
                style={styles.tagExpandButton}
              >
                <Text style={styles.tagExpandButtonText}>
                  {tagsExpanded ? 'less' : `+${localRecipe.tags.length - 3}`}
                </Text>
              </TouchableOpacity>
            )}
            {!isReadOnly && (
              <TouchableOpacity
                onPress={() => setShowTagEditor(true)}
                style={styles.tagEditButton}
              >
                <Text style={styles.tagEditButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Version/Variant Selector - shows when recipe has variants or edits */}
      {hasVariants && (
        <View style={styles.versionToggleContainer}>
          <Text style={styles.versionLabel}>Version:</Text>
          <TouchableOpacity
            style={styles.variantSelector}
            onPress={() => setShowVariantPicker(true)}
          >
            <Text style={styles.variantSelectorText}>{currentVersionName}</Text>
            <Text style={styles.variantSelectorArrow}>▼</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit indicator badge */}
      {localRecipe.hasEdits && !isViewingOriginal && (
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeText}>Edited</Text>
        </View>
      )}

      {(localRecipe.prep_time || localRecipe.cook_time || localRecipe.servings) && (
        <View style={styles.metaContainer}>
          {localRecipe.prep_time && (
            <Text style={styles.metaText}>
              ⏱️ Prep Time: {formatDuration(localRecipe.prep_time)}
            </Text>
          )}
          {localRecipe.cook_time && (
            <Text style={styles.metaText}>
              🔥 Cook Time: {formatDuration(localRecipe.cook_time)}
            </Text>
          )}
          {localRecipe.servings && (
            <Text style={styles.metaText}>
              🍽️ Serves: {formatServings(localRecipe.servings)}
            </Text>
          )}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {!selectionMode && !isReadOnly && (
          <View style={styles.sectionHeaderButtons}>
            <TouchableOpacity onPress={() => setShowTagEditor(true)} style={styles.addSectionButton}>
              <Text style={styles.addSectionText}>+ Tags</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addNewSection} style={styles.addSectionButton}>
              <Text style={styles.addSectionText}>+ Section</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Grocery List Add Button - Hidden during edit/swap modes */}
      {!selectionMode && !editingItem && !swapMode && onAddToGroceryList && (
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

      {/* Scaling Disclaimer */}
      {scaleFactor !== 1 && (
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ Note: Cooking times may vary when modifying quantities
          </Text>
        </View>
      )}

      {displayedIngredients && Object.entries(displayedIngredients).map(([section, items]) => {
        // Display "Ingredients" for 'main' section, otherwise use section name
        const displaySectionName = section === 'main' ? 'Ingredients' : section;

        return (
          <View key={section} style={styles.ingredientSection}>
            <TouchableOpacity
              onLongPress={() => handleLongPress('section', section, 0, section)}
              onPress={() => {
                console.log('🎯 Section header tapped:', section, 'swapMode:', swapMode);
                if (swapMode) {
                  console.log('  → Calling handleSwapWith with section');
                  handleSwapWith('section', section, 0);
                }
              }}
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
                    swapMode?.type === 'section' && swapMode?.sectionKey === section && styles.highlightedItem,
                    swapMode?.type === 'ingredient' && styles.sectionHeaderClickable
                  ]}
                >
                  {displaySectionName}
                </Text>
              )}
            </TouchableOpacity>

            {/* Action buttons for sections */}
            {editingItem?.type === 'section' && editingItem?.sectionKey === section && (
              <View style={styles.actionButtons}>
                {section !== 'main' && (
                  <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>❌ Delete Section</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={startSwap} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>🔄 Swap Section</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={startAddBelow} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>➕ Add Ingredient</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Add below input for sections */}
            {addingBelow?.type === 'section' && addingBelow?.sectionKey === section && (
              <View style={styles.addBelowContainer}>
                <TextInput
                  style={styles.addBelowInput}
                  placeholder="New ingredient..."
                  value={newItemValue}
                  onChangeText={setNewItemValue}
                  onSubmitEditing={saveNewItem}
                  autoFocus
                />
                <TouchableOpacity onPress={saveNewItem} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelAddBelow} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
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
                    <View style={styles.editInputContainer}>
                      <TextInput
                        style={styles.ingredientItemInput}
                        value={editingItem.value}
                        onChangeText={(text) => setEditingItem({ ...editingItem, value: text })}
                        multiline
                        autoFocus
                      />
                      <View style={styles.editButtons}>
                        <TouchableOpacity onPress={saveEdit} style={styles.saveEditButton}>
                          <Text style={styles.saveEditButtonText}>✓ Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.cancelEditButton}>
                          <Text style={styles.cancelEditButtonText}>✕ Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
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
        );
      })}

      <Text style={styles.sectionTitle}>Instructions</Text>
      {(scaledInstructions || localRecipe?.instructions || []).map((step, idx) => (
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
                <View style={styles.editInputContainer}>
                  <TextInput
                    style={styles.stepTextInput}
                    value={editingItem.value}
                    onChangeText={(text) => setEditingItem({ ...editingItem, value: text })}
                    multiline
                    autoFocus
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity onPress={saveEdit} style={styles.saveEditButton}>
                      <Text style={styles.saveEditButtonText}>✓ Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.cancelEditButton}>
                      <Text style={styles.cancelEditButtonText}>✕ Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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

      {/* Nutrition - at the bottom, after instructions */}
      {(() => {
        const items = buildNutritionItems(localRecipe.nutrition, scaleFactor);
        if (items.length === 0) return null;

        const perServing = localRecipe.nutrition?.servingSize || null;
        const perLabel = scaleFactor === 1
          ? (perServing ? `per ${perServing}` : 'per serving')
          : `total (${scaleFactor}x recipe)`;

        return (
          <View style={styles.nutritionContainer}>
            <View style={styles.nutritionHeader}>
              <Text style={styles.nutritionTitle}>📊 Nutrition</Text>
              <Text style={styles.nutritionSub}>{perLabel}</Text>
            </View>
            <View style={styles.nutritionGrid}>
              {items.map(item => (
                <View key={item.label} style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{item.value}</Text>
                  <Text style={styles.nutritionLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}

      {/* Source/Creator Info */}
      {(() => {
        const sourceUrl = localRecipe.url || localRecipe.sourceUrl || localRecipe.source_url;
        const isBunchesUrl = sourceUrl && sourceUrl.startsWith('bunches://');
        const creatorUsername = localRecipe.ownerUsername || localRecipe.createdBy?.username;
        const creatorUserId = localRecipe.ownerUserId || localRecipe.createdBy?.id;

        // Read-only or Bunches user recipe: show creator link, not the bunches URL
        if (isBunchesUrl || (isReadOnly && creatorUsername)) {
          if (!creatorUsername) return null;
          return (
            <View style={styles.sourceContainer}>
              <Text style={styles.sourceLabel}>Created by:</Text>
              <TouchableOpacity onPress={() => onViewOwnerProfile?.(creatorUserId, creatorUsername)}>
                <Text style={styles.sourceUrl}>@{creatorUsername}</Text>
              </TouchableOpacity>
            </View>
          );
        }

        // External URL: show link
        if (sourceUrl) {
          return (
            <View style={styles.sourceContainer}>
              <Text style={styles.sourceLabel}>Source:</Text>
              <TouchableOpacity onPress={() => {
                Linking.openURL(sourceUrl).catch(() =>
                  Alert.alert('Error', 'Could not open URL')
                );
              }}>
                <Text style={styles.sourceUrl}>{sourceUrl}</Text>
              </TouchableOpacity>
            </View>
          );
        }

        // Manual recipe fallback
        if (localRecipe.source === 'manual' && creatorUsername) {
          return (
            <View style={styles.sourceContainer}>
              <Text style={styles.sourceLabel}>Created by:</Text>
              <Text style={styles.creatorName}>@{creatorUsername}</Text>
            </View>
          );
        }

        return null;
      })()}

      {/* Privacy Toggle
          - Custom recipes (created in-app): controls whether the whole recipe is public
          - Imported recipes (from the web): the original is already public online, so the
            toggle only controls whether YOUR customized version (edits/variants) is shared */}
      {onUpdate && !isReadOnly && (() => {
        const sourceUrl = localRecipe.url || localRecipe.sourceUrl || localRecipe.source_url;
        const isCustom = !sourceUrl || sourceUrl.startsWith('bunches://');
        const effectivePrivate = localRecipe.isPrivate || isFolderPrivate;

        const label = isFolderPrivate
          ? '🔒 Private (folder is private)'
          : isCustom
            ? (localRecipe.isPrivate ? '🔒 Private Recipe' : '🌐 Public Recipe')
            : (localRecipe.isPrivate ? '✏️ My Version: Private' : '✏️ My Version: Shared');

        const hint = isFolderPrivate
          ? 'Recipes in private folders are always private'
          : isCustom
            ? (localRecipe.isPrivate
                ? 'Only you can see this recipe'
                : 'Friends can view this recipe if your account is public')
            : (localRecipe.isPrivate
                ? 'Your edits stay private - others only see the original recipe'
                : 'Friends can see your customized version, including your edits');

        return (
          <View style={styles.privacyContainer}>
            <View style={styles.privacyRow}>
              <Text style={styles.privacyLabel}>{label}</Text>
              <TouchableOpacity
                style={[
                  styles.privacyToggle,
                  effectivePrivate && styles.privacyToggleActive
                ]}
                onPress={() => {
                  if (isFolderPrivate) {
                    Alert.alert(
                      'Folder is Private',
                      'This recipe is in a private folder, so it must remain private. Move it to a public folder to make it public.'
                    );
                    return;
                  }
                  const newPrivacy = !localRecipe.isPrivate;
                  setLocalRecipe(prev => ({ ...prev, isPrivate: newPrivacy }));
                  onUpdate({ ...localRecipe, isPrivate: newPrivacy });
                }}
                disabled={isFolderPrivate}
              >
                <Text style={styles.privacyToggleText}>
                  {effectivePrivate ? 'Private' : (isCustom ? 'Public' : 'Shared')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.privacyHint}>{hint}</Text>
          </View>
        );
      })()}

      {/* Tag Editor Modal */}
      <Modal
        visible={showTagEditor}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTagEditor(false)}
      >
        <View style={styles.tagEditorOverlay}>
          <View style={styles.tagEditorContainer}>
            <View style={styles.tagEditorHeader}>
              <Text style={styles.tagEditorTitle}>Add Tags</Text>
              <TouchableOpacity onPress={() => setShowTagEditor(false)}>
                <Text style={styles.tagEditorClose}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Custom Tag Input */}
            <View style={styles.customTagInputContainer}>
              <TextInput
                style={styles.customTagInput}
                placeholder="Add custom tag..."
                value={customTagInput}
                onChangeText={setCustomTagInput}
                onSubmitEditing={addCustomTag}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={addCustomTag}
                style={styles.addCustomTagButton}
              >
                <Text style={styles.addCustomTagButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Current Tags */}
            {localRecipe.tags && localRecipe.tags.length > 0 && (
              <View style={styles.currentTagsSection}>
                <Text style={styles.tagEditorSectionTitle}>Current Tags</Text>
                <View style={styles.tagEditorTagsGrid}>
                  {localRecipe.tags.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.tagEditorChip}
                      onPress={() => removeTag(tag)}
                    >
                      <Text style={styles.tagEditorChipText}>{tag} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* My Custom Tags */}
            {myCustomTags.length > 0 && (
              <View style={styles.currentTagsSection}>
                <Text style={styles.tagEditorSectionTitle}>My Custom Tags</Text>
                <View style={styles.tagEditorTagsGrid}>
                  {myCustomTags.map(tag => {
                    const isSelected = localRecipe.tags?.some(
                      t => t.toLowerCase() === tag.toLowerCase()
                    );
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          styles.tagEditorChipOutline,
                          isSelected && styles.tagEditorChipOutlineSelected
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            removeTag(tag);
                          } else {
                            addTag(tag);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.tagEditorChipOutlineText,
                            isSelected && styles.tagEditorChipOutlineTextSelected
                          ]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Suggested Tags */}
            <ScrollView style={styles.predefinedTagsScroll}>
              <Text style={styles.tagEditorSectionTitle}>Suggested Tags</Text>
              <View style={styles.tagEditorTagsGrid}>
                {PREDEFINED_TAGS.map(tag => {
                  const isSelected = localRecipe.tags?.some(
                    t => t.toLowerCase() === tag.name.toLowerCase()
                  );
                  return (
                    <TouchableOpacity
                      key={tag.name}
                      style={[
                        styles.tagEditorChipOutline,
                        isSelected && styles.tagEditorChipOutlineSelected
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          removeTag(tag.name);
                        } else {
                          addTag(tag.name);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.tagEditorChipOutlineText,
                          isSelected && styles.tagEditorChipOutlineTextSelected
                        ]}
                      >
                        {tag.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {swapMode && (
        <View style={styles.swapModeNotice}>
          <Text style={styles.swapModeText}>
            {swapMode.type === 'ingredient'
              ? '🔄 Swap Mode: Tap ingredient to swap, or tap section header to move'
              : `🔄 Swap Mode: Tap another ${swapMode.type} to swap`}
          </Text>
          <TouchableOpacity
            onPress={() => setSwapMode(null)}
            style={styles.cancelSwapButton}
          >
            <Text style={styles.cancelSwapText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Section Modal */}
      <Modal
        visible={showAddSectionModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddSectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addSectionModalContainer}>
            <Text style={styles.addSectionModalTitle}>Add New Section</Text>
            <Text style={styles.addSectionModalLabel}>Section name:</Text>
            <TextInput
              style={styles.addSectionInput}
              placeholder="e.g., For the sauce, Toppings..."
              value={newSectionName}
              onChangeText={setNewSectionName}
              autoFocus
              onSubmitEditing={confirmAddSection}
              returnKeyType="done"
            />
            <View style={styles.addSectionModalButtons}>
              <TouchableOpacity
                style={[styles.addSectionModalButton, styles.cancelSectionButton]}
                onPress={() => {
                  setShowAddSectionModal(false);
                  setNewSectionName('');
                }}
              >
                <Text style={styles.cancelSectionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addSectionModalButton, styles.confirmSectionButton]}
                onPress={confirmAddSection}
              >
                <Text style={styles.confirmSectionButtonText}>Add Section</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Variant Picker Modal */}
      <Modal
        visible={showVariantPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowVariantPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowVariantPicker(false)}
        >
          <View style={styles.variantPickerContainer}>
            <Text style={styles.variantPickerTitle}>Select Version</Text>

            {/* Original/Base Version */}
            <TouchableOpacity
              style={[
                styles.variantOption,
                !selectedVariantId && !currentVariant && styles.variantOptionActive
              ]}
              onPress={() => {
                if (onToggleVersion) {
                  onToggleVersion(localRecipe.id, true);
                }
                if (onSelectVariant) {
                  onSelectVariant(localRecipe.id, null);
                }
                setShowVariantPicker(false);
              }}
            >
              <Text style={styles.variantOptionText}>📄 Original</Text>
              {!selectedVariantId && !currentVariant && isViewingOriginal && (
                <Text style={styles.variantOptionCheck}>✓</Text>
              )}
            </TouchableOpacity>

            {/* Legacy "My Edits" if exists but no variants */}
            {hasOriginalVersion && variants.length === 0 && (
              <TouchableOpacity
                style={[
                  styles.variantOption,
                  !isViewingOriginal && styles.variantOptionActive
                ]}
                onPress={() => {
                  if (onToggleVersion) {
                    onToggleVersion(localRecipe.id, false);
                  }
                  setShowVariantPicker(false);
                }}
              >
                <Text style={styles.variantOptionText}>✏️ My Edits</Text>
                {!isViewingOriginal && (
                  <Text style={styles.variantOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            )}

            {/* User's Variants */}
            {variants.map(variant => (
              <TouchableOpacity
                key={variant.id}
                style={[
                  styles.variantOption,
                  selectedVariantId === variant.id && styles.variantOptionActive
                ]}
                onPress={() => {
                  if (onSelectVariant) {
                    onSelectVariant(localRecipe.id, variant.id);
                  }
                  setShowVariantPicker(false);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.variantOptionText}>
                    {variant.sharedBy ? '🤝' : '📝'} {variant.name}
                  </Text>
                  {variant.sharedBy && (
                    <Text style={styles.variantSharedBy}>shared by @{variant.sharedBy}</Text>
                  )}
                </View>
                {selectedVariantId === variant.id && (
                  <Text style={styles.variantOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Variant Modal */}
      <Modal
        visible={showCreateVariant}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCreateVariant(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addSectionModalContainer}>
            <Text style={styles.addSectionModalTitle}>Create Variant</Text>
            <Text style={styles.addSectionModalLabel}>Variant name:</Text>
            <TextInput
              style={styles.addSectionInput}
              placeholder="e.g., Spicy Version, Low Carb..."
              value={newVariantName}
              onChangeText={setNewVariantName}
              autoFocus
              returnKeyType="done"
            />
            <View style={styles.addSectionModalButtons}>
              <TouchableOpacity
                style={[styles.addSectionModalButton, styles.cancelSectionButton]}
                onPress={() => {
                  setShowCreateVariant(false);
                  setNewVariantName('');
                }}
              >
                <Text style={styles.cancelSectionButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addSectionModalButton, styles.confirmSectionButton]}
                onPress={() => {
                  if (newVariantName.trim() && onCreateVariant) {
                    onCreateVariant(localRecipe.id, newVariantName.trim());
                    setShowCreateVariant(false);
                    setNewVariantName('');
                  }
                }}
              >
                <Text style={styles.confirmSectionButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  folderBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: colors.text,
  },
  nutritionContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nutritionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  nutritionSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    width: '31%',
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  nutritionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaContainer: {
    flexDirection: 'column',
    marginBottom: 20,
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Version toggle styles
  versionToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: 10,
  },
  versionToggleButtons: {
    flexDirection: 'row',
    flex: 1,
  },
  versionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  versionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  versionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  versionButtonTextActive: {
    color: colors.white,
  },
  // Variant selector styles
  variantSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  variantSelectorArrow: {
    fontSize: 10,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  variantPickerContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    width: '85%',
    maxHeight: '70%',
  },
  variantPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  variantOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  variantOptionActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  variantOptionText: {
    fontSize: 15,
    color: colors.text,
  },
  variantSharedBy: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  variantOptionCheck: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: 'bold',
  },
  createVariantButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  createVariantButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  editBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  editBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeaderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
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
  sectionHeaderClickable: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
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
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 5,
    gap: 8,
  },
  actionButton: {
    backgroundColor: colors.lightGray,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  addBelowContainer: {
    flexDirection: 'row',
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
    color: colors.text,
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
    textDecorationLine: 'underline',
  },
  creatorName: {
    fontSize: 13,
    color: colors.primary,
    fontStyle: 'italic',
  },
  privacyContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privacyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  privacyToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 15,
  },
  privacyToggleActive: {
    backgroundColor: colors.textSecondary,
  },
  privacyToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  privacyHint: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  disclaimer: {
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFA500',
  },
  disclaimerText: {
    fontSize: 13,
    color: '#8B6914',
    fontWeight: '500',
  },
  // Add Section Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSectionModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  addSectionModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: colors.text,
  },
  addSectionModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  addSectionInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 20,
    color: colors.text,
  },
  addSectionModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  addSectionModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelSectionButton: {
    backgroundColor: colors.lightGray,
  },
  cancelSectionButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmSectionButton: {
    backgroundColor: colors.primary,
  },
  confirmSectionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
  editInputContainer: {
    flex: 1,
  },
  editButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  saveEditButton: {
    backgroundColor: colors.success,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  saveEditButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelEditButton: {
    backgroundColor: colors.textSecondary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  cancelEditButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
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
  // Tags Inline Styles (below title)
  tagsRow: {
    marginBottom: 12,
  },
  tagsInlineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  tagChipSimple: {
    backgroundColor: '#E8E8E8',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tagChipSimpleText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  tagExpandButton: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tagExpandButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  tagEditButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tagEditButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  addTagsLink: {
    paddingVertical: 4,
  },
  addTagsLinkText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  // Tag Editor Modal Styles
  tagEditorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  tagEditorContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 30,
  },
  tagEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tagEditorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  tagEditorClose: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  customTagInputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  customTagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  addCustomTagButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addCustomTagButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  currentTagsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tagEditorSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  tagEditorTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagEditorChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#666',
  },
  tagEditorChipText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  tagEditorChipOutline: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#999',
    backgroundColor: 'transparent',
  },
  tagEditorChipOutlineSelected: {
    backgroundColor: '#666',
    borderColor: '#666',
  },
  tagEditorChipOutlineText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tagEditorChipOutlineTextSelected: {
    color: '#fff',
  },
  predefinedTagsScroll: {
    paddingHorizontal: 16,
    maxHeight: 300,
  },
});

export default RecipeDetail;
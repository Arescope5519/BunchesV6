/**
 * FILENAME: src/screens/HomeScreen.js
 * PURPOSE: Main application screen
 * CHANGES: Added updateRecipe prop to RecipeDetail component
 * DEPENDENCIES: All hooks, RecipeDetail component, colors
 * USED BY: App.js
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
  BackHandler,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Share,
  Clipboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Hooks
import { useRecipes } from '../hooks/useRecipes';
import { useFolders } from '../hooks/useFolders';
import { useShareIntent } from '../hooks/useShareIntent';
import { useRecipeExtraction } from '../hooks/useRecipeExtraction';
import { useGroceryList } from '../hooks/useGroceryList';
import { useGlobalUndo } from '../hooks/useGlobalUndo';

// Components
import RecipeDetail from '../components/RecipeDetail';
import { GroceryList } from '../components/GroceryList';
import { IngredientSearch } from '../components/IngredientSearch';
import { DashboardScreen } from './DashboardScreen';
import { CreateRecipeScreen } from './CreateRecipeScreen';
import { SettingsScreen } from './SettingsScreen';

// Constants
import colors from '../constants/colors';

export const HomeScreen = () => {
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // dashboard, recipes, create, import, search, grocery, settings

  // Local state
  const [url, setUrl] = useState('');
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [showGroceryList, setShowGroceryList] = useState(false);
  const [showRenameFolder, setShowRenameFolder] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importTargetFolder, setImportTargetFolder] = useState('All Recipes');
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);

  // Multiselect state
  const [multiselectMode, setMultiselectMode] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState(new Set());

  // Hooks
  const {
    recipes,
    loadingRecipes,
    selectedRecipe,
    setSelectedRecipe,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
    restoreRecipe,
    permanentlyDeleteRecipe,
    emptyRecentlyDeleted,
    toggleFavorite,
    moveToFolder: moveRecipeToFolder,
    getFilteredRecipes,
    refreshRecipes,
  } = useRecipes();

  const {
    folders,
    currentFolder,
    setCurrentFolder,
    addFolder: addFolderBase,
    renameFolder: renameFolderBase,
    deleteFolder: deleteFolderBase,
    getCustomFolders,
  } = useFolders();

  const {
    groceryList,
    loading: groceryListLoading,
    addItems: addItemsToGroceryList,
    removeItem: removeGroceryItem,
    toggleItemChecked,
    clearCheckedItems,
    clearAllItems,
    getUncheckedCount,
    restoreList: restoreGroceryList,
  } = useGroceryList();

  // Global undo system
  const {
    addUndoAction,
    performUndo,
    clearUndoStack,
    showUndoButton,
    canUndo,
    lastActionDescription,
  } = useGlobalUndo();

  const { loading, extractRecipe } = useRecipeExtraction(async (recipe, shouldSave) => {
    // Save function to be called either immediately or after confirmation
    const saveRecipeToFolder = async () => {
      console.log('💾 Saving recipe:', recipe.title);

      // Use the selected import target folder
      const recipeWithFolder = {
        ...recipe,
        folder: importTargetFolder === 'Favorites' || importTargetFolder === 'Recently Deleted'
          ? 'All Recipes'
          : importTargetFolder,
      };

      const saved = await saveRecipe(recipeWithFolder);
      if (saved) {
        console.log('✅ Recipe saved successfully');
        setSelectedRecipe(recipeWithFolder);
        setCurrentScreen('recipes');
      } else {
        console.error('❌ Failed to save recipe');
        Alert.alert('Error', 'Failed to save recipe. Please try again.');
      }
      setUrl('');
    };

    // Auto-save (from share intent) - save immediately without prompt
    if (shouldSave) {
      console.log('📲 Auto-saving recipe from share intent');
      await saveRecipeToFolder();
      return;
    }

    // Manual extraction - show confirmation dialog
    Alert.alert(
      '✅ Recipe Extracted',
      `"${recipe.title}"\n\nSave this recipe to ${importTargetFolder}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setUrl('');
          }
        },
        {
          text: 'Save',
          onPress: saveRecipeToFolder
        }
      ]
    );
  });

  // Navigation handler
  const handleNavigation = (screen) => {
    if (screen === 'recipes') {
      setCurrentScreen('recipes');
    } else if (screen === 'create') {
      setCurrentScreen('create');
    } else if (screen === 'import') {
      setShowImport(true);
      // Stay on current screen, import is a modal
    } else if (screen === 'search') {
      setShowIngredientSearch(true);
      // Stay on current screen, search is a modal
    } else if (screen === 'grocery') {
      setShowGroceryList(true);
      // Stay on current screen, grocery is a modal
    } else if (screen === 'settings') {
      setCurrentScreen('settings');
    }
  };

  // Handle recipe creation
  const handleCreateRecipe = async (recipe) => {
    const saved = await saveRecipe(recipe);
    if (saved) {
      Alert.alert('✅ Success', `Recipe "${recipe.title}" created!`);
      setCurrentScreen('recipes');
      setSelectedRecipe(recipe);
    } else {
      Alert.alert('Error', 'Failed to create recipe. Please try again.');
    }
  };

  // Handle clear all data
  const handleClearAllData = async () => {
    try {
      const { saveRecipes } = require('../utils/storage');
      await saveRecipes([]);
      await refreshRecipes();
      setCurrentScreen('dashboard');
      Alert.alert('✅ Success', 'All data has been cleared');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear data');
    }
  };

  // Share intent handler - auto-extract when URL is shared
  useShareIntent((sharedUrl) => {
    console.log('📲 Received shared URL:', sharedUrl);
    setUrl(sharedUrl);
    // Auto-extract recipe from shared URL
    setTimeout(() => extractRecipe(sharedUrl, true), 500);
  });

  // Grocery list handlers with undo support
  const handleAddToGroceryList = async (selectedItems) => {
    if (!selectedRecipe || selectedItems.length === 0) return;

    // Save state for undo
    const previousList = JSON.parse(JSON.stringify(groceryList));
    addUndoAction({
      type: 'grocery_add',
      description: `Add ${selectedItems.length} Items`,
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    // Add all selected items to grocery list
    const ingredientTexts = selectedItems.map(item => item.text);
    await addItemsToGroceryList(ingredientTexts, selectedRecipe, selectedItems[0]?.section || 'main');
  };

  const handleToggleGroceryItem = async (itemId) => {
    const previousList = JSON.parse(JSON.stringify(groceryList));
    const item = groceryList.find(i => i.id === itemId);
    if (!item) return;

    addUndoAction({
      type: 'grocery_toggle',
      description: item.checked ? 'Uncheck Item' : 'Check Item',
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    await toggleItemChecked(itemId);
  };

  const handleRemoveGroceryItem = async (itemId) => {
    const previousList = JSON.parse(JSON.stringify(groceryList));
    const item = groceryList.find(i => i.id === itemId);
    if (!item) return;

    addUndoAction({
      type: 'grocery_remove',
      description: 'Remove Item',
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    await removeGroceryItem(itemId);
  };

  const handleClearCheckedItems = async () => {
    const checkedItems = groceryList.filter(item => item.checked);
    if (checkedItems.length === 0) return;

    const previousList = JSON.parse(JSON.stringify(groceryList));
    addUndoAction({
      type: 'grocery_clear_checked',
      description: `Clear ${checkedItems.length} Items`,
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    await clearCheckedItems();
  };

  const handleClearAllItems = async () => {
    const itemCount = groceryList.length;
    if (itemCount === 0) return;

    const previousList = JSON.parse(JSON.stringify(groceryList));
    addUndoAction({
      type: 'grocery_clear_all',
      description: `Clear All (${itemCount} items)`,
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    await clearAllItems();
  };

  // Multiselect handlers
  const enterMultiselectMode = (recipeId) => {
    setMultiselectMode(true);
    setSelectedRecipes(new Set([recipeId]));
  };

  const exitMultiselectMode = () => {
    setMultiselectMode(false);
    setSelectedRecipes(new Set());
  };

  const toggleRecipeSelection = (recipeId) => {
    setSelectedRecipes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recipeId)) {
        newSet.delete(recipeId);
      } else {
        newSet.add(recipeId);
      }
      return newSet;
    });
  };

  const deleteSelectedRecipes = async () => {
    if (selectedRecipes.size === 0) return;

    const recipeCount = selectedRecipes.size;
    const recipeIds = Array.from(selectedRecipes);

    Alert.alert(
      'Delete Recipes',
      `Delete ${recipeCount} recipe${recipeCount > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Batch delete: mark all selected recipes with deletedAt timestamp
            const now = Date.now();
            const updatedRecipes = recipes.map(r =>
              recipeIds.includes(r.id) ? { ...r, deletedAt: now } : r
            );

            // Save all at once
            const { saveRecipes } = require('../utils/storage');
            await saveRecipes(updatedRecipes);

            // Reload recipes to reflect changes
            await refreshRecipes();

            exitMultiselectMode();
          }
        }
      ]
    );
  };

  // Base64 encode helper (handles Unicode properly)
  const encodeBase64 = (str) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // Convert Unicode string to UTF-8 bytes
    const utf8 = unescape(encodeURIComponent(str));
    let result = '';

    for (let i = 0; i < utf8.length; i += 3) {
      const byte1 = utf8.charCodeAt(i);
      const byte2 = i + 1 < utf8.length ? utf8.charCodeAt(i + 1) : 0;
      const byte3 = i + 2 < utf8.length ? utf8.charCodeAt(i + 2) : 0;

      const encoded1 = byte1 >> 2;
      const encoded2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
      const encoded3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
      const encoded4 = byte3 & 0x3f;

      result += chars[encoded1];
      result += chars[encoded2];
      result += i + 1 < utf8.length ? chars[encoded3] : '=';
      result += i + 2 < utf8.length ? chars[encoded4] : '=';
    }

    return result;
  };

  // Base64 decode helper (handles Unicode properly)
  const decodeBase64 = (encoded) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // Remove any whitespace and padding
    encoded = encoded.replace(/[\s=]+$/, '');
    let result = '';

    for (let i = 0; i < encoded.length; i += 4) {
      const enc1 = chars.indexOf(encoded[i]);
      const enc2 = chars.indexOf(encoded[i + 1]);
      const enc3 = i + 2 < encoded.length ? chars.indexOf(encoded[i + 2]) : -1;
      const enc4 = i + 3 < encoded.length ? chars.indexOf(encoded[i + 3]) : -1;

      if (enc1 === -1 || enc2 === -1) {
        throw new Error('Invalid Base64 character');
      }

      const byte1 = (enc1 << 2) | (enc2 >> 4);
      result += String.fromCharCode(byte1);

      if (enc3 !== -1) {
        const byte2 = ((enc2 & 0x0f) << 4) | (enc3 >> 2);
        result += String.fromCharCode(byte2);
      }

      if (enc4 !== -1) {
        const byte3 = ((enc3 & 0x03) << 6) | enc4;
        result += String.fromCharCode(byte3);
      }
    }

    // Convert UTF-8 bytes back to Unicode string
    try {
      return decodeURIComponent(escape(result));
    } catch (e) {
      console.error('UTF-8 decode error:', e);
      return result;
    }
  };

  // Copy to clipboard and show share dialog
  const copyToClipboard = async (text, title) => {
    try {
      await Clipboard.setString(text);
      Alert.alert(
        '✅ Copied!',
        `${title}\n\nThe code has been copied to your clipboard. You can now:\n\n1. Share it via any app\n2. Or paste it directly in Import (📥) to test`,
        [
          { text: 'OK' },
          {
            text: 'Share',
            onPress: () => Share.share({ message: text, title })
          }
        ]
      );
    } catch (error) {
      console.error('Clipboard error:', error);
      // Fallback to share dialog
      await Share.share({ message: text, title });
    }
  };

  // Share recipe handler
  const shareRecipe = async (recipe) => {
    try {
      const recipeData = {
        version: '1.0',
        type: 'recipe',
        data: {
          ...recipe,
          // Remove system fields
          deletedAt: undefined,
        }
      };

      const jsonString = JSON.stringify(recipeData);
      const encoded = encodeBase64(jsonString);
      const shareCode = `BUNCHES_RECIPE:${encoded}`;

      await copyToClipboard(shareCode, `Recipe: ${recipe.title}`);
    } catch (error) {
      console.error('Error sharing recipe:', error);
      Alert.alert('Error', 'Failed to share recipe');
    }
  };

  // Share entire cookbook handler
  const shareCookbook = async (cookbookName) => {
    try {
      const recipesInCookbook = getFilteredRecipes(cookbookName).filter(r => !r.deletedAt);

      if (recipesInCookbook.length === 0) {
        Alert.alert('Empty Cookbook', 'This cookbook has no recipes to share');
        return;
      }

      const cookbookData = {
        version: '1.0',
        type: 'cookbook',
        name: cookbookName,
        data: recipesInCookbook.map(r => ({
          ...r,
          deletedAt: undefined,
        }))
      };

      const jsonString = JSON.stringify(cookbookData);
      const encoded = encodeBase64(jsonString);
      const shareCode = `BUNCHES_COOKBOOK:${encoded}`;

      await copyToClipboard(shareCode, `Cookbook: ${cookbookName} (${recipesInCookbook.length} recipes)`);
    } catch (error) {
      console.error('Error sharing cookbook:', error);
      Alert.alert('Error', 'Failed to share cookbook');
    }
  };

  // Import recipe from code or JSON
  const importRecipe = async (inputText) => {
    try {
      let cleanedInput = inputText.trim();
      let jsonString = cleanedInput;

      // Check if it's a BUNCHES code (Base64 encoded)
      if (cleanedInput.includes('BUNCHES_RECIPE:') || cleanedInput.includes('BUNCHES_COOKBOOK:')) {
        const recipeMatch = cleanedInput.match(/BUNCHES_RECIPE:([A-Za-z0-9+/=]+)/);
        const cookbookMatch = cleanedInput.match(/BUNCHES_COOKBOOK:([A-Za-z0-9+/=]+)/);

        if (recipeMatch) {
          jsonString = decodeBase64(recipeMatch[1]);
        } else if (cookbookMatch) {
          jsonString = decodeBase64(cookbookMatch[1]);
        } else {
          throw new Error('Could not find valid BUNCHES code in the text');
        }
      }

      const parsed = JSON.parse(jsonString);
      await processImport(parsed, importTargetFolder, saveRecipe);
    } catch (error) {
      Alert.alert(
        '❌ Import Error',
        `Failed to import: ${error.message}\n\nPlease copy the ENTIRE code starting with BUNCHES_RECIPE: or BUNCHES_COOKBOOK:`
      );
    }
  };

  // Helper to process parsed import data
  const processImport = async (parsed, targetFolder, saveRecipe) => {
    if (parsed.version !== '1.0') {
      throw new Error('Unsupported format version: ' + parsed.version);
    }

    if (parsed.type === 'recipe') {
      const recipeData = parsed.data;
      const newRecipe = {
        ...recipeData,
        id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        folder: targetFolder === 'Favorites' || targetFolder === 'Recently Deleted' ? 'All Recipes' : targetFolder,
      };

      await saveRecipe(newRecipe);
      Alert.alert('✅ Success', `Recipe "${newRecipe.title}" imported to ${newRecipe.folder}!`);
    } else if (parsed.type === 'cookbook') {
      const recipesToImport = parsed.data;

      // Determine target folder for all recipes in the cookbook
      const finalFolder = targetFolder === 'Favorites' || targetFolder === 'Recently Deleted' ? 'All Recipes' : targetFolder;

      // Batch import: create all recipes with new IDs and target folder
      const newRecipes = recipesToImport.map((recipeData, index) => ({
        ...recipeData,
        id: `recipe-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        folder: finalFolder, // Override original folder
        deletedAt: undefined, // Remove any deletedAt
      }));

      // Save all at once by prepending to existing recipes
      const { saveRecipes } = require('../utils/storage');
      const currentRecipes = recipes.filter(r => !r.deletedAt); // Get current non-deleted recipes
      await saveRecipes([...newRecipes, ...currentRecipes]);

      // Reload to reflect changes
      await refreshRecipes();

      Alert.alert('✅ Success', `Imported ${newRecipes.length} recipe${newRecipes.length > 1 ? 's' : ''} from "${parsed.name}" to ${finalFolder}`);
    } else {
      throw new Error('Unknown import type: ' + parsed.type);
    }
  };

  // Cookbook operations with recipe updates
  const addFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a cookbook name');
      return;
    }

    const success = await addFolderBase(newFolderName);
    if (success) {
      setNewFolderName('');
      setShowAddFolder(false);
    }
  };

  const renameFolder = async () => {
    const result = await renameFolderBase(editingFolder, editingFolderName);

    if (result.success) {
      // Update all recipes in that folder
      const recipesInFolder = recipes.filter(r => r.folder === result.oldName);
      for (const recipe of recipesInFolder) {
        await moveRecipeToFolder(recipe.id, result.newName);
      }

      setEditingFolder(null);
      setEditingFolderName('');
    }
  };

  const deleteFolder = async (folderName) => {
    const recipesInFolder = recipes.filter(r => r.folder === folderName);
    const success = await deleteFolderBase(folderName, recipesInFolder.length);

    if (success) {
      // Move recipes to "All Recipes"
      for (const recipe of recipesInFolder) {
        await moveRecipeToFolder(recipe.id, 'All Recipes');
      }
    }
  };

  // Handle move to folder
  const handleMoveToFolder = (newFolder) => {
    if (selectedRecipe) {
      moveRecipeToFolder(selectedRecipe.id, newFolder);
      setShowMoveToFolder(false);
    }
  };

  // Android back button handler - handles all modals and screens
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Priority order for back button
      if (showIngredientSearch) {
        setShowIngredientSearch(false);
        return true;
      }
      if (showImport) {
        setShowImport(false);
        setImportText('');
        return true;
      }
      if (showGroceryList) {
        setShowGroceryList(false);
        return true;
      }
      if (showMoveToFolder) {
        setShowMoveToFolder(false);
        return true;
      }
      if (editingFolder) {
        setEditingFolder(null);
        setEditingFolderName('');
        return true;
      }
      if (showAddFolder) {
        setShowAddFolder(false);
        return true;
      }
      if (selectedRecipe) {
        setSelectedRecipe(null);
        return true;
      }
      if (showFolderManager) {
        setShowFolderManager(false);
        return true;
      }
      // Handle screen navigation - go back to dashboard
      if (currentScreen !== 'dashboard') {
        setCurrentScreen('dashboard');
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [selectedRecipe, showFolderManager, showAddFolder, showMoveToFolder, editingFolder, showGroceryList, showImport, showIngredientSearch, currentScreen]);

  const filteredRecipes = getFilteredRecipes(currentFolder);
  const nonDeletedRecipeCount = recipes.filter(r => !r.deletedAt).length;

  // Render different screens based on currentScreen state
  if (currentScreen === 'dashboard') {
    return (
      <>
        <DashboardScreen
          onNavigate={handleNavigation}
          recipeCount={nonDeletedRecipeCount}
          groceryCount={getUncheckedCount()}
        />
        {/* Modals that can open from dashboard */}
        <IngredientSearch
          visible={showIngredientSearch}
          onClose={() => setShowIngredientSearch(false)}
          recipes={recipes}
          onSelectRecipe={(recipe) => {
            setSelectedRecipe(recipe);
            setShowIngredientSearch(false);
            setCurrentScreen('recipes');
          }}
        />
        <GroceryList
          visible={showGroceryList}
          onClose={() => setShowGroceryList(false)}
          groceryList={groceryList}
          onToggleItem={handleToggleGroceryItem}
          onRemoveItem={handleRemoveGroceryItem}
          onClearChecked={handleClearCheckedItems}
          onClearAll={handleClearAllItems}
          showUndoButton={showUndoButton}
          canUndo={canUndo}
          lastActionDescription={lastActionDescription}
          performUndo={performUndo}
        />
        {/* Import Recipe Modal */}
        <Modal
          visible={showImport}
          animationType="fade"
          transparent
          onRequestClose={() => {
            setImportText('');
            setShowImport(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.importModal}>
              <Text style={styles.addFolderTitle}>Import Recipe or Cookbook</Text>

              {/* Cookbook Selector */}
              <View style={styles.importSection}>
                <Text style={styles.importSectionLabel}>Import to:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderChips}>
                  {folders.filter(f => f !== 'Favorites' && f !== 'Recently Deleted').map((folder) => (
                    <TouchableOpacity
                      key={folder}
                      style={[
                        styles.folderChip,
                        importTargetFolder === folder && styles.folderChipSelected
                      ]}
                      onPress={() => setImportTargetFolder(folder)}
                    >
                      <Text style={[
                        styles.folderChipText,
                        importTargetFolder === folder && styles.folderChipTextSelected
                      ]}>
                        {folder}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.importInstructions}>
                Paste code or URL below:
              </Text>
              <TextInput
                style={styles.importInput}
                placeholder="Paste URL or code here... (BUNCHES_RECIPE:... or BUNCHES_COOKBOOK:...)"
                value={importText}
                onChangeText={setImportText}
                multiline
                numberOfLines={6}
              />
              <View style={styles.addFolderButtons}>
                <TouchableOpacity
                  style={[styles.addFolderButton, styles.cancelButton]}
                  onPress={() => {
                    setImportText('');
                    setShowImport(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addFolderButton, styles.createButton]}
                  onPress={async () => {
                    if (importText.trim()) {
                      // Check if it's a URL or code
                      if (importText.trim().startsWith('http')) {
                        // It's a URL, use extraction
                        await extractRecipe(importText.trim(), false);
                        setImportText('');
                        setShowImport(false);
                      } else {
                        // It's a code, use import
                        await importRecipe(importText);
                        setImportText('');
                        setShowImport(false);
                      }
                    }
                  }}
                >
                  <Text style={styles.createButtonText}>Import</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  if (currentScreen === 'create') {
    return (
      <CreateRecipeScreen
        onSave={handleCreateRecipe}
        onClose={() => setCurrentScreen('dashboard')}
        folders={folders.filter(f => f !== 'Favorites' && f !== 'Recently Deleted')}
      />
    );
  }

  if (currentScreen === 'settings') {
    return (
      <SettingsScreen
        onClose={() => setCurrentScreen('dashboard')}
        onClearAllData={handleClearAllData}
        recipeCount={nonDeletedRecipeCount}
      />
    );
  }

  // Default: recipes screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen('dashboard')}>
          <Text style={styles.headerTitle}>Bunches</Text>
        </TouchableOpacity>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => setShowIngredientSearch(true)}
            style={styles.iconHeaderButton}
          >
            <Text style={styles.iconHeaderButtonText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowImport(true)}
            style={styles.iconHeaderButton}
          >
            <Text style={styles.iconHeaderButtonText}>📥</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowGroceryList(true)}
            style={styles.iconHeaderButton}
          >
            <Text style={styles.iconHeaderButtonText}>🛒</Text>
            {getUncheckedCount() > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{getUncheckedCount()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowFolderManager(true)}
            style={styles.iconHeaderButton}
          >
            <Text style={styles.iconHeaderButtonText}>📖</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recipe List */}
      {loadingRecipes ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading recipes...</Text>
        </View>
      ) : (
        <ScrollView style={styles.recipeList}>
          {filteredRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No recipes yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Share a recipe from your browser or paste a URL above
              </Text>
            </View>
          ) : (
            <>
              {multiselectMode && (
                <View style={styles.multiselectToolbar}>
                  <TouchableOpacity onPress={exitMultiselectMode} style={styles.toolbarButton}>
                    <Text style={styles.toolbarButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.toolbarTitle}>
                    {selectedRecipes.size} selected
                  </Text>
                  <TouchableOpacity
                    onPress={deleteSelectedRecipes}
                    style={[styles.toolbarButton, styles.deleteButton]}
                    disabled={selectedRecipes.size === 0}
                  >
                    <Text style={[styles.toolbarButtonText, styles.deleteButtonText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {filteredRecipes.map((recipe) => {
                const isSelected = selectedRecipes.has(recipe.id);
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[
                      styles.recipeCard,
                      isSelected && styles.recipeCardSelected
                    ]}
                    onPress={() => {
                      if (multiselectMode) {
                        toggleRecipeSelection(recipe.id);
                      } else {
                        setSelectedRecipe(recipe);
                      }
                    }}
                    onLongPress={() => {
                      if (!multiselectMode) {
                        enterMultiselectMode(recipe.id);
                      }
                    }}
                    delayLongPress={500}
                  >
                    {multiselectMode && (
                      <View style={styles.checkbox}>
                        {isSelected && (
                          <View style={styles.checkboxChecked}>
                            <Text style={styles.checkboxCheck}>✓</Text>
                          </View>
                        )}
                      </View>
                    )}
                    <View style={styles.recipeCardContent}>
                      <View style={styles.recipeCardHeader}>
                        <Text style={styles.recipeTitle}>{recipe.title}</Text>
                        {!multiselectMode && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleFavorite(recipe.id);
                            }}
                            style={styles.favoriteButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.favoriteIcon}>
                              {recipe.isFavorite ? '⭐' : '☆'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.recipeMeta} numberOfLines={1}>
                        {recipe.folder} • {recipe.ingredients ? Object.values(recipe.ingredients).flat().length : 0} ingredients
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {/* Folder Manager Modal */}
      <Modal
        visible={showFolderManager}
        animationType="slide"
        onRequestClose={() => setShowFolderManager(false)}
      >
        <View style={styles.modalContainer}>
          <StatusBar style="light" hidden={true} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFolderManager(false)}>
              <Text style={styles.modalCloseButton}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Cookbooks</Text>
            {currentFolder === 'Recently Deleted' ? (
              <TouchableOpacity onPress={emptyRecentlyDeleted}>
                <Text style={styles.addFolderHeaderButton}>Empty</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setShowAddFolder(true)}>
                <Text style={styles.addFolderHeaderButton}>+ New</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.folderSection}>
              <Text style={styles.folderSectionTitle}>System Cookbooks</Text>
              {folders.filter(f => f === 'All Recipes' || f === 'Favorites' || f === 'Recently Deleted').map((folder) => {
                let icon = '📚';
                let count = recipes.length;

                if (folder === 'Favorites') {
                  icon = '⭐';
                  count = recipes.filter(r => r.isFavorite && !r.deletedAt).length;
                } else if (folder === 'Recently Deleted') {
                  icon = '🗑️';
                  count = recipes.filter(r => r.deletedAt).length;
                } else {
                  // All Recipes
                  count = recipes.filter(r => !r.deletedAt).length;
                }

                return (
                  <TouchableOpacity
                    key={folder}
                    style={[
                      styles.folderManagerItem,
                      currentFolder === folder && styles.folderManagerItemActive
                    ]}
                    onPress={() => {
                      setCurrentFolder(folder);
                      setShowFolderManager(false);
                    }}
                    onLongPress={() => {
                      if (folder !== 'Recently Deleted') {
                        Alert.alert(
                          folder,
                          'Share this cookbook?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Share',
                              onPress: () => shareCookbook(folder)
                            }
                          ]
                        );
                      }
                    }}
                    delayLongPress={500}
                  >
                    <View style={styles.folderManagerItemLeft}>
                      <Text style={styles.folderManagerIcon}>{icon}</Text>
                      <Text style={[
                        styles.folderManagerItemText,
                        currentFolder === folder && styles.folderManagerItemTextActive
                      ]}>
                        {folder}
                      </Text>
                    </View>
                    <Text style={styles.folderManagerCount}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.folderSection}>
              <Text style={styles.folderSectionTitle}>My Cookbooks</Text>
              {getCustomFolders().length === 0 ? (
                <View style={styles.emptyFolders}>
                  <Text style={styles.emptyFoldersText}>No custom cookbooks yet</Text>
                  <Text style={styles.emptyFoldersSubtext}>Tap "+ New" to create one</Text>
                </View>
              ) : (
                getCustomFolders().map((folder) => {
                  // Count only non-deleted recipes in this folder
                  const recipeCount = recipes.filter(r =>
                    r.folder === folder && !r.deletedAt
                  ).length;

                  // Debug: log what we're finding
                  console.log(`Folder: ${folder}`);
                  console.log(`Total recipes in folder: ${recipes.filter(r => r.folder === folder).length}`);
                  console.log(`Non-deleted recipes: ${recipeCount}`);

                  return (
                    <TouchableOpacity
                      key={folder}
                      style={[
                        styles.folderManagerItem,
                        currentFolder === folder && styles.folderManagerItemActive
                      ]}
                      onPress={() => {
                        setCurrentFolder(folder);
                        setShowFolderManager(false);
                      }}
                      delayLongPress={300}
                      onLongPress={() => {
                        Alert.alert(
                          folder,
                          'Choose an action:',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Share',
                              onPress: () => shareCookbook(folder)
                            },
                            {
                              text: 'Rename',
                              onPress: () => {
                                setEditingFolder(folder);
                                setEditingFolderName(folder);
                              }
                            },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => deleteFolder(folder)
                            }
                          ]
                        );
                      }}
                    >
                      <View style={styles.folderManagerItemLeft}>
                        <Text style={styles.folderManagerIcon}>📖</Text>
                        <Text style={[
                          styles.folderManagerItemText,
                          currentFolder === folder && styles.folderManagerItemTextActive
                        ]}>
                          {folder}
                        </Text>
                      </View>
                      <Text style={styles.folderManagerCount}>
                        {recipeCount}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <Modal
          visible={!!selectedRecipe}
          animationType="slide"
          onRequestClose={() => setSelectedRecipe(null)}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <StatusBar style="light" hidden={true} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
                <Text style={styles.modalCloseButton}>✕ Close</Text>
              </TouchableOpacity>
              {selectedRecipe.deletedAt ? (
                // Actions for deleted recipes
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={async () => {
                      await restoreRecipe(selectedRecipe.id);
                      setSelectedRecipe(null);
                    }}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>♻️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      await permanentlyDeleteRecipe(selectedRecipe.id);
                    }}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>⚠️</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Normal actions for active recipes
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={() => toggleFavorite(selectedRecipe.id)}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>
                      {selectedRecipe.isFavorite ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => shareRecipe(selectedRecipe)}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>📤</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const customFolders = getCustomFolders();
                      if (customFolders.length === 0) {
                        Alert.alert('No Cookbooks', 'Create a custom cookbook first!', [
                          { text: 'OK' },
                          {
                            text: 'Create Cookbook',
                            onPress: () => {
                              setSelectedRecipe(null);
                              setShowFolderManager(true);
                              setTimeout(() => setShowAddFolder(true), 300);
                            }
                          }
                        ]);
                      } else {
                        setShowMoveToFolder(true);
                      }
                    }}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>📖</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteRecipe(selectedRecipe.id)}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView style={styles.modalContent}>
              {selectedRecipe.deletedAt && (
                <View style={styles.deletedBanner}>
                  <Text style={styles.deletedBannerText}>
                    🗑️ Deleted on {new Date(selectedRecipe.deletedAt).toLocaleDateString()}
                  </Text>
                  <Text style={styles.deletedBannerSubtext}>
                    Tap ♻️ to restore or ⚠️ to delete permanently
                  </Text>
                </View>
              )}
              <RecipeDetail
                recipe={selectedRecipe}
                onUpdate={selectedRecipe.deletedAt ? null : updateRecipe}
                onAddToGroceryList={selectedRecipe.deletedAt ? null : handleAddToGroceryList}
                addUndoAction={addUndoAction}
              />
              <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Undo Button inside Modal */}
            {showUndoButton && canUndo && (
              <TouchableOpacity
                style={styles.globalUndoButton}
                onPress={performUndo}
                activeOpacity={0.8}
              >
                <Text style={styles.globalUndoText}>↶ Undo: {lastActionDescription}</Text>
              </TouchableOpacity>
            )}
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Ingredient Search Modal */}
      <IngredientSearch
        visible={showIngredientSearch}
        onClose={() => setShowIngredientSearch(false)}
        recipes={recipes}
        onSelectRecipe={(recipe) => setSelectedRecipe(recipe)}
      />

      {/* Grocery List Modal */}
      <GroceryList
        visible={showGroceryList}
        onClose={() => setShowGroceryList(false)}
        groceryList={groceryList}
        onToggleItem={handleToggleGroceryItem}
        onRemoveItem={handleRemoveGroceryItem}
        onClearChecked={handleClearCheckedItems}
        onClearAll={handleClearAllItems}
        showUndoButton={showUndoButton}
        canUndo={canUndo}
        lastActionDescription={lastActionDescription}
        performUndo={performUndo}
      />

      {/* Add Folder Modal */}
      <Modal
        visible={showAddFolder}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setNewFolderName('');
          setShowAddFolder(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addFolderModal}>
            <Text style={styles.addFolderTitle}>New Cookbook</Text>
            <TextInput
              style={styles.addFolderInput}
              placeholder="Cookbook name"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.addFolderButtons}>
              <TouchableOpacity
                style={[styles.addFolderButton, styles.cancelButton]}
                onPress={() => {
                  setNewFolderName('');
                  setShowAddFolder(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addFolderButton, styles.createButton]}
                onPress={addFolder}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Move to Folder Modal */}
      {showMoveToFolder && selectedRecipe && (
        <Modal
          visible={showMoveToFolder}
          animationType="fade"
          transparent
          onRequestClose={() => setShowMoveToFolder(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.addFolderModal}>
              <Text style={styles.addFolderTitle}>Move to Cookbook</Text>
              {getCustomFolders().map(folder => (
                <TouchableOpacity
                  key={folder}
                  style={styles.folderItem}
                  onPress={() => handleMoveToFolder(folder)}
                >
                  <Text style={styles.folderItemText}>{folder}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.addFolderButton, styles.cancelButton]}
                onPress={() => setShowMoveToFolder(false)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Rename Folder Modal */}
      {editingFolder && (
        <Modal
          visible={!!editingFolder}
          animationType="fade"
          transparent
          onRequestClose={() => {
            setEditingFolder(null);
            setEditingFolderName('');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.addFolderModal}>
              <Text style={styles.addFolderTitle}>Rename Cookbook</Text>
              <TextInput
                style={styles.addFolderInput}
                value={editingFolderName}
                onChangeText={setEditingFolderName}
                autoFocus
              />
              <View style={styles.addFolderButtons}>
                <TouchableOpacity
                  style={[styles.addFolderButton, styles.cancelButton]}
                  onPress={() => {
                    setEditingFolder(null);
                    setEditingFolderName('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addFolderButton, styles.createButton]}
                  onPress={renameFolder}
                >
                  <Text style={styles.createButtonText}>Rename</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Import Recipe Modal */}
      <Modal
        visible={showImport}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setImportText('');
          setShowImport(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.importModal}>
            <Text style={styles.addFolderTitle}>Import Recipe or Cookbook</Text>

            {/* Cookbook Selector */}
            <View style={styles.importSection}>
              <Text style={styles.importSectionLabel}>Import to:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderChips}>
                {folders.filter(f => f !== 'Favorites' && f !== 'Recently Deleted').map((folder) => (
                  <TouchableOpacity
                    key={folder}
                    style={[
                      styles.folderChip,
                      importTargetFolder === folder && styles.folderChipSelected
                    ]}
                    onPress={() => setImportTargetFolder(folder)}
                  >
                    <Text style={[
                      styles.folderChipText,
                      importTargetFolder === folder && styles.folderChipTextSelected
                    ]}>
                      {folder}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.importInstructions}>
              Paste code or URL below:
            </Text>
            <TextInput
              style={styles.importInput}
              placeholder="Paste URL or code here... (BUNCHES_RECIPE:... or BUNCHES_COOKBOOK:...)"
              value={importText}
              onChangeText={setImportText}
              multiline
              numberOfLines={6}
            />
            <View style={styles.addFolderButtons}>
              <TouchableOpacity
                style={[styles.addFolderButton, styles.cancelButton]}
                onPress={() => {
                  setImportText('');
                  setShowImport(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addFolderButton, styles.createButton]}
                onPress={async () => {
                  if (importText.trim()) {
                    // Check if it's a URL or code
                    if (importText.trim().startsWith('http')) {
                      // It's a URL, use extraction
                      await extractRecipe(importText.trim(), false);
                      setImportText('');
                      setShowImport(false);
                    } else {
                      // It's a code, use import
                      await importRecipe(importText);
                      setImportText('');
                      setShowImport(false);
                    }
                  }
                }}
              >
                <Text style={styles.createButtonText}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Undo Button - Only show when no modals are open */}
      {showUndoButton && canUndo && !selectedRecipe && !showGroceryList && !showAddFolder && !showMoveToFolder && !showRenameFolder && (
        <TouchableOpacity
          style={styles.globalUndoButton}
          onPress={performUndo}
          activeOpacity={0.8}
        >
          <Text style={styles.globalUndoText}>↶ Undo: {lastActionDescription}</Text>
        </TouchableOpacity>
      )}
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconHeaderButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconHeaderButtonText: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  extractButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 80,
  },
  extractButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  recipeList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  favoriteButton: {
    padding: 6,
    marginLeft: 4,
    marginRight: -6,
  },
  favoriteIcon: {
    fontSize: 20,
  },
  recipeMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
  },
  multiselectToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  toolbarButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  toolbarButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  toolbarTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: colors.error,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
  },
  recipeCardSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  recipeCardContent: {
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryDark,
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addFolderHeaderButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
  },
  iconButtonText: {
    fontSize: 22,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  bottomSpacer: {
    height: 120,
  },
  folderSection: {
    marginBottom: 25,
  },
  folderSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  folderManagerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: colors.lightGray,
  },
  folderManagerItemActive: {
    backgroundColor: colors.primaryLight,
  },
  folderManagerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderManagerIcon: {
    fontSize: 18,
  },
  folderManagerItemText: {
    fontSize: 15,
    color: colors.text,
  },
  folderManagerItemTextActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  folderManagerCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyFolders: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyFoldersText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  emptyFoldersSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFolderModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  addFolderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: colors.text,
  },
  addFolderInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 15,
  },
  addFolderButtons: {
    flexDirection: 'row',
  },
  addFolderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.lightGray,
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  folderItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  folderItemText: {
    fontSize: 15,
    color: colors.text,
  },
  globalUndoButton: {
    position: 'absolute',
    top: 60,
    left: 15,
    right: 15,
    backgroundColor: colors.warning,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    zIndex: 99999,
    elevation: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalUndoText: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '700',
  },
  deletedBanner: {
    backgroundColor: colors.error,
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deletedBannerText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  deletedBannerSubtext: {
    color: colors.white,
    fontSize: 13,
    opacity: 0.9,
  },
  importModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 500,
  },
  importInstructions: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
    fontWeight: '600',
  },
  importInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    marginBottom: 15,
    minHeight: 150,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  importSection: {
    marginBottom: 16,
  },
  importSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  folderChips: {
    flexDirection: 'row',
    maxHeight: 40,
  },
  folderChip: {
    backgroundColor: colors.lightGray,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
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
});

export default HomeScreen;
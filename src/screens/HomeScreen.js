/**
 * HomeScreen.js - Main Application Screen
 * BunchesV6 - Recipe Manager with Grocery List
 * 
 * FIXED: Multi-delete now only shows ONE confirmation dialog
 * FIXED: Ingredient selection is now multi-select with confirm
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Hooks
import { useRecipes } from '../hooks/useRecipes';
import { useFolders } from '../hooks/useFolders';
import { useShareIntent } from '../hooks/useShareIntent';
import { useRecipeExtraction } from '../hooks/useRecipeExtraction';
import { useGroceryList } from '../hooks/useGroceryList';

// Components
import RecipeDetail from '../components/RecipeDetail';
import GroceryListView from '../components/GroceryListView';

// Constants
import colors from '../constants/colors';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  // Navigation state
  const [currentView, setCurrentView] = useState('recipes'); // 'recipes', 'grocery'

  // Local state
  const [url, setUrl] = useState('');
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState(new Set());

  // Ingredient selection state
  const [selectedIngredients, setSelectedIngredients] = useState(new Set());

  // Hooks
  const {
    recipes,
    loadingRecipes,
    selectedRecipe,
    setSelectedRecipe,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
    bulkDeleteRecipes, // Use the new bulk delete function
    toggleFavorite,
    moveToFolder: moveRecipeToFolder,
    getFilteredRecipes,
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

  const { loading, extractRecipe } = useRecipeExtraction(async (recipe, shouldSave) => {
    console.log('💾 Saving recipe:', recipe.title);
    const saved = await saveRecipe(recipe);
    if (saved) {
      console.log('✅ Recipe saved successfully');
      setSelectedRecipe(recipe);
      setCurrentView('recipes');
    } else {
      console.error('❌ Failed to save recipe');
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    }
  });

  // Grocery list hook
  const {
    groceryItems,
    addGroceryItems,
    toggleGroceryItem,
    deleteGroceryItem,
    clearCheckedItems,
    clearAllItems,
  } = useGroceryList();

  // Use share intent hook
  useShareIntent(extractRecipe);

  // Handle Android back button
  useEffect(() => {
    const backAction = () => {
      // If selecting ingredients, clear selection
      if (selectedRecipe?.groceryMode) {
        if (selectedIngredients.size > 0) {
          setSelectedIngredients(new Set());
          return true;
        }
        setSelectedRecipe(null);
        setSelectedIngredients(new Set());
        return true;
      }

      // If in multi-select mode, exit it
      if (isMultiSelectMode) {
        setIsMultiSelectMode(false);
        setSelectedRecipeIds(new Set());
        return true;
      }

      // If a recipe is open, close it
      if (selectedRecipe) {
        setSelectedRecipe(null);
        return true;
      }

      // If any modal is open, close it
      if (showFolderManager || showAddFolder || showMoveToFolder || editingFolder) {
        setShowFolderManager(false);
        setShowAddFolder(false);
        setShowMoveToFolder(false);
        setEditingFolder(null);
        return true;
      }

      // If in grocery list view, go back to recipes
      if (currentView === 'grocery') {
        setCurrentView('recipes');
        return true;
      }

      // Otherwise, let default behavior happen (exit app)
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [selectedRecipe, showFolderManager, showAddFolder, showMoveToFolder, editingFolder, currentView, isMultiSelectMode, selectedIngredients]);

  // Toggle recipe selection
  const toggleRecipeSelection = (recipeId) => {
    const newSelection = new Set(selectedRecipeIds);
    if (newSelection.has(recipeId)) {
      newSelection.delete(recipeId);
    } else {
      newSelection.add(recipeId);
    }
    setSelectedRecipeIds(newSelection);

    // Exit multi-select if no recipes selected
    if (newSelection.size === 0) {
      setIsMultiSelectMode(false);
    }
  };

  // Delete selected recipes (FIXED - single confirmation)
  const deleteSelectedRecipes = async () => {
    const count = selectedRecipeIds.size;
    const recipeIdsToDelete = Array.from(selectedRecipeIds);

    Alert.alert(
      'Delete Recipes',
      `Are you sure you want to delete ${count} recipe${count > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Use bulk delete from hook to avoid individual confirmations
            const deletedCount = await bulkDeleteRecipes(recipeIdsToDelete);

            // Clear selection and exit multi-select mode
            setIsMultiSelectMode(false);
            setSelectedRecipeIds(new Set());

            // Show result
            if (deletedCount > 0) {
              Alert.alert('Success', `Deleted ${deletedCount} recipe${deletedCount > 1 ? 's' : ''}`);
            } else {
              Alert.alert('Error', 'Failed to delete recipes');
            }
          },
        },
      ]
    );
  };

  // Toggle ingredient selection
  const toggleIngredientSelection = (ingredientKey) => {
    const newSelection = new Set(selectedIngredients);
    if (newSelection.has(ingredientKey)) {
      newSelection.delete(ingredientKey);
    } else {
      newSelection.add(ingredientKey);
    }
    setSelectedIngredients(newSelection);
  };

  // Add selected ingredients to grocery list
  const addSelectedIngredientsToList = () => {
    if (selectedIngredients.size === 0) {
      Alert.alert('No Selection', 'Please select at least one ingredient');
      return;
    }

    const itemsToAdd = [];
    selectedIngredients.forEach(key => {
      const [section, index] = key.split('-');
      const ingredient = selectedRecipe.ingredients[section][parseInt(index)];
      itemsToAdd.push({
        text: ingredient,
        recipeTitle: selectedRecipe.title,
        section: section === 'main' ? '' : section,
      });
    });

    addGroceryItems(itemsToAdd);
    Alert.alert(
      'Added to List',
      `${itemsToAdd.length} item${itemsToAdd.length > 1 ? 's' : ''} added to grocery list`
    );

    // Clear selection and close
    setSelectedIngredients(new Set());
    setSelectedRecipe(null);
  };

  // Add recipe to grocery list
  const addRecipeToGroceryList = (recipe) => {
    Alert.alert(
      'Add to Grocery List',
      'Choose what to add:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'All Ingredients',
          onPress: () => {
            const items = [];
            Object.keys(recipe.ingredients).forEach(section => {
              recipe.ingredients[section].forEach(ingredient => {
                items.push({
                  text: ingredient,
                  recipeTitle: recipe.title,
                  section: section === 'main' ? '' : section,
                });
              });
            });
            addGroceryItems(items);
            Alert.alert('Success', `Added ${items.length} items to grocery list`);
          },
        },
        {
          text: 'Select Ingredients',
          onPress: () => {
            // Navigate to recipe detail with grocery mode
            setSelectedRecipe({ ...recipe, groceryMode: true });
            setSelectedIngredients(new Set());
          },
        },
      ]
    );
  };

  // Folder management functions
  const addFolder = async () => {
    if (newFolderName.trim()) {
      const success = await addFolderBase(newFolderName.trim());
      if (success) {
        setNewFolderName('');
        setShowAddFolder(false);
      }
    }
  };

  const renameFolder = async () => {
    if (editingFolderName.trim() && editingFolder) {
      const success = await renameFolderBase(editingFolder, editingFolderName.trim());
      if (success) {
        setEditingFolder(null);
        setEditingFolderName('');
      }
    }
  };

  const deleteFolder = async (folderName) => {
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete "${folderName}"? Recipes will be moved to "All Recipes".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteFolderBase(folderName);
            if (success && currentFolder === folderName) {
              setCurrentFolder('All Recipes');
            }
          },
        },
      ]
    );
  };

  const filteredRecipes = getFilteredRecipes(currentFolder);

  // Render navigation tabs
  const renderNavigationTabs = () => (
    <View style={styles.navigationTabs}>
      <TouchableOpacity
        style={[styles.navTab, currentView === 'recipes' && styles.navTabActive]}
        onPress={() => setCurrentView('recipes')}
      >
        <Text style={[styles.navTabText, currentView === 'recipes' && styles.navTabTextActive]}>
          📖 Recipes
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.navTab, currentView === 'grocery' && styles.navTabActive]}
        onPress={() => setCurrentView('grocery')}
      >
        <Text style={[styles.navTabText, currentView === 'grocery' && styles.navTabTextActive]}>
          🛒 Grocery List ({groceryItems.filter(item => !item.checked).length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render recipe item with selection support
  const renderRecipeItem = (recipe) => (
    <TouchableOpacity
      key={recipe.id}
      style={[
        styles.recipeCard,
        selectedRecipeIds.has(recipe.id) && styles.recipeCardSelected,
      ]}
      onPress={() => {
        if (isMultiSelectMode) {
          toggleRecipeSelection(recipe.id);
        } else {
          setSelectedRecipe(recipe);
        }
      }}
      onLongPress={() => {
        if (!isMultiSelectMode) {
          setIsMultiSelectMode(true);
          setSelectedRecipeIds(new Set([recipe.id]));
        }
      }}
    >
      <View style={styles.recipeCardContent}>
        {isMultiSelectMode && (
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, selectedRecipeIds.has(recipe.id) && styles.checkboxChecked]}>
              {selectedRecipeIds.has(recipe.id) && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
        )}
        <View style={styles.recipeInfo}>
          <View style={styles.recipeCardHeader}>
            <Text style={styles.recipeTitle} numberOfLines={2}>{recipe.title}</Text>
            <View style={styles.recipeActions}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  addRecipeToGroceryList(recipe);
                }}
                style={styles.addToListButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.addToListIcon}>🛒</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  toggleFavorite(recipe.id);
                }}
                style={styles.favoriteButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.favoriteIcon}>
                  {recipe.isFavorite ? '❤️' : '🤍'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {recipe.notes && (
            <Text style={styles.recipeNotes} numberOfLines={2}>
              {recipe.notes}
            </Text>
          )}
          <View style={styles.recipeMetadata}>
            <Text style={styles.recipeFolder}>📁 {recipe.folder || 'All Recipes'}</Text>
            {recipe.sourceUrl && (
              <Text style={styles.recipeSource} numberOfLines={1}>
                🔗 {recipe.sourceUrl.replace(/^https?:\/\//, '').split('/')[0]}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Main render
  if (selectedRecipe && !selectedRecipe.groceryMode) {
    return (
      <RecipeDetail
        recipe={selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onUpdate={updateRecipe}
        onDelete={() => {
          deleteRecipe(selectedRecipe.id);
          setSelectedRecipe(null);
        }}
        onMoveToFolder={() => {
          setShowMoveToFolder(true);
        }}
      />
    );
  }

  // Recipe detail in grocery mode (multi-select ingredients)
  if (selectedRecipe?.groceryMode) {
    const totalIngredients = Object.values(selectedRecipe.ingredients).flat().length;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              setSelectedRecipe(null);
              setSelectedIngredients(new Set());
            }}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Ingredients</Text>
          <TouchableOpacity
            onPress={addSelectedIngredientsToList}
            style={styles.confirmButton}
            disabled={selectedIngredients.size === 0}
          >
            <Text style={[
              styles.confirmButtonText,
              selectedIngredients.size === 0 && styles.confirmButtonTextDisabled
            ]}>
              Add ({selectedIngredients.size})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.recipeHeaderInGrocery}>
            <Text style={styles.recipeTitleInGrocery}>{selectedRecipe.title}</Text>
            <View style={styles.selectionActions}>
              <TouchableOpacity
                onPress={() => {
                  // Select all
                  const allKeys = new Set();
                  Object.entries(selectedRecipe.ingredients).forEach(([section, items]) => {
                    items.forEach((_, index) => {
                      allKeys.add(`${section}-${index}`);
                    });
                  });
                  setSelectedIngredients(allKeys);
                }}
                style={styles.selectAllButton}
              >
                <Text style={styles.selectAllText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedIngredients(new Set())}
                style={styles.clearButton}
              >
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {Object.entries(selectedRecipe.ingredients).map(([section, items]) => (
            <View key={section} style={styles.ingredientSection}>
              {section !== 'main' && (
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeader}>{section}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      // Toggle section
                      const sectionKeys = items.map((_, index) => `${section}-${index}`);
                      const allSelected = sectionKeys.every(key => selectedIngredients.has(key));

                      const newSelection = new Set(selectedIngredients);
                      if (allSelected) {
                        sectionKeys.forEach(key => newSelection.delete(key));
                      } else {
                        sectionKeys.forEach(key => newSelection.add(key));
                      }
                      setSelectedIngredients(newSelection);
                    }}
                    style={styles.sectionToggle}
                  >
                    <Text style={styles.sectionToggleText}>
                      {items.every((_, index) => selectedIngredients.has(`${section}-${index}`))
                        ? 'Deselect All'
                        : 'Select All'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {items.map((ingredient, index) => {
                const key = `${section}-${index}`;
                const isSelected = selectedIngredients.has(key);

                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.selectableIngredient,
                      isSelected && styles.selectedIngredient
                    ]}
                    onPress={() => toggleIngredientSelection(key)}
                  >
                    <View style={[styles.ingredientCheckbox, isSelected && styles.ingredientCheckboxChecked]}>
                      {isSelected && <Text style={styles.ingredientCheckmark}>✓</Text>}
                    </View>
                    <Text style={[
                      styles.selectableIngredientText,
                      isSelected && styles.selectedIngredientText
                    ]}>
                      {ingredient}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Floating action button */}
        {selectedIngredients.size > 0 && (
          <TouchableOpacity
            style={styles.floatingActionButton}
            onPress={addSelectedIngredientsToList}
          >
            <Text style={styles.floatingActionText}>
              Add {selectedIngredients.size} item{selectedIngredients.size !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  // Grocery list view
  if (currentView === 'grocery') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BunchesV6</Text>
          <TouchableOpacity
            onPress={() => setShowFolderManager(true)}
            style={styles.folderButton}
          >
            <Text style={styles.folderButtonText}>📁 {currentFolder}</Text>
          </TouchableOpacity>
        </View>

        {renderNavigationTabs()}

        <GroceryListView
          items={groceryItems}
          onToggleItem={toggleGroceryItem}
          onDeleteItem={deleteGroceryItem}
          onClearChecked={clearCheckedItems}
          onClearAll={clearAllItems}
        />
      </SafeAreaView>
    );
  }

  // Main recipes view
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BunchesV6</Text>
        {isMultiSelectMode ? (
          <View style={styles.multiSelectActions}>
            <Text style={styles.selectionCount}>
              {selectedRecipeIds.size} selected
            </Text>
            <TouchableOpacity
              onPress={deleteSelectedRecipes}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setIsMultiSelectMode(false);
                setSelectedRecipeIds(new Set());
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowFolderManager(true)}
            style={styles.folderButton}
          >
            <Text style={styles.folderButtonText}>📁 {currentFolder}</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderNavigationTabs()}

      {/* URL Input */}
      {!isMultiSelectMode && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Paste recipe URL..."
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={() => extractRecipe(url, false)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            onPress={() => extractRecipe(url, false)}
            style={styles.extractButton}
            disabled={loading || !url}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.extractButtonText}>Extract</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

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
              {isMultiSelectMode && (
                <Text style={styles.multiSelectHint}>
                  Tap recipes to select, long press to exit selection mode
                </Text>
              )}
              {filteredRecipes.map(renderRecipeItem)}
            </>
          )}
        </ScrollView>
      )}

      {/* Folder Manager Modal */}
      <Modal visible={showFolderManager} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Folders</Text>
              <TouchableOpacity onPress={() => setShowFolderManager(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.folderList}>
              {folders.map((folder) => (
                <TouchableOpacity
                  key={folder}
                  style={[
                    styles.folderItem,
                    folder === currentFolder && styles.folderItemActive,
                  ]}
                  onPress={() => {
                    setCurrentFolder(folder);
                    setShowFolderManager(false);
                  }}
                >
                  <Text
                    style={[
                      styles.folderName,
                      folder === currentFolder && styles.folderNameActive,
                    ]}
                  >
                    {folder}
                  </Text>
                  {folder !== 'All Recipes' && folder !== 'Favorites' && (
                    <View style={styles.folderActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingFolder(folder);
                          setEditingFolderName(folder);
                        }}
                        style={styles.folderActionButton}
                      >
                        <Text style={styles.folderActionText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteFolder(folder)}
                        style={styles.folderActionButton}
                      >
                        <Text style={styles.folderActionText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowAddFolder(true)}
              style={styles.addFolderButton}
            >
              <Text style={styles.addFolderButtonText}>+ Add Folder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Folder Modal */}
      <Modal visible={showAddFolder} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalContent}>
            <Text style={styles.modalTitle}>New Folder</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Folder name..."
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddFolder(false);
                  setNewFolderName('');
                }}
                style={styles.modalButtonCancel}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addFolder} style={styles.modalButtonConfirm}>
                <Text style={styles.modalButtonTextWhite}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Folder Modal */}
      <Modal visible={!!editingFolder} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.smallModalContent}>
            <Text style={styles.modalTitle}>Rename Folder</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="New name..."
              value={editingFolderName}
              onChangeText={setEditingFolderName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setEditingFolder(null);
                  setEditingFolderName('');
                }}
                style={styles.modalButtonCancel}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={renameFolder} style={styles.modalButtonConfirm}>
                <Text style={styles.modalButtonTextWhite}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Move to Folder Modal */}
      <Modal visible={showMoveToFolder} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Move to Folder</Text>
              <TouchableOpacity onPress={() => setShowMoveToFolder(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.folderList}>
              {folders.filter(f => f !== 'Favorites').map((folder) => (
                <TouchableOpacity
                  key={folder}
                  style={[
                    styles.folderItem,
                    folder === selectedRecipe?.folder && styles.folderItemActive,
                  ]}
                  onPress={async () => {
                    if (selectedRecipe) {
                      await moveRecipeToFolder(selectedRecipe.id, folder);
                      setShowMoveToFolder(false);
                      setSelectedRecipe(null);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.folderName,
                      folder === selectedRecipe?.folder && styles.folderNameActive,
                    ]}
                  >
                    {folder}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  folderButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  folderButtonText: {
    color: colors.white,
    fontSize: 14,
  },
  navigationTabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navTabActive: {
    borderBottomColor: colors.primary,
  },
  navTabText: {
    fontSize: 14,
    color: colors.text,
  },
  navTabTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
  },
  extractButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  extractButtonText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.text,
  },
  recipeList: {
    flex: 1,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  multiSelectHint: {
    padding: 10,
    textAlign: 'center',
    color: colors.text,
    fontSize: 12,
    backgroundColor: colors.lightPrimary,
  },
  recipeCard: {
    backgroundColor: colors.white,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeCardSelected: {
    backgroundColor: colors.lightPrimary,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  recipeCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: 12,
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontWeight: 'bold',
  },
  recipeInfo: {
    flex: 1,
  },
  recipeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  recipeTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginRight: 8,
  },
  recipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addToListButton: {
    marginRight: 8,
  },
  addToListIcon: {
    fontSize: 18,
  },
  favoriteButton: {},
  favoriteIcon: {
    fontSize: 18,
  },
  recipeNotes: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  recipeMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeFolder: {
    fontSize: 12,
    color: '#999',
  },
  recipeSource: {
    fontSize: 12,
    color: '#999',
    flex: 1,
    marginLeft: 8,
    textAlign: 'right',
  },
  multiSelectActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCount: {
    color: colors.white,
    marginRight: 12,
  },
  deleteButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  deleteButtonText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  cancelButtonText: {
    color: colors.white,
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
  },
  confirmButton: {
    padding: 5,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButtonTextDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    backgroundColor: colors.white,
  },
  recipeHeaderInGrocery: {
    padding: 15,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recipeTitleInGrocery: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  selectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  selectAllText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
  },
  clearText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  ingredientSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: colors.lightPrimary,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  sectionToggle: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  sectionToggleText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  selectableIngredient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedIngredient: {
    backgroundColor: colors.lightPrimary,
  },
  ingredientCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingredientCheckboxChecked: {
    backgroundColor: colors.primary,
  },
  ingredientCheckmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectableIngredientText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  selectedIngredientText: {
    fontWeight: '500',
  },
  floatingActionButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    left: 20,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingActionText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 12,
    width: '90%',
    maxHeight: '70%',
    padding: 20,
  },
  smallModalContent: {
    backgroundColor: colors.white,
    borderRadius: 12,
    width: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    fontSize: 24,
    color: colors.text,
  },
  folderList: {
    maxHeight: 300,
  },
  folderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  folderItemActive: {
    backgroundColor: colors.lightPrimary,
  },
  folderName: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  folderNameActive: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  folderActions: {
    flexDirection: 'row',
  },
  folderActionButton: {
    marginLeft: 15,
  },
  folderActionText: {
    fontSize: 18,
  },
  addFolderButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  addFolderButtonText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButtonCancel: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  modalButtonConfirm: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  modalButtonText: {
    color: colors.text,
  },
  modalButtonTextWhite: {
    color: colors.white,
    fontWeight: 'bold',
  },
});
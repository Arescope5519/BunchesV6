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
import { GroceryList } from '../components/GroceryList';

// Constants
import colors from '../constants/colors';

export const HomeScreen = () => {
  // Local state
  const [url, setUrl] = useState('');
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [showGroceryList, setShowGroceryList] = useState(false);

  // Hooks
  const {
    recipes,
    loadingRecipes,
    selectedRecipe,
    setSelectedRecipe,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
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

  const {
    groceryList,
    loading: groceryListLoading,
    addItems: addItemsToGroceryList,
    removeItem: removeGroceryItem,
    toggleItemChecked,
    clearCheckedItems,
    clearAllItems,
    getUncheckedCount,
    undoLastChange: undoGroceryListChange,
    showUndoButton: showGroceryListUndo,
    canUndo: canUndoGroceryList,
  } = useGroceryList();

  const { loading, extractRecipe } = useRecipeExtraction(async (recipe, shouldSave) => {
    // Always save recipes from extraction
    console.log('💾 Saving recipe:', recipe.title);
    const saved = await saveRecipe(recipe);
    if (saved) {
      console.log('✅ Recipe saved successfully');
      setSelectedRecipe(recipe);
    } else {
      console.error('❌ Failed to save recipe');
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    }
    setUrl('');
  });

  // Share intent handler
  useShareIntent((sharedUrl) => {
    setUrl(sharedUrl);
    // Auto-extract recipe when shared from browser
    setTimeout(() => extractRecipe(sharedUrl, true), 500);
  });

  // Grocery list handler
  const handleAddToGroceryList = async (selectedItems) => {
    if (!selectedRecipe || selectedItems.length === 0) return;

    // Add all selected items to grocery list
    const ingredientTexts = selectedItems.map(item => item.text);
    await addItemsToGroceryList(ingredientTexts, selectedRecipe, selectedItems[0]?.section || 'main');
  };

  // Folder operations with recipe updates
  const addFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
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
      return false;
    });

    return () => backHandler.remove();
  }, [selectedRecipe, showFolderManager, showAddFolder, showMoveToFolder, editingFolder, showGroceryList]);

  const filteredRecipes = getFilteredRecipes(currentFolder);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BunchesV6</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => setShowGroceryList(true)}
            style={styles.groceryListHeaderButton}
          >
            <Text style={styles.groceryListHeaderButtonText}>
              🛒 {getUncheckedCount() > 0 ? `(${getUncheckedCount()})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowFolderManager(true)}
            style={styles.folderButton}
          >
            <Text style={styles.folderButtonText}>📁 {currentFolder}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* URL Input */}
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
            filteredRecipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => setSelectedRecipe(recipe)}
              >
                <View style={styles.recipeCardHeader}>
                  <Text style={styles.recipeTitle}>{recipe.title}</Text>
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
                </View>
                <Text style={styles.recipeMeta} numberOfLines={1}>
                  {recipe.folder} • {recipe.ingredients ? Object.values(recipe.ingredients).flat().length : 0} ingredients
                </Text>
              </TouchableOpacity>
            ))
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
            <Text style={styles.modalHeaderTitle}>Folders</Text>
            <TouchableOpacity onPress={() => setShowAddFolder(true)}>
              <Text style={styles.addFolderHeaderButton}>+ New</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.folderSection}>
              <Text style={styles.folderSectionTitle}>System Folders</Text>
              {folders.filter(f => f === 'All Recipes' || f === 'Favorites').map((folder) => (
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
                >
                  <View style={styles.folderManagerItemLeft}>
                    <Text style={styles.folderManagerIcon}>
                      {folder === 'Favorites' ? '⭐' : '📚'}
                    </Text>
                    <Text style={[
                      styles.folderManagerItemText,
                      currentFolder === folder && styles.folderManagerItemTextActive
                    ]}>
                      {folder}
                    </Text>
                  </View>
                  <Text style={styles.folderManagerCount}>
                    {folder === 'Favorites'
                      ? recipes.filter(r => r.isFavorite).length
                      : recipes.length}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.folderSection}>
              <Text style={styles.folderSectionTitle}>My Folders</Text>
              {getCustomFolders().length === 0 ? (
                <View style={styles.emptyFolders}>
                  <Text style={styles.emptyFoldersText}>No custom folders yet</Text>
                  <Text style={styles.emptyFoldersSubtext}>Tap "+ New" to create one</Text>
                </View>
              ) : (
                getCustomFolders().map((folder) => (
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
                      <Text style={styles.folderManagerIcon}>📁</Text>
                      <Text style={[
                        styles.folderManagerItemText,
                        currentFolder === folder && styles.folderManagerItemTextActive
                      ]}>
                        {folder}
                      </Text>
                    </View>
                    <Text style={styles.folderManagerCount}>
                      {recipes.filter(r => r.folder === folder).length}
                    </Text>
                  </TouchableOpacity>
                ))
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
                  onPress={() => {
                    const customFolders = getCustomFolders();
                    if (customFolders.length === 0) {
                      Alert.alert('No Folders', 'Create a custom folder first!', [
                        { text: 'OK' },
                        {
                          text: 'Create Folder',
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
                  <Text style={styles.iconButtonText}>📁</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteRecipe(selectedRecipe.id)}
                  style={styles.iconButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.iconButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.modalContent}>
              <RecipeDetail
                recipe={selectedRecipe}
                onUpdate={updateRecipe}
                onAddToGroceryList={handleAddToGroceryList}
              />
              <View style={styles.bottomSpacer} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Grocery List Modal */}
      <GroceryList
        visible={showGroceryList}
        onClose={() => setShowGroceryList(false)}
        groceryList={groceryList}
        onToggleItem={toggleItemChecked}
        onRemoveItem={removeGroceryItem}
        onClearChecked={clearCheckedItems}
        onClearAll={clearAllItems}
        onUndo={undoGroceryListChange}
        showUndoButton={showGroceryListUndo}
        canUndo={canUndoGroceryList}
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
            <Text style={styles.addFolderTitle}>New Folder</Text>
            <TextInput
              style={styles.addFolderInput}
              placeholder="Folder name"
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
              <Text style={styles.addFolderTitle}>Move to Folder</Text>
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
              <Text style={styles.addFolderTitle}>Rename Folder</Text>
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
    gap: 8,
  },
  groceryListHeaderButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  groceryListHeaderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  folderButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  folderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
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
    gap: 8,
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
    gap: 10,
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
    gap: 10,
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
});

export default HomeScreen;
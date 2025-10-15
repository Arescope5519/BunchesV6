/**
 * HomeScreen
 * Main application screen
 * Refactored from your App.js
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Hooks
import { useRecipes } from '../hooks/useRecipes';
import { useFolders } from '../hooks/useFolders';
import { useShareIntent } from '../hooks/useShareIntent';
import { useRecipeExtraction } from '../hooks/useRecipeExtraction';

// Components
import RecipeDetail from '../components/RecipeDetail';

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

  // Hooks
  const {
    recipes,
    loadingRecipes,
    selectedRecipe,
    setSelectedRecipe,
    saveRecipe,
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

  const { loading, extractRecipe } = useRecipeExtraction((recipe, shouldSave) => {
    if (shouldSave) {
      saveRecipe(recipe);
      setSelectedRecipe(recipe);
      setUrl('');
    } else {
      saveRecipe(recipe);
      setSelectedRecipe(recipe);
      setUrl('');
    }
  });

  // Share intent handler
  useShareIntent((sharedUrl) => {
    setUrl(sharedUrl);
    // Auto-extract temporarily disabled for debugging
    // setTimeout(() => extractRecipe(sharedUrl, true), 500);
  });

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

  // Android back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editingFolder) {
        setEditingFolder(null);
        setEditingFolderName('');
        return true;
      }
      if (showMoveToFolder) {
        setShowMoveToFolder(false);
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
  }, [editingFolder, showMoveToFolder, showAddFolder, selectedRecipe, showFolderManager]);

  const filteredRecipes = getFilteredRecipes(currentFolder);

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Bunches</Text>
        <TouchableOpacity onPress={() => setShowFolderManager(true)}>
          <Text style={styles.manageButton}>📁 Folders</Text>
        </TouchableOpacity>
      </View>

      {/* URL Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Paste recipe URL..."
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => extractRecipe(url, false)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Extract</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Folder Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderTabs}>
        {folders.map((folder) => {
          const count = folder === 'Favorites'
            ? recipes.filter(r => r.isFavorite).length
            : folder === 'All Recipes'
            ? recipes.length
            : recipes.filter(r => r.folder === folder).length;

          return (
            <TouchableOpacity
              key={folder}
              style={[
                styles.folderTab,
                currentFolder === folder && styles.folderTabActive
              ]}
              onPress={() => setCurrentFolder(folder)}
              delayLongPress={300}
              onLongPress={() => {
                if (folder !== 'All Recipes' && folder !== 'Favorites') {
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
                }
              }}
            >
              <Text style={[
                styles.folderTabText,
                currentFolder === folder && styles.folderTabTextActive
              ]}>
                {folder} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
                <Text style={styles.recipeMeta}>
                  {recipe.source} • {recipe.folder}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Folder Manager Modal */}
      <Modal visible={showFolderManager} animationType="slide">
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
          <ScrollView style={styles.folderManagerContent}>
            <View style={styles.folderSection}>
              <Text style={styles.folderSectionTitle}>System Folders</Text>
              {['All Recipes', 'Favorites'].map((folder) => (
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
                      {folder === 'All Recipes' ? '📚' : '⭐'}
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
        <Modal visible={!!selectedRecipe} animationType="slide">
          <View style={styles.modalContainer}>
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
              <RecipeDetail recipe={selectedRecipe} />
              <View style={styles.bottomSpacer} />
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Add Folder Modal */}
      <Modal visible={showAddFolder} animationType="fade" transparent>
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
        <Modal visible={showMoveToFolder} animationType="fade" transparent>
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
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Rename Folder Modal */}
      {editingFolder && (
        <Modal visible={!!editingFolder} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.addFolderModal}>
              <Text style={styles.addFolderTitle}>Rename Folder</Text>
              <TextInput
                style={styles.addFolderInput}
                placeholder="New folder name"
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
  },
  manageButton: {
    color: colors.white,
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: colors.white,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
  },
  folderTabs: {
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    maxHeight: 28,
  },
  folderTab: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 5,
    borderRadius: 8,
    backgroundColor: colors.borderVeryLight,
    height: 24,
    justifyContent: 'center',
  },
  folderTabActive: {
    backgroundColor: colors.primary,
  },
  folderTabText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  folderTabTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  recipeList: {
    flex: 1,
    padding: 15,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: colors.textTertiary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
  },
  recipeCard: {
    backgroundColor: colors.white,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: colors.shadow,
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
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingTop: 20,
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryDark,
  },
  modalCloseButton: {
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  addFolderHeaderButton: {
    fontSize: 16,
    color: colors.white,
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
    height: 60,
  },
  folderManagerContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  folderSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  folderSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  folderManagerItem: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderVeryLight,
  },
  folderManagerItemActive: {
    backgroundColor: colors.primaryLight,
  },
  folderManagerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  folderManagerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  folderManagerItemText: {
    fontSize: 17,
    color: colors.text,
    flex: 1,
  },
  folderManagerItemTextActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  folderManagerCount: {
    fontSize: 16,
    color: colors.textTertiary,
    fontWeight: '600',
    marginLeft: 10,
  },
  emptyFolders: {
    backgroundColor: colors.white,
    padding: 40,
    alignItems: 'center',
  },
  emptyFoldersText: {
    fontSize: 16,
    color: colors.textTertiary,
    marginBottom: 5,
  },
  emptyFoldersSubtext: {
    fontSize: 14,
    color: colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addFolderModal: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  addFolderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  addFolderInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
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
    backgroundColor: colors.borderVeryLight,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  createButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  folderItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  folderItemText: {
    fontSize: 16,
    color: colors.text,
  },
});

export default HomeScreen;
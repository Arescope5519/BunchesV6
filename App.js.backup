import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Modal,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import RecipeExtractor from './RecipeExtractor';

// Try to import share library, but handle gracefully if it fails
let ReceiveSharingIntent = null;
try {
  ReceiveSharingIntent = require('react-native-receive-sharing-intent').default;
} catch (error) {
  console.log('⚠️ Share intent not available (will work after rebuild):', error.message);
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [folders, setFolders] = useState(['All Recipes', 'Favorites']);
  const [currentFolder, setCurrentFolder] = useState('All Recipes');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedIngredientIndex, setSelectedIngredientIndex] = useState(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(null);
  const [swapModeIngredient, setSwapModeIngredient] = useState(false);
  const [swapModeStep, setSwapModeStep] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Initialize extractor once
  const extractor = useRef(new RecipeExtractor()).current;

  /**
   * Extract URL from mixed text
   */
  const extractUrlFromText = (text) => {
    if (!text) return null;
    if (text.startsWith('http://') || text.startsWith('https://')) {
      const firstSpace = text.indexOf(' ');
      if (firstSpace === -1) return text.trim();
      return text.substring(0, firstSpace).trim();
    }
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const match = text.match(urlRegex);
    if (match) {
      let url = match[1];
      url = url.replace(/[.,;:!?)\]}>]+$/, '');
      return url;
    }
    return null;
  };

  /**
   * Extract recipe from URL
   */
  const extractRecipe = async (recipeUrl = url, autoSave = false) => {
    if (!recipeUrl) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    setLoading(true);
    console.log('🔍 Extracting recipe from:', recipeUrl);

    try {
      const result = await extractor.extract(recipeUrl);

      if (result.success) {
        const recipe = {
          id: Date.now().toString(),
          url: recipeUrl,
          ...result.data,
          extractedAt: new Date().toISOString(),
          source: result.source,
          folder: 'All Recipes',
          isFavorite: false,
        };

        if (autoSave) {
          await saveRecipe(recipe);
          setSelectedRecipe(recipe);
        } else {
          Alert.alert(
            'Recipe Extracted! 🎉',
            `${recipe.title}\n\nMethod: ${result.source}\nConfidence: ${(recipe.confidence * 100).toFixed(0)}%\n\nSave this recipe?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save',
                onPress: async () => {
                  await saveRecipe(recipe);
                  setSelectedRecipe(recipe);
                }
              }
            ]
          );
        }
        setUrl('');
      } else {
        Alert.alert('Extraction Failed', result.error || 'Unable to extract recipe');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save recipe - FIX: Wait for recipes to load before saving
   */
  const saveRecipe = async (recipe) => {
    // Wait for recipes to load if they haven't yet
    while (loadingRecipes) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const updatedRecipes = [recipe, ...recipes];
    await AsyncStorage.setItem('recipes', JSON.stringify(updatedRecipes));
    setRecipes(updatedRecipes);
    console.log('✅ Recipe saved! Total recipes:', updatedRecipes.length);
  };

  /**
   * Update existing recipe (for editing)
   */
  const updateRecipe = async (updatedRecipe) => {
    const updatedRecipes = recipes.map(r =>
      r.id === updatedRecipe.id ? updatedRecipe : r
    );
    await AsyncStorage.setItem('recipes', JSON.stringify(updatedRecipes));
    setRecipes(updatedRecipes);
    setEditingRecipe(null);
    setSelectedRecipe(updatedRecipe);
    setSelectedIngredientIndex(null);
    setSelectedStepIndex(null);
    setSwapModeIngredient(false);
    setSwapModeStep(false);
  };

  /**
   * Swap ingredients
   */
  const swapIngredients = (fromIndex, toIndex) => {
    const ingredients = Object.values(editingRecipe.ingredients).flat();
    [ingredients[fromIndex], ingredients[toIndex]] = [ingredients[toIndex], ingredients[fromIndex]];
    setEditingRecipe({
      ...editingRecipe,
      ingredients: { main: ingredients }
    });
    setSelectedIngredientIndex(null);
    setSwapModeIngredient(false);
  };

  /**
   * Swap steps
   */
  const swapSteps = (fromIndex, toIndex) => {
    const instructions = [...editingRecipe.instructions];
    [instructions[fromIndex], instructions[toIndex]] = [instructions[toIndex], instructions[fromIndex]];
    setEditingRecipe({
      ...editingRecipe,
      instructions
    });
    setSelectedStepIndex(null);
    setSwapModeStep(false);
  };

  /**
   * Load saved recipes and folders
   */
  const loadRecipes = async () => {
    try {
      setLoadingRecipes(true);
      const stored = await AsyncStorage.getItem('recipes');
      const storedFolders = await AsyncStorage.getItem('folders');

      if (stored) {
        const parsed = JSON.parse(stored);
        setRecipes(parsed);
        console.log(`📚 Loaded ${parsed.length} recipes`);
      }

      if (storedFolders) {
        const parsedFolders = JSON.parse(storedFolders);
        setFolders(parsedFolders);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setLoadingRecipes(false);
    }
  };

  /**
   * Delete recipe
   */
  const deleteRecipe = async (recipeId) => {
    Alert.alert('Delete Recipe?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = recipes.filter(r => r.id !== recipeId);
          await AsyncStorage.setItem('recipes', JSON.stringify(updated));
          setRecipes(updated);
          setSelectedRecipe(null);
        }
      }
    ]);
  };

  /**
   * Move recipe to folder
   */
  const moveToFolder = async (recipeId, newFolder) => {
    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, folder: newFolder } : r
    );
    await AsyncStorage.setItem('recipes', JSON.stringify(updatedRecipes));
    setRecipes(updatedRecipes);

    // Update selectedRecipe if it's the one being moved
    if (selectedRecipe && selectedRecipe.id === recipeId) {
      setSelectedRecipe({...selectedRecipe, folder: newFolder});
    }

    setShowMoveToFolder(false);
    Alert.alert('Success', `Moved to "${newFolder}"`);
  };

  /**
   * Toggle favorite
   */
  const toggleFavorite = async (recipeId) => {
    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, isFavorite: !r.isFavorite } : r
    );
    await AsyncStorage.setItem('recipes', JSON.stringify(updatedRecipes));
    setRecipes(updatedRecipes);

    // Update selectedRecipe if it's the one being toggled
    if (selectedRecipe && selectedRecipe.id === recipeId) {
      setSelectedRecipe({...selectedRecipe, isFavorite: !selectedRecipe.isFavorite});
    }
  };

  /**
   * Add new folder
   */
  const addFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    if (folders.includes(newFolderName.trim())) {
      Alert.alert('Error', 'A folder with this name already exists');
      return;
    }

    const newFolders = [...folders, newFolderName.trim()];
    setFolders(newFolders);
    await AsyncStorage.setItem('folders', JSON.stringify(newFolders));
    setNewFolderName('');
    setShowAddFolder(false);
    Alert.alert('Success', `Folder "${newFolderName.trim()}" created!`);
  };

  /**
   * Rename folder
   */
  const renameFolder = async () => {
    if (!editingFolderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return;
    }

    if (folders.includes(editingFolderName.trim()) && editingFolderName.trim() !== editingFolder) {
      Alert.alert('Error', 'A folder with this name already exists');
      return;
    }

    const oldName = editingFolder;
    const newName = editingFolderName.trim();

    // Update folders list
    const updatedFolders = folders.map(f => f === oldName ? newName : f);
    setFolders(updatedFolders);
    await AsyncStorage.setItem('folders', JSON.stringify(updatedFolders));

    // Update all recipes in that folder
    const updatedRecipes = recipes.map(r =>
      r.folder === oldName ? { ...r, folder: newName } : r
    );
    setRecipes(updatedRecipes);
    await AsyncStorage.setItem('recipes', JSON.stringify(updatedRecipes));

    setEditingFolder(null);
    setEditingFolderName('');
    Alert.alert('Success', `Folder renamed to "${newName}"`);
  };

  /**
   * Delete folder
   */
  const deleteFolder = async (folderName) => {
    const recipesInFolder = recipes.filter(r => r.folder === folderName);

    Alert.alert(
      'Delete Folder?',
      `This will delete "${folderName}" and move ${recipesInFolder.length} recipe(s) to "All Recipes". Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Remove folder
            const updatedFolders = folders.filter(f => f !== folderName);
            setFolders(updatedFolders);
            await AsyncStorage.setItem('folders', JSON.stringify(updatedFolders));

            // Move recipes to "All Recipes"
            const updatedRecipes = recipes.map(r =>
              r.folder === folderName ? { ...r, folder: 'All Recipes' } : r
            );
            setRecipes(updatedRecipes);
            await AsyncStorage.setItem('recipes', JSON.stringify(updatedRecipes));

            Alert.alert('Deleted', `Folder "${folderName}" deleted`);
          }
        }
      ]
    );
  };

  /**
   * Get filtered recipes
   */
  const getFilteredRecipes = () => {
    if (currentFolder === 'All Recipes') {
      return recipes;
    } else if (currentFolder === 'Favorites') {
      return recipes.filter(r => r.isFavorite);
    } else {
      return recipes.filter(r => r.folder === currentFolder);
    }
  };

  /**
   * Handle shared URLs from browser - DEBUG VERSION
   */
  const handleSharedUrl = (sharedData) => {
    console.log('📨 Received shared data:', sharedData);

    let sharedUrl = null;
    if (typeof sharedData === 'string') {
      sharedUrl = extractUrlFromText(sharedData);
    } else if (sharedData.weblink) {
      sharedUrl = extractUrlFromText(sharedData.weblink);
    } else if (sharedData.text) {
      sharedUrl = extractUrlFromText(sharedData.text);
    } else if (sharedData.contentUri) {
      sharedUrl = extractUrlFromText(sharedData.contentUri);
    }

    // SHOW THE URL IN THE BAR FIRST (for debugging)
    if (sharedUrl) {
      Alert.alert('Debug', `Extracted URL: ${sharedUrl}`);
      setUrl(sharedUrl); // Show it in the input bar
      // Remove the auto-extract temporarily to test
      // setTimeout(() => extractRecipe(sharedUrl, true), 500);
    } else {
      Alert.alert('Error', `Could not extract URL. Received: ${JSON.stringify(sharedData)}`);
    }
  };

  /**
   * Setup share intent listener
   */
  useEffect(() => {
    loadRecipes();

    if (ReceiveSharingIntent) {
      try {
        ReceiveSharingIntent.getReceivedFiles(
          (files) => {
            if (files && files.length > 0) {
              handleSharedUrl(files[0]);
            }
          }
        );

        const subscription = ReceiveSharingIntent.addEventListener('url', (event) => {
          if (event && event.url) {
            handleSharedUrl(event.url);
          }
        });

        return () => {
          ReceiveSharingIntent.clearReceivedFiles();
          if (subscription && subscription.remove) {
            subscription.remove();
          }
        };
      } catch (error) {
        console.log('⚠️ Could not setup share listener:', error.message);
      }
    }
  }, []);

  /**
   * Handle Android back button
   */
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editingFolder) {
        setEditingFolder(null);
        setEditingFolderName('');
        return true;
      }
      if (swapModeIngredient || swapModeStep) {
        setSwapModeIngredient(false);
        setSwapModeStep(false);
        setSelectedIngredientIndex(null);
        setSelectedStepIndex(null);
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
      if (editingRecipe) {
        setEditingRecipe(null);
        setSelectedIngredientIndex(null);
        setSelectedStepIndex(null);
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
      return false; // Let default back behavior work
    });

    return () => backHandler.remove();
  }, [editingFolder, swapModeIngredient, swapModeStep, showMoveToFolder, showAddFolder, editingRecipe, selectedRecipe, showFolderManager]);

  const filteredRecipes = getFilteredRecipes();

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
          onPress={() => extractRecipe()}
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
        {folders.map((folder) => (
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
              {folder} ({folder === 'Favorites'
                ? recipes.filter(r => r.isFavorite).length
                : folder === 'All Recipes'
                ? recipes.length
                : recipes.filter(r => r.folder === folder).length})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recipe List */}
      {loadingRecipes ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
                  activeOpacity={0.7}
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
              {folders.filter(f => f !== 'All Recipes' && f !== 'Favorites').length === 0 ? (
                <View style={styles.emptyFolders}>
                  <Text style={styles.emptyFoldersText}>No custom folders yet</Text>
                  <Text style={styles.emptyFoldersSubtext}>Tap "+ New" to create one</Text>
                </View>
              ) : (
                folders.filter(f => f !== 'All Recipes' && f !== 'Favorites').map((folder) => (
                  <TouchableOpacity
                    key={folder}
                    style={[
                      styles.folderManagerItem,
                      currentFolder === folder && styles.folderManagerItemActive
                    ]}
                    activeOpacity={0.7}
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
      {selectedRecipe && !editingRecipe && (
        <Modal visible={!!selectedRecipe} animationType="slide">
          <View style={styles.modalContainer}>
            <StatusBar style="light" hidden={true} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
                <Text style={styles.modalCloseButton}>✕ Close</Text>
              </TouchableOpacity>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setEditingRecipe({...selectedRecipe})}
                  style={styles.iconButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.iconButtonText}>✏️</Text>
                </TouchableOpacity>
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
                    const customFolders = folders.filter(f => f !== 'All Recipes' && f !== 'Favorites');
                    if (customFolders.length === 0) {
                      Alert.alert('No Folders', 'Create a custom folder first!', [
                        { text: 'OK' },
                        { text: 'Create Folder', onPress: () => {
                          setSelectedRecipe(null);
                          setShowFolderManager(true);
                          setTimeout(() => setShowAddFolder(true), 300);
                        }}
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
              <RecipeDetailView recipe={selectedRecipe} />
              <View style={styles.bottomSpacer} />
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Recipe Edit Modal and other modals continue... */}
      {/* (Rest of the modals remain the same - too long to paste here but they're unchanged) */}

{/* ... Continue with all other modals exactly as they were ... */}

</View>
  );
}

function RecipeDetailView({ recipe }) {
  return (
    <>
      <Text style={styles.modalTitle}>{recipe.title}</Text>

      {(recipe.prep_time || recipe.cook_time || recipe.servings) && (
        <View style={styles.metaContainer}>
          {recipe.prep_time && <Text style={styles.metaText}>⏱️ Prep: {recipe.prep_time}</Text>}
          {recipe.cook_time && <Text style={styles.metaText}>🔥 Cook: {recipe.cook_time}</Text>}
          {recipe.servings && <Text style={styles.metaText}>🍽️ Serves: {recipe.servings}</Text>}
        </View>
      )}

      <Text style={styles.sectionTitle}>Ingredients</Text>
      {Object.entries(recipe.ingredients).map(([section, items]) => (
        <View key={section} style={styles.ingredientSection}>
          {section !== 'main' && (
            <Text style={styles.subsectionTitle}>{section}</Text>
          )}
          {items.map((item, idx) => (
            <Text key={idx} style={styles.ingredientItem}>• {item}</Text>
          ))}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Instructions</Text>
      {recipe.instructions.map((step, idx) => (
        <View key={idx} style={styles.instructionStep}>
          <Text style={styles.stepNumber}>{idx + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}

      <View style={styles.sourceContainer}>
        <Text style={styles.sourceLabel}>Source:</Text>
        <Text style={styles.sourceUrl}>{recipe.url}</Text>
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
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
    color: '#fff',
  },
  manageButton: {
    color: '#fff',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  folderTabs: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    maxHeight: 28,
  },
  folderTab: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 5,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    height: 24,
    justifyContent: 'center',
  },
  folderTabActive: {
    backgroundColor: '#007AFF',
  },
  folderTabText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  folderTabTextActive: {
    color: '#fff',
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
    color: '#999',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#bbb',
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
    color: '#333',
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
    color: '#666',
    marginTop: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingTop: 20,
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#0066CC',
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
  saveButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
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
    color: '#666',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  ingredientSection: {
    marginBottom: 15,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  ingredientItem: {
    fontSize: 15,
    marginBottom: 5,
    color: '#333',
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 10,
    minWidth: 25,
  },
  stepText: {
    fontSize: 15,
    flex: 1,
    color: '#333',
  },
  sourceContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  sourceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  sourceUrl: {
    fontSize: 12,
    color: '#007AFF',
  },
  bottomSpacer: {
    height: 60,
  },
  folderManagerContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  folderSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  folderSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  folderManagerItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  folderManagerItemActive: {
    backgroundColor: '#E6F2FF',
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
    color: '#333',
    flex: 1,
  },
  folderManagerItemTextActive: {
    fontWeight: '600',
    color: '#007AFF',
  },
  folderManagerCount: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
    marginLeft: 10,
  },
  emptyFolders: {
    backgroundColor: '#fff',
    padding: 40,
    alignItems: 'center',
  },
  emptyFoldersText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 5,
  },
  emptyFoldersSubtext: {
    fontSize: 14,
    color: '#bbb',
  },
  currentFolderBadge: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  createFolderButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 2,
    borderTopColor: '#f0f0f0',
    marginTop: 10,
  },
  createFolderButtonIcon: {
    fontSize: 24,
    marginRight: 12,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  createFolderButtonText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  folderItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  folderItemText: {
    fontSize: 16,
    color: '#333',
  },
  editModalContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  editSection: {
    backgroundColor: '#fff',
    marginBottom: 20,
    paddingVertical: 15,
  },
  editSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  editSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginHorizontal: 20,
    backgroundColor: '#fff',
  },
  addItemButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reorderHint: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  swapModeHint: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#E6F2FF',
    paddingVertical: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#f0f8ff',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonSwap: {
    backgroundColor: '#5856D6',
  },
  actionButtonDelete: {
    backgroundColor: '#ff3b30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonTextDelete: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  editItemContainer: {
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  editItemContainerSelected: {
    backgroundColor: '#E6F2FF',
    paddingVertical: 5,
  },
  editItemContainerSwapMode: {
    backgroundColor: '#5856D6',
    paddingVertical: 5,
  },
  editItemTouchArea: {
    width: '100%',
  },
  textInputWrapper: {
    flex: 1,
    pointerEvents: 'auto',
  },
  editItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  editItemBullet: {
    fontSize: 20,
    color: '#666',
    marginRight: 10,
    marginTop: 8,
  },
  editItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  editItemInputReadOnly: {
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    color: '#333',
  },
  editStepContainer: {
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  editStepContainerSelected: {
    backgroundColor: '#E6F2FF',
    paddingVertical: 5,
  },
  editStepRow: {
  },
  editStepHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandle: {
    fontSize: 18,
    color: '#007AFF',
    marginRight: 8,
  },
  editStepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  editStepInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addFolderModal: {
    backgroundColor: '#fff',
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
    borderColor: '#ddd',
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
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
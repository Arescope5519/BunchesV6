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
  };

  /**
   * Add new folder
   */
  const addFolder = () => {
    Alert.prompt(
      'New Folder',
      'Enter folder name:',
      async (folderName) => {
        if (folderName && !folders.includes(folderName)) {
          const newFolders = [...folders, folderName];
          setFolders(newFolders);
          await AsyncStorage.setItem('folders', JSON.stringify(newFolders));
        }
      }
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
   * Handle shared URLs from browser
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

    if (sharedUrl) {
      setUrl('');
      setTimeout(() => extractRecipe(sharedUrl, true), 500);
    } else {
      Alert.alert('Error', 'Could not extract recipe URL from shared content');
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
      if (editingRecipe) {
        setEditingRecipe(null);
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
  }, [editingRecipe, selectedRecipe, showFolderManager]);

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
                  <TouchableOpacity onPress={() => toggleFavorite(recipe.id)}>
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
            <Text style={styles.modalHeaderTitle}>Manage Folders</Text>
            <TouchableOpacity onPress={addFolder}>
              <Text style={styles.addFolderButton}>+ Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {folders.map((folder) => (
              <TouchableOpacity
                key={folder}
                style={styles.folderItem}
                activeOpacity={0.7}
                onPress={() => {
                  setCurrentFolder(folder);
                  setShowFolderManager(false);
                }}
              >
                <Text style={styles.folderItemText}>
                  📁 {folder} ({folder === 'Favorites'
                    ? recipes.filter(r => r.isFavorite).length
                    : folder === 'All Recipes'
                    ? recipes.length
                    : recipes.filter(r => r.folder === folder).length} recipes)
                </Text>
              </TouchableOpacity>
            ))}
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
                >
                  <Text style={styles.iconButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleFavorite(selectedRecipe.id)}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonText}>
                    {selectedRecipe.isFavorite ? '⭐' : '☆'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Move to Folder',
                      'Select folder:',
                      folders.filter(f => f !== 'All Recipes' && f !== 'Favorites').map(folder => ({
                        text: folder,
                        onPress: () => moveToFolder(selectedRecipe.id, folder)
                      })).concat([{ text: 'Cancel', style: 'cancel' }])
                    );
                  }}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonText}>📁</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteRecipe(selectedRecipe.id)}
                  style={styles.iconButton}
                >
                  <Text style={styles.iconButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.modalContent}>
              <RecipeDetailView recipe={selectedRecipe} />
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Recipe Edit Modal */}
      {editingRecipe && (
        <Modal visible={!!editingRecipe} animationType="slide">
          <View style={styles.modalContainer}>
            <StatusBar style="light" hidden={true} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditingRecipe(null)}>
                <Text style={styles.modalCloseButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Edit Recipe</Text>
              <TouchableOpacity onPress={() => updateRecipe(editingRecipe)}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.editLabel}>Title</Text>
              <TextInput
                style={styles.editInput}
                value={editingRecipe.title}
                onChangeText={(text) => setEditingRecipe({...editingRecipe, title: text})}
              />

              <Text style={styles.editLabel}>Ingredients (one per line)</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={Object.values(editingRecipe.ingredients).flat().join('\n')}
                onChangeText={(text) => {
                  const lines = text.split('\n').filter(l => l.trim());
                  setEditingRecipe({
                    ...editingRecipe,
                    ingredients: { main: lines }
                  });
                }}
                multiline
              />

              <Text style={styles.editLabel}>Instructions (one per line)</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={editingRecipe.instructions.join('\n')}
                onChangeText={(text) => {
                  const lines = text.split('\n').filter(l => l.trim());
                  setEditingRecipe({...editingRecipe, instructions: lines});
                }}
                multiline
              />
            </ScrollView>
          </View>
        </Modal>
      )}
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
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  folderTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  folderTabActive: {
    backgroundColor: '#007AFF',
  },
  folderTabText: {
    fontSize: 14,
    color: '#333',
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
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  favoriteIcon: {
    fontSize: 20,
    marginLeft: 10,
  },
  recipeMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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
  addFolderButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 15,
  },
  iconButton: {
    padding: 5,
  },
  iconButtonText: {
    fontSize: 20,
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
  editLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  editTextArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
});
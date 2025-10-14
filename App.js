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
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [previewRecipe, setPreviewRecipe] = useState(null);

  // Initialize extractor once
  const extractor = useRef(new RecipeExtractor()).current;

  /**
   * Extract URL from mixed text
   * Handles: "Check out this recipe! https://example.com/recipe blah blah"
   */
  const extractUrlFromText = (text) => {
    if (!text) return null;

    // If it's already a clean URL, return it
    if (text.startsWith('http://') || text.startsWith('https://')) {
      const firstSpace = text.indexOf(' ');
      if (firstSpace === -1) return text.trim();
      return text.substring(0, firstSpace).trim();
    }

    // Extract URL from mixed text using regex
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const match = text.match(urlRegex);

    if (match) {
      let url = match[1];
      // Remove trailing punctuation
      url = url.replace(/[.,;:!?)\]}>]+$/, '');
      console.log('🔍 Extracted URL from text:', url);
      return url;
    }

    console.log('⚠️ No URL found in text:', text);
    return null;
  };

  /**
   * Extract recipe using standalone JavaScript extractor
   * NO SERVER REQUIRED!
   */
  const extractRecipe = async (recipeUrl = url, autoSave = false) => {
    if (!recipeUrl) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    setLoading(true);
    console.log('🔍 Extracting recipe from:', recipeUrl);

    try {
      // Call standalone extractor
      const result = await extractor.extract(recipeUrl);

      if (result.success) {
        const recipe = {
          id: Date.now().toString(),
          url: recipeUrl,
          ...result.data,
          extractedAt: new Date().toISOString(),
          source: result.source
        };

        console.log('✅ Extraction successful:', recipe.title);
        console.log('📊 Method:', recipe.extraction_method);
        console.log('🎯 Confidence:', recipe.confidence);

        if (autoSave) {
          // Auto-save and show preview
          await saveRecipe(recipe);
          setPreviewRecipe(recipe);
        } else {
          // Show save confirmation
          Alert.alert(
            'Recipe Extracted! 🎉',
            `${recipe.title}\n\nMethod: ${result.source}\nConfidence: ${(recipe.confidence * 100).toFixed(0)}%\n\nSave this recipe?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save',
                onPress: async () => {
                  await saveRecipe(recipe);
                  setPreviewRecipe(recipe);
                }
              }
            ]
          );
        }

        setUrl('');
      } else {
        console.log('❌ Extraction failed:', result.error);
        Alert.alert(
          'Extraction Failed',
          result.error || 'Unable to extract recipe from this URL.\n\nTry a different recipe site.'
        );
      }
    } catch (error) {
      console.error('💥 Error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save recipe to storage
   */
  const saveRecipe = async (recipe) => {
    const updatedRecipes = [recipe, ...recipes];
    await AsyncStorage.setItem('recipes', JSON.stringify(updatedRecipes));
    setRecipes(updatedRecipes);
  };

  /**
   * Load saved recipes from AsyncStorage
   */
  const loadRecipes = async () => {
    try {
      const stored = await AsyncStorage.getItem('recipes');
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecipes(parsed);
        console.log(`📚 Loaded ${parsed.length} recipes`);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
    }
  };

  /**
   * Delete a recipe
   */
  const deleteRecipe = async (recipeId) => {
    Alert.alert(
      'Delete Recipe?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = recipes.filter(r => r.id !== recipeId);
            await AsyncStorage.setItem('recipes', JSON.stringify(updated));
            setRecipes(updated);
            setSelectedRecipe(null);
            setPreviewRecipe(null);
          }
        }
      ]
    );
  };

  /**
   * Handle shared URLs from browser
   */
  const handleSharedUrl = (sharedData) => {
    console.log('📨 Received shared data:', sharedData);

    let sharedUrl = null;

    // Extract URL from various formats
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
      console.log('✅ Extracted URL:', sharedUrl);
      // DON'T show in input field - keep it clean
      setUrl('');
      // Auto-extract immediately
      setTimeout(() => extractRecipe(sharedUrl, true), 500);
    } else {
      console.log('❌ Could not extract URL from shared data');
      Alert.alert('Error', 'Could not extract recipe URL from shared content');
    }
  };

  /**
   * Setup share intent listener (if available)
   */
  useEffect(() => {
    loadRecipes();

    // Only setup share listener if library is available
    if (ReceiveSharingIntent) {
      try {
        // Handle share when app is CLOSED and opened via share
        ReceiveSharingIntent.getReceivedFiles(
          (files) => {
            console.log('📨 Initial share (app was closed):', files);
            if (files && files.length > 0) {
              handleSharedUrl(files[0]);
            }
          },
          (error) => {
            console.log('❌ Initial share error:', error);
          }
        );

        // Handle share when app is ALREADY OPEN
        const subscription = ReceiveSharingIntent.addEventListener('url', (event) => {
          console.log('📨 New share (app was open):', event);
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
    } else {
      console.log('ℹ️ Share from browser will work after running: npx expo run:android');
    }
  }, []);

  /**
   * View extraction statistics
   */
  const viewStats = () => {
    const stats = extractor.getStats();
    const total = Object.values(stats).reduce((a, b) => {
      return typeof b === 'number' ? a + b : a;
    }, 0);

    const message = `
Total Extractions: ${total}

📊 By Method:
- JSON-LD: ${stats.json_ld} (${stats.percentages?.json_ld || '0%'})
- Microdata: ${stats.microdata} (${stats.percentages?.microdata || '0%'})
- WordPress: ${stats.wp_plugin} (${stats.percentages?.wp_plugin || '0%'})
- Site-Specific: ${stats.site_specific} (${stats.percentages?.site_specific || '0%'})
- Failed: ${stats.failed} (${stats.percentages?.failed || '0%'})
    `.trim();

    Alert.alert('Extraction Statistics', message);
  };

  /**
   * Clear all recipes
   */
  const clearAllRecipes = () => {
    Alert.alert(
      'Clear All Recipes?',
      'This will delete all saved recipes. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.setItem('recipes', JSON.stringify([]));
            setRecipes([]);
            Alert.alert('Cleared', 'All recipes deleted');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Bunches</Text>
        <Text style={styles.subtitle}>Recipe Extractor</Text>
      </View>

      {/* URL Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Paste recipe URL here..."
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

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={viewStats}>
          <Text style={styles.actionButtonText}>📊 Stats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={clearAllRecipes}>
          <Text style={styles.actionButtonText}>🗑️ Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Share Info Banner (if not available yet) */}
      {!ReceiveSharingIntent && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            ℹ️ Share from browser will work after rebuild
          </Text>
        </View>
      )}

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Extracting recipe...</Text>
        </View>
      )}

      {/* Recipe List */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Saved Recipes ({recipes.length})</Text>
      </View>

      <ScrollView style={styles.recipeList}>
        {recipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No recipes yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Share a recipe from your browser or paste a URL above
            </Text>
          </View>
        ) : (
          recipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.recipeCard}
              onPress={() => setSelectedRecipe(recipe)}
            >
              <Text style={styles.recipeTitle}>{recipe.title}</Text>
              <Text style={styles.recipeMeta}>
                {recipe.source} • {(recipe.confidence * 100).toFixed(0)}% confidence
              </Text>
              <Text style={styles.recipeUrl} numberOfLines={1}>
                {recipe.url}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Recipe Preview Modal (Shows after extraction) */}
      {previewRecipe && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={!!previewRecipe}
          onRequestClose={() => setPreviewRecipe(null)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPreviewRecipe(null)}>
                <Text style={styles.modalCloseButton}>✓ Done</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Recipe Saved!</Text>
              <TouchableOpacity onPress={() => deleteRecipe(previewRecipe.id)}>
                <Text style={styles.modalDeleteButton}>🗑️</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <RecipeDetailView recipe={previewRecipe} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Recipe Detail Modal (For viewing saved recipes) */}
      {selectedRecipe && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={!!selectedRecipe}
          onRequestClose={() => setSelectedRecipe(null)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
                <Text style={styles.modalCloseButton}>✕ Close</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => deleteRecipe(selectedRecipe.id)}>
                <Text style={styles.modalDeleteButton}>🗑️ Delete</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <RecipeDetailView recipe={selectedRecipe} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

/**
 * Recipe Detail View Component (Reusable)
 */
function RecipeDetailView({ recipe }) {
  return (
    <>
      {/* Recipe Title */}
      <Text style={styles.modalTitle}>{recipe.title}</Text>

      {/* Meta Info */}
      {(recipe.prep_time || recipe.cook_time || recipe.servings) && (
        <View style={styles.metaContainer}>
          {recipe.prep_time && (
            <Text style={styles.metaText}>⏱️ Prep: {recipe.prep_time}</Text>
          )}
          {recipe.cook_time && (
            <Text style={styles.metaText}>🔥 Cook: {recipe.cook_time}</Text>
          )}
          {recipe.total_time && (
            <Text style={styles.metaText}>⏰ Total: {recipe.total_time}</Text>
          )}
          {recipe.servings && (
            <Text style={styles.metaText}>🍽️ Serves: {recipe.servings}</Text>
          )}
        </View>
      )}

      {/* Ingredients */}
      <Text style={styles.sectionTitle}>Ingredients</Text>
      {Object.entries(recipe.ingredients).map(([section, items]) => (
        <View key={section} style={styles.ingredientSection}>
          {section !== 'main' && (
            <Text style={styles.subsectionTitle}>{section}</Text>
          )}
          {items.map((item, idx) => (
            <Text key={idx} style={styles.ingredientItem}>
              • {item}
            </Text>
          ))}
        </View>
      ))}

      {/* Instructions */}
      {recipe.instructions && recipe.instructions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {recipe.instructions.map((step, idx) => (
            <View key={idx} style={styles.instructionStep}>
              <Text style={styles.stepNumber}>{idx + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </>
      )}

      {/* Source */}
      <View style={styles.sourceContainer}>
        <Text style={styles.sourceLabel}>Source:</Text>
        <Text style={styles.sourceUrl} numberOfLines={2}>
          {recipe.url}
        </Text>
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
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
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
    minWidth: 100,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 10,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoBanner: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  infoBannerText: {
    fontSize: 12,
    color: '#856404',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  listHeader: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
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
    marginHorizontal: 15,
    marginVertical: 6,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  recipeMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  recipeUrl: {
    fontSize: 11,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalDeleteButton: {
    fontSize: 20,
    color: '#FF3B30',
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
    gap: 15,
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    marginTop: 10,
    marginBottom: 5,
    color: '#007AFF',
  },
  ingredientItem: {
    fontSize: 15,
    lineHeight: 24,
    paddingLeft: 5,
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
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  sourceContainer: {
    marginTop: 30,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sourceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  sourceUrl: {
    fontSize: 12,
    color: '#007AFF',
  },
});
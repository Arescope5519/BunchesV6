/**
 * useRecipeExtraction Hook
 * Handles recipe extraction from URLs
 * Now includes URL deduplication and stats tracking
 */

import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import RecipeExtractor from '../../RecipeExtractor';

/**
 * Normalize URL for comparison (remove trailing slash, www, protocol variations)
 */
const normalizeUrl = (url) => {
  try {
    const parsed = new URL(url);
    // Remove www., trailing slash, and normalize to lowercase
    let normalized = parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '');
    // Include query params if they exist (some recipes are identified by query params)
    if (parsed.search) {
      normalized += parsed.search;
    }
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

export const useRecipeExtraction = (onRecipeExtracted, existingRecipes = []) => {
  const [loading, setLoading] = useState(false);
  const extractor = useRef(new RecipeExtractor()).current;

  /**
   * Check if a URL has already been imported
   * Returns the existing recipe if found, null otherwise
   */
  const findExistingRecipeByUrl = (url) => {
    const normalizedUrl = normalizeUrl(url);
    return existingRecipes.find(recipe => {
      if (!recipe.url && !recipe.source_url) return false;
      const recipeUrl = recipe.url || recipe.source_url;
      return normalizeUrl(recipeUrl) === normalizedUrl;
    });
  };

  /**
   * Extract recipe from URL
   * Now checks for duplicates and includes stats tracking fields
   */
  const extractRecipe = async (recipeUrl, options = {}) => {
    const { skipDuplicateCheck = false } = options;

    if (!recipeUrl) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    // Check for existing recipe with same URL
    if (!skipDuplicateCheck) {
      const existingRecipe = findExistingRecipeByUrl(recipeUrl);
      if (existingRecipe) {
        return new Promise((resolve) => {
          Alert.alert(
            'Recipe Already Exists',
            `"${existingRecipe.title}" was previously imported from this URL. What would you like to do?`,
            [
              {
                text: 'View Existing',
                onPress: () => {
                  if (onRecipeExtracted) {
                    onRecipeExtracted(existingRecipe, { isExisting: true });
                  }
                  resolve({ action: 'view_existing', recipe: existingRecipe });
                }
              },
              {
                text: 'Import Again',
                onPress: async () => {
                  const result = await extractRecipe(recipeUrl, { skipDuplicateCheck: true });
                  resolve(result);
                }
              },
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve({ action: 'cancelled' })
              }
            ]
          );
        });
      }
    }

    setLoading(true);

    try {
      const result = await extractor.extract(recipeUrl);

      if (result.success) {
        // Convert image to image_url for consistency
        const imageUrl = result.data.image || result.data.image_url || null;
        const recipe = {
          id: Date.now().toString(),
          url: recipeUrl,
          ...result.data,
          image_url: imageUrl, // Use image_url consistently
          extractedAt: new Date().toISOString(),
          source: result.source,
          folder: 'All Recipes',
          isFavorite: false,
          // Stats tracking fields for public/discoverable feature
          stats: {
            likes: 0,
            saves: 0,
            views: 0,
          },
          // Versioning support - store original for imported recipes
          originalRecipe: {
            title: result.data.title,
            ingredients: result.data.ingredients,
            instructions: result.data.instructions,
            prep_time: result.data.prep_time,
            cook_time: result.data.cook_time,
            total_time: result.data.total_time,
            servings: result.data.servings,
            nutrition: result.data.nutrition,
            image_url: imageUrl,
          },
          hasEdits: false,
          editHistory: [], // Track edit history for sharing
        };

        // Call callback with extracted recipe
        if (onRecipeExtracted) {
          onRecipeExtracted(recipe, { isExisting: false });
        }
        return { action: 'extracted', recipe };
      } else {
        Alert.alert('Extraction Failed', result.error || 'Unable to extract recipe');
        return { action: 'failed', error: result.error };
      }
    } catch (error) {
      Alert.alert('Error', error.message);
      return { action: 'error', error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    extractRecipe,
    findExistingRecipeByUrl,
  };
};

export default useRecipeExtraction;
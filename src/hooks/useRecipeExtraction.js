/**
 * useRecipeExtraction Hook
 * Handles recipe extraction from URLs
 * Now includes URL deduplication and stats tracking
 */

import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import RecipeExtractor from '../../RecipeExtractor';
import { Ionicons } from '@expo/vector-icons';
import { reportExtractionIssue } from '../services/supabase/database';

import { log } from '../utils/log';
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

export const useRecipeExtraction = (onRecipeExtracted, existingRecipes = [], userId = null) => {
  const [loading, setLoading] = useState(false);
  const extractor = useRef(new RecipeExtractor()).current;

  // A failed extraction auto-files an extraction report (same table
  // the "Something look wrong?" tag feeds), carrying the error and -
  // when the page is reachable from this device - its raw ld+json,
  // so fix sessions see exactly what defeated the parser.
  // Fire-and-forget: reporting must never delay or break the UX.
  const fileFailureReport = (recipeUrl, errorMsg) => {
    if (!userId || !recipeUrl) return;
    reportExtractionIssue(
      userId,
      { title: 'Extraction failed', url: recipeUrl },
      `auto: extraction failed - ${errorMsg || 'no structured recipe data found'}`
    ).catch(() => {});
  };

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
    log('🔍 Extracting recipe from:', recipeUrl);

    try {
      // Hard timeout - the extractor has its own 15s fetch timeout,
      // but this catches any downstream hang.
      const extractPromise = extractor.extract(recipeUrl);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Extraction timed out after 30 seconds')), 30000)
      );
      const result = await Promise.race([extractPromise, timeoutPromise]);

      log('🔍 Extraction result:', {
        success: result.success,
        source: result.source,
        title: result.data?.title,
        error: result.error,
      });

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

        // Roundup pages: the extractor found several distinct recipes.
        // Each gets a distinguishing ?recipe= query param on its URL -
        // saveRecipe dedupes by URL, and a fragment would be stripped
        // by normalization, so a query param is what keeps N recipes
        // from one page from collapsing into one.
        let multiRecipes = null;
        if (Array.isArray(result.allRecipes) && result.allRecipes.length > 1) {
          const sep = recipeUrl.includes('?') ? '&' : '?';
          multiRecipes = result.allRecipes.map((d, i) => {
            const slug = String(d.title || i)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 40) || String(i);
            const img = d.image || d.image_url || null;
            return {
              ...d,
              id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
              url: `${recipeUrl}${sep}recipe=${slug}`,
              image_url: img,
              extractedAt: new Date().toISOString(),
              source: result.source,
              folder: 'All Recipes',
              isFavorite: false,
            };
          });
        }

        // Call callback with extracted recipe
        if (onRecipeExtracted) {
          onRecipeExtracted(recipe, { isExisting: false, multiRecipes });
        }
        return { action: 'extracted', recipe };
      } else if (result.roundup) {
        // A list-of-links article - the importer did its job, so no report
        Alert.alert('This Is a Recipe List', result.error);
        return { action: 'failed', error: result.error };
      } else {
        fileFailureReport(recipeUrl, result.error);
        Alert.alert(
          'Extraction Failed',
          `Could not extract a recipe from that URL.\n\n${result.error || 'The site may not have structured recipe data.'}\n\nThis failure was reported so the importer can be improved.`,
        );
        return { action: 'failed', error: result.error };
      }
    } catch (error) {
      console.error('❌ Extraction error:', error);
      const timedOut = error.message === 'Extraction timed out after 30 seconds';
      if (!timedOut) fileFailureReport(recipeUrl, error.message);
      Alert.alert(
        'Extraction Error',
        timedOut
          ? 'The site took too long to respond. Check your internet or try again.'
          : `Failed to extract recipe: ${error.message}\n\nThis failure was reported so the importer can be improved.`,
      );
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
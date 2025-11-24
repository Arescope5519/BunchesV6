/**
 * useRecipeExtraction Hook
 * Handles recipe extraction from URLs
 * Extracted from your App.js
 */

import { useState, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import RecipeExtractor from '../../RecipeExtractor';

export const useRecipeExtraction = (onRecipeExtracted) => {
  const [loading, setLoading] = useState(false);
  const extractor = useRef(new RecipeExtractor()).current;
  const onRecipeExtractedRef = useRef(onRecipeExtracted);

  // Keep the callback ref up to date to avoid staleness
  useEffect(() => {
    onRecipeExtractedRef.current = onRecipeExtracted;
  }, [onRecipeExtracted]);

  /**
   * Extract recipe from URL
   */
  const extractRecipe = async (recipeUrl) => {
    if (!recipeUrl) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    setLoading(true);

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

        // Call callback with extracted recipe using ref to avoid staleness
        console.log('🎯 [EXTRACTION] Calling onRecipeExtractedRef.current with recipe:', recipe.title);
        if (onRecipeExtractedRef.current) {
          onRecipeExtractedRef.current(recipe);
          console.log('✅ [EXTRACTION] Successfully called onRecipeExtractedRef.current');
        } else {
          console.error('❌ [EXTRACTION] onRecipeExtractedRef.current is null!');
        }
      } else {
        Alert.alert('Extraction Failed', result.error || 'Unable to extract recipe');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    extractRecipe,
  };
};

export default useRecipeExtraction;
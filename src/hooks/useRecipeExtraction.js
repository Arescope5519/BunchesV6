/**
 * useRecipeExtraction Hook
 * Handles recipe extraction from URLs
 * Extracted from your App.js
 */

import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import RecipeExtractor from '../../RecipeExtractor';

export const useRecipeExtraction = (onRecipeExtracted) => {
  const [loading, setLoading] = useState(false);
  const extractor = useRef(new RecipeExtractor()).current;

  /**
   * Extract recipe from URL
   */
  const extractRecipe = async (recipeUrl, autoSave = false) => {
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
          // Auto-save (from share intent)
          if (onRecipeExtracted) {
            onRecipeExtracted(recipe, true);
          }
        } else {
          // Manual extraction - ask user
          Alert.alert(
            'Recipe Extracted! 🎉',
            `${recipe.title}\n\nMethod: ${result.source}\nConfidence: ${(recipe.confidence * 100).toFixed(0)}%\n\nSave this recipe?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save',
                onPress: () => {
                  if (onRecipeExtracted) {
                    onRecipeExtracted(recipe, false);
                  }
                }
              }
            ]
          );
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
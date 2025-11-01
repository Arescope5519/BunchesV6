/**
 * useRecipeExtraction Hook - FIXED IMPORT PATHS
 * Handles recipe extraction from URLs
 */

import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import RecipeExtractor from '../utils/RecipeExtractor'; // FIXED: Correct path

export const useRecipeExtraction = (onRecipeExtracted) => {
  const [loading, setLoading] = useState(false);
  const extractor = useRef(new RecipeExtractor()).current;

  const extractRecipe = async (recipeUrl, autoSave = false) => {
    if (!recipeUrl || recipeUrl.trim() === '') {
      if (!autoSave) {
        Alert.alert('Error', 'Please enter a URL');
      }
      return;
    }

    const cleanUrl = recipeUrl.trim();
    setLoading(true);
    console.log('🔍 Extracting recipe from:', cleanUrl);

    try {
      const result = await extractor.extract(cleanUrl);

      if (result.success && result.data) {
        const recipe = {
          id: Date.now().toString(),
          title: result.data.title || 'Untitled Recipe',
          ingredients: result.data.ingredients || { main: [] },
          instructions: result.data.instructions || [],
          sourceUrl: cleanUrl,
          url: cleanUrl,
          notes: result.data.notes || '',
          servings: result.data.servings || '',
          prepTime: result.data.prepTime || '',
          cookTime: result.data.cookTime || '',
          totalTime: result.data.totalTime || '',
          extractedAt: new Date().toISOString(),
          source: result.source || 'unknown',
          confidence: result.data.confidence || 0.5,
          folder: 'All Recipes',
          isFavorite: false,
        };

        console.log('📦 Extracted recipe:', recipe.title);

        if (autoSave) {
          console.log('🤖 Auto-saving recipe from share intent');
          if (onRecipeExtracted) {
            await onRecipeExtracted(recipe, true);
          }
        } else {
          Alert.alert(
            'Recipe Extracted! 🎉',
            `${recipe.title}\n\nMethod: ${result.source}\nConfidence: ${(recipe.confidence * 100).toFixed(0)}%\n\nSave this recipe?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save',
                onPress: async () => {
                  if (onRecipeExtracted) {
                    await onRecipeExtracted(recipe, false);
                  }
                }
              }
            ]
          );
        }
      } else {
        const errorMessage = result.error || 'Unable to extract recipe from this URL';
        console.error('❌ Extraction failed:', errorMessage);

        if (!autoSave) {
          Alert.alert('Extraction Failed', errorMessage);
        }
      }
    } catch (error) {
      console.error('💥 Extraction error:', error);
      if (!autoSave) {
        Alert.alert('Error', error.message || 'An unexpected error occurred');
      }
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
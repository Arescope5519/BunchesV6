/**
 * useRecipes Hook
 * Manages recipe state and CRUD operations
 * Extracted from your App.js
 */

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { saveRecipes as saveRecipesToStorage, loadRecipes as loadRecipesFromStorage } from '../utils/storage';

export const useRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  /**
   * Load saved recipes
   */
  const loadRecipes = async () => {
    try {
      setLoadingRecipes(true);
      const loaded = await loadRecipesFromStorage();
      setRecipes(loaded);
      console.log(`📚 Loaded ${loaded.length} recipes`);
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setLoadingRecipes(false);
    }
  };

  /**
   * Save recipe - waits for recipes to load first
   */
  const saveRecipe = async (recipe) => {
    // Wait for recipes to load if they haven't yet
    while (loadingRecipes) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const updatedRecipes = [recipe, ...recipes];
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);
      console.log('✅ Recipe saved! Total recipes:', updatedRecipes.length);
      return true;
    }
    return false;
  };

  /**
   * Update existing recipe
   */
  const updateRecipe = async (updatedRecipe) => {
    const updatedRecipes = recipes.map(r =>
      r.id === updatedRecipe.id ? updatedRecipe : r
    );
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === updatedRecipe.id) {
        setSelectedRecipe(updatedRecipe);
      }
      return true;
    }
    return false;
  };

  /**
   * Delete recipe
   */
  const deleteRecipe = async (recipeId) => {
    return new Promise((resolve) => {
      Alert.alert('Delete Recipe?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = recipes.filter(r => r.id !== recipeId);
            const success = await saveRecipesToStorage(updated);

            if (success) {
              setRecipes(updated);
              setSelectedRecipe(null);
              resolve(true);
            } else {
              resolve(false);
            }
          }
        }
      ]);
    });
  };

  /**
   * Toggle favorite status
   */
  const toggleFavorite = async (recipeId) => {
    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, isFavorite: !r.isFavorite } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);

      // Update selectedRecipe if it's the one being toggled
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, isFavorite: !selectedRecipe.isFavorite });
      }
    }
  };

  /**
   * Move recipe to folder
   */
  const moveToFolder = async (recipeId, newFolder) => {
    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, folder: newFolder } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);

      // Update selectedRecipe if it's the one being moved
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, folder: newFolder });
      }

      Alert.alert('Success', `Moved to "${newFolder}"`);
      return true;
    }
    return false;
  };

  /**
   * Get filtered recipes by folder
   */
  const getFilteredRecipes = (currentFolder) => {
    if (currentFolder === 'All Recipes') {
      return recipes;
    } else if (currentFolder === 'Favorites') {
      return recipes.filter(r => r.isFavorite);
    } else {
      return recipes.filter(r => r.folder === currentFolder);
    }
  };

  // Load recipes on mount
  useEffect(() => {
    loadRecipes();
  }, []);

  return {
    recipes,
    loadingRecipes,
    selectedRecipe,
    setSelectedRecipe,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
    toggleFavorite,
    moveToFolder,
    getFilteredRecipes,
    refreshRecipes: loadRecipes,
  };
};

export default useRecipes;
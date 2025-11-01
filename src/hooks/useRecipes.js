/**
 * useRecipes Hook - COMPLETE FIXED VERSION
 * Manages recipe state and CRUD operations
 * FIXED: Proper save with recipe return and bulk delete support
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
   * Save recipe - waits for recipes to load first and returns the saved recipe
   */
  const saveRecipe = async (recipe) => {
    try {
      // Wait for recipes to load if they haven't yet
      while (loadingRecipes) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Ensure recipe has all required fields
      const recipeToSave = {
        id: recipe.id || Date.now().toString(),
        title: recipe.title || 'Untitled Recipe',
        ingredients: recipe.ingredients || { main: [] },
        instructions: recipe.instructions || [],
        sourceUrl: recipe.sourceUrl || recipe.url || '',
        notes: recipe.notes || '',
        folder: recipe.folder || 'All Recipes',
        isFavorite: recipe.isFavorite || false,
        servings: recipe.servings || '',
        prepTime: recipe.prepTime || '',
        cookTime: recipe.cookTime || '',
        totalTime: recipe.totalTime || '',
        extractedAt: recipe.extractedAt || new Date().toISOString(),
        source: recipe.source || 'manual',
        confidence: recipe.confidence || 1,
      };

      const updatedRecipes = [recipeToSave, ...recipes];
      const success = await saveRecipesToStorage(updatedRecipes);

      if (success) {
        setRecipes(updatedRecipes);
        console.log('✅ Recipe saved! Total recipes:', updatedRecipes.length);
        return recipeToSave; // Return the saved recipe with guaranteed ID
      }
      return null;
    } catch (error) {
      console.error('Error saving recipe:', error);
      return null;
    }
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
   * Delete recipe - with optional confirmation skip for bulk operations
   * @param {string} recipeId - ID of recipe to delete
   * @param {boolean} skipConfirmation - Skip the confirmation dialog (for bulk deletes)
   */
  const deleteRecipe = async (recipeId, skipConfirmation = false) => {
    if (skipConfirmation) {
      // Direct deletion without confirmation
      const updated = recipes.filter(r => r.id !== recipeId);
      const success = await saveRecipesToStorage(updated);

      if (success) {
        setRecipes(updated);
        if (selectedRecipe && selectedRecipe.id === recipeId) {
          setSelectedRecipe(null);
        }
        return true;
      }
      return false;
    } else {
      // Normal deletion with confirmation
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
                if (selectedRecipe && selectedRecipe.id === recipeId) {
                  setSelectedRecipe(null);
                }
                resolve(true);
              } else {
                resolve(false);
              }
            }
          }
        ]);
      });
    }
  };

  /**
   * Bulk delete recipes - for multi-select deletion
   * @param {Array<string>} recipeIds - Array of recipe IDs to delete
   */
  const bulkDeleteRecipes = async (recipeIds) => {
    try {
      const updated = recipes.filter(r => !recipeIds.includes(r.id));
      const success = await saveRecipesToStorage(updated);

      if (success) {
        setRecipes(updated);
        if (selectedRecipe && recipeIds.includes(selectedRecipe.id)) {
          setSelectedRecipe(null);
        }
        return recipeIds.length; // Return count of deleted recipes
      }
      return 0;
    } catch (error) {
      console.error('Error bulk deleting recipes:', error);
      return 0;
    }
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
    bulkDeleteRecipes,
    toggleFavorite,
    moveToFolder,
    getFilteredRecipes,
    refreshRecipes: loadRecipes,
  };
};

export default useRecipes;
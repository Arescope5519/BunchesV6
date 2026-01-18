/**
 * useRecipes Hook
 * Manages recipe state and CRUD operations with Supabase sync
 */

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { saveRecipes as saveRecipesToStorage, loadRecipes as loadRecipesFromStorage } from '../utils/storage';
import {
  syncRecipes as syncRecipesWithSupabase,
  saveRecipeToDatabase,
  deleteRecipeFromDatabase,
} from '../services/supabase/database';

export const useRecipes = (user) => {
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [synced, setSynced] = useState(false);

  /**
   * Load saved recipes and sync with Supabase if user is signed in
   */
  const loadRecipes = async () => {
    try {
      setLoadingRecipes(true);
      const userId = user?.uid || null;
      const localRecipes = await loadRecipesFromStorage(userId);

      if (user && !synced) {
        // User is signed in - sync with Supabase
        console.log('🔄 Syncing with Supabase...');
        try {
          const mergedRecipes = await syncRecipesWithSupabase(user.uid, localRecipes);
          await saveRecipesToStorage(mergedRecipes, userId);
          setRecipes(mergedRecipes);
          setSynced(true);
          console.log(`📚 Loaded and synced ${mergedRecipes.length} recipes`);
        } catch (syncError) {
          console.error('Sync failed, using local recipes:', syncError);
          setRecipes(localRecipes);
        }
      } else {
        setRecipes(localRecipes);
        console.log(`📚 Loaded ${localRecipes.length} recipes`);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  };

  /**
   * Quick reload from local storage only
   */
  const reloadFromStorage = async () => {
    const localRecipes = await loadRecipesFromStorage(user?.uid || null);
    setRecipes(localRecipes);
    return localRecipes;
  };

  /**
   * Save recipe
   */
  const saveRecipe = async (recipe) => {
    while (loadingRecipes) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const recipeWithTimestamp = {
      ...recipe,
      id: recipe.id || `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: recipe.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    // Filter out any existing recipe with the same ID to prevent duplicates
    const existingRecipes = recipes.filter(r => r.id !== recipeWithTimestamp.id);
    const updatedRecipes = [recipeWithTimestamp, ...existingRecipes];
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);
      console.log('✅ Recipe saved! Total recipes:', updatedRecipes.length);

      // Sync to Supabase in background
      if (user) {
        console.log('🔄 Syncing recipe to Supabase:', recipeWithTimestamp.title);
        saveRecipeToDatabase(user.uid, recipeWithTimestamp)
          .then(() => console.log('✅ Recipe synced to Supabase'))
          .catch(err => console.error('❌ Supabase sync failed:', err));
      }

      return true;
    }
    return false;
  };

  /**
   * Save multiple recipes at once
   */
  const saveRecipesBatch = async (newRecipes) => {
    if (!newRecipes || newRecipes.length === 0) return false;

    while (loadingRecipes) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const currentRecipes = await loadRecipesFromStorage(user?.uid || null);

    const recipesWithTimestamps = newRecipes.map((recipe, index) => ({
      ...recipe,
      id: recipe.id || `recipe-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: recipe.createdAt || Date.now(),
      updatedAt: Date.now(),
    }));

    // Get IDs of new recipes to filter out duplicates from existing recipes
    const newRecipeIds = new Set(recipesWithTimestamps.map(r => r.id));
    const existingRecipes = currentRecipes.filter(r => !newRecipeIds.has(r.id));
    const updatedRecipes = [...recipesWithTimestamps, ...existingRecipes];
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);
      console.log(`✅ Batch saved ${newRecipes.length} recipes!`);

      // Sync to Supabase in background
      if (user) {
        console.log('🔄 Syncing batch to Supabase...');
        recipesWithTimestamps.forEach(recipe => {
          saveRecipeToDatabase(user.uid, recipe)
            .then(() => console.log(`✅ Synced: ${recipe.title}`))
            .catch(err => console.error(`❌ Failed to sync ${recipe.title}:`, err));
        });
      }

      return true;
    }
    return false;
  };

  /**
   * Update existing recipe
   */
  const updateRecipe = async (updatedRecipe) => {
    const recipeWithTimestamp = {
      ...updatedRecipe,
      updatedAt: Date.now(),
    };

    const updatedRecipes = recipes.map(r =>
      r.id === recipeWithTimestamp.id ? recipeWithTimestamp : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeWithTimestamp.id) {
        setSelectedRecipe(recipeWithTimestamp);
      }

      if (user) {
        saveRecipeToDatabase(user.uid, recipeWithTimestamp).catch(console.error);
      }

      return true;
    }
    return false;
  };

  /**
   * Delete recipe (soft delete)
   */
  const deleteRecipe = async (recipeId) => {
    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, deletedAt: Date.now(), updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);
      setSelectedRecipe(null);

      if (user) {
        deleteRecipeFromDatabase(user.uid, recipeId).catch(console.error);
      }

      return true;
    }
    return false;
  };

  /**
   * Restore deleted recipe
   */
  const restoreRecipe = async (recipeId) => {
    const updatedRecipes = recipes.map(r => {
      if (r.id === recipeId) {
        const { deletedAt, ...restored } = r;
        return { ...restored, updatedAt: Date.now() };
      }
      return r;
    });
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);

      if (user) {
        const restoredRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (restoredRecipe) {
          saveRecipeToDatabase(user.uid, restoredRecipe).catch(console.error);
        }
      }

      Alert.alert('Restored', 'Recipe restored successfully');
      return true;
    }
    return false;
  };

  /**
   * Permanently delete recipe
   */
  const permanentlyDeleteRecipe = async (recipeId) => {
    try {
      const userId = user?.uid || null;
      const currentRecipes = await loadRecipesFromStorage(userId);
      const updated = currentRecipes.filter(r => r.id !== recipeId);
      const success = await saveRecipesToStorage(updated, userId);

      if (!success) return false;

      setRecipes(updated);

      if (user) {
        deleteRecipeFromDatabase(user.uid, recipeId).catch(console.error);
      }

      return true;
    } catch (err) {
      console.error('Permanent delete failed:', err);
      return false;
    }
  };

  /**
   * Empty Recently Deleted
   */
  const emptyRecentlyDeleted = async () => {
    return new Promise((resolve) => {
      const deletedCount = recipes.filter(r => r.deletedAt).length;
      if (deletedCount === 0) {
        Alert.alert('Empty', 'Recently Deleted is already empty');
        resolve(false);
        return;
      }

      Alert.alert(
        'Empty Recently Deleted?',
        `This will permanently delete ${deletedCount} recipe${deletedCount > 1 ? 's' : ''}. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Empty',
            style: 'destructive',
            onPress: async () => {
              const deletedRecipes = recipes.filter(r => r.deletedAt);
              const updated = recipes.filter(r => !r.deletedAt);
              const success = await saveRecipesToStorage(updated, user?.uid || null);

              if (success) {
                setRecipes(updated);

                if (user) {
                  deletedRecipes.forEach(recipe => {
                    deleteRecipeFromDatabase(user.uid, recipe.id).catch(console.error);
                  });
                }

                Alert.alert('Emptied', 'Recently Deleted has been emptied.');
                resolve(true);
              } else {
                resolve(false);
              }
            }
          }
        ]
      );
    });
  };

  /**
   * Toggle favorite status
   */
  const toggleFavorite = async (recipeId) => {
    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, isFavorite: !r.isFavorite, updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);

      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, isFavorite: !selectedRecipe.isFavorite });
      }

      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeToDatabase(user.uid, updatedRecipe).catch(console.error);
        }
      }
    }
  };

  /**
   * Move recipe to folder
   */
  const moveToFolder = async (recipeId, newFolder) => {
    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, folder: newFolder, updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);

      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, folder: newFolder });
      }

      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeToDatabase(user.uid, updatedRecipe).catch(console.error);
        }
      }

      Alert.alert('Success', `Moved to "${newFolder}"`);
      return true;
    }
    return false;
  };

  /**
   * Move multiple recipes to folder
   */
  const moveManyToFolder = async (recipeIds, newFolder) => {
    const recipeIdSet = new Set(recipeIds);
    const updatedRecipes = recipes.map(r =>
      recipeIdSet.has(r.id) ? { ...r, folder: newFolder, updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);

      if (selectedRecipe && recipeIdSet.has(selectedRecipe.id)) {
        setSelectedRecipe({ ...selectedRecipe, folder: newFolder });
      }

      if (user) {
        const movedRecipes = updatedRecipes.filter(r => recipeIdSet.has(r.id));
        movedRecipes.forEach(recipe => {
          saveRecipeToDatabase(user.uid, recipe).catch(console.error);
        });
      }

      return true;
    }
    return false;
  };

  /**
   * Get filtered recipes by folder
   */
  const getFilteredRecipes = (currentFolder) => {
    if (currentFolder === 'Recently Deleted') {
      return recipes.filter(r => r.deletedAt);
    }

    const activeRecipes = recipes.filter(r => !r.deletedAt);

    if (currentFolder === 'All Recipes') {
      return activeRecipes;
    } else if (currentFolder === 'Favorites') {
      return activeRecipes.filter(r => r.isFavorite);
    } else {
      return activeRecipes.filter(r => r.folder === currentFolder);
    }
  };

  useEffect(() => {
    setRecipes([]);
    setSynced(false);
    loadRecipes();
  }, [user?.uid]);

  return {
    recipes,
    loadingRecipes,
    selectedRecipe,
    setSelectedRecipe,
    saveRecipe,
    saveRecipesBatch,
    updateRecipe,
    deleteRecipe,
    restoreRecipe,
    permanentlyDeleteRecipe,
    emptyRecentlyDeleted,
    toggleFavorite,
    moveToFolder,
    moveManyToFolder,
    getFilteredRecipes,
    refreshRecipes: loadRecipes,
    reloadFromStorage,
  };
};

export default useRecipes;

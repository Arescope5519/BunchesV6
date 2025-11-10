/**
 * useRecipes Hook
 * Manages recipe state and CRUD operations
 * Now with Firebase Firestore sync
 */

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { saveRecipes as saveRecipesToStorage, loadRecipes as loadRecipesFromStorage } from '../utils/storage';
import {
  syncRecipes as syncRecipesWithFirestore,
  saveRecipeToFirestore,
  deleteRecipeFromFirestore,
} from '../services/firebase/firestore';

export const useRecipes = (user) => {
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [synced, setSynced] = useState(false);

  /**
   * Load saved recipes and sync with Firestore if user is signed in
   */
  const loadRecipes = async () => {
    try {
      setLoadingRecipes(true);
      const localRecipes = await loadRecipesFromStorage();

      if (user && !synced) {
        // User is signed in - sync with Firestore
        console.log('🔄 Syncing with Firestore...');
        const mergedRecipes = await syncRecipesWithFirestore(user.uid, localRecipes);

        // Save merged recipes locally
        await saveRecipesToStorage(mergedRecipes);
        setRecipes(mergedRecipes);
        setSynced(true);
        console.log(`📚 Loaded and synced ${mergedRecipes.length} recipes`);
      } else {
        // No user or already synced - use local recipes
        setRecipes(localRecipes);
        console.log(`📚 Loaded ${localRecipes.length} recipes`);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
      // Fallback to local recipes
      const localRecipes = await loadRecipesFromStorage();
      setRecipes(localRecipes);
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

    const recipeWithTimestamp = {
      ...recipe,
      createdAt: recipe.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const updatedRecipes = [recipeWithTimestamp, ...recipes];
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);
      console.log('✅ Recipe saved! Total recipes:', updatedRecipes.length);

      // Sync to Firestore in background if user is signed in
      if (user) {
        saveRecipeToFirestore(user.uid, recipeWithTimestamp).catch(err =>
          console.error('Failed to sync recipe to Firestore:', err)
        );
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
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeWithTimestamp.id) {
        setSelectedRecipe(recipeWithTimestamp);
      }

      // Sync to Firestore in background if user is signed in
      if (user) {
        saveRecipeToFirestore(user.uid, recipeWithTimestamp).catch(err =>
          console.error('Failed to sync recipe to Firestore:', err)
        );
      }

      return true;
    }
    return false;
  };

  /**
   * Delete recipe (soft delete - moves to Recently Deleted)
   */
  const deleteRecipe = async (recipeId) => {
    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, deletedAt: Date.now(), updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);
      setSelectedRecipe(null);

      // Sync to Firestore in background if user is signed in
      if (user) {
        const deletedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (deletedRecipe) {
          saveRecipeToFirestore(user.uid, deletedRecipe).catch(err =>
            console.error('Failed to sync deletion to Firestore:', err)
          );
        }
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
        return restored;
      }
      return r;
    });
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);
      Alert.alert('Restored', 'Recipe restored successfully');
      return true;
    }
    return false;
  };

  /**
   * Permanently delete recipe
   */
  const permanentlyDeleteRecipe = async (recipeId) => {
    return new Promise((resolve) => {
      Alert.alert(
        'Permanently Delete?',
        'This will permanently delete the recipe. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Delete Forever',
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
        ]
      );
    });
  };

  /**
   * Empty Recently Deleted (permanently delete all deleted recipes)
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
              const updated = recipes.filter(r => !r.deletedAt);
              const success = await saveRecipesToStorage(updated);

              if (success) {
                setRecipes(updated);
                Alert.alert('Emptied', 'Recently Deleted has been emptied');
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
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);

      // Update selectedRecipe if it's the one being toggled
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, isFavorite: !selectedRecipe.isFavorite });
      }

      // Sync to Firestore in background if user is signed in
      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeToFirestore(user.uid, updatedRecipe).catch(err =>
            console.error('Failed to sync favorite to Firestore:', err)
          );
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
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);

      // Update selectedRecipe if it's the one being moved
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, folder: newFolder });
      }

      // Sync to Firestore in background if user is signed in
      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeToFirestore(user.uid, updatedRecipe).catch(err =>
            console.error('Failed to sync folder move to Firestore:', err)
          );
        }
      }

      Alert.alert('Success', `Moved to "${newFolder}"`);
      return true;
    }
    return false;
  };

  /**
   * Get filtered recipes by folder (excludes deleted recipes except in Recently Deleted)
   */
  const getFilteredRecipes = (currentFolder) => {
    if (currentFolder === 'Recently Deleted') {
      return recipes.filter(r => r.deletedAt);
    }

    // For all other folders, exclude deleted recipes
    const activeRecipes = recipes.filter(r => !r.deletedAt);

    if (currentFolder === 'All Recipes') {
      return activeRecipes;
    } else if (currentFolder === 'Favorites') {
      return activeRecipes.filter(r => r.isFavorite);
    } else {
      return activeRecipes.filter(r => r.folder === currentFolder);
    }
  };

  // Load recipes on mount and when user changes
  useEffect(() => {
    setSynced(false); // Reset sync flag when user changes
    loadRecipes();
  }, [user?.uid]); // Reload when user ID changes

  return {
    recipes,
    loadingRecipes,
    selectedRecipe,
    setSelectedRecipe,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
    restoreRecipe,
    permanentlyDeleteRecipe,
    emptyRecentlyDeleted,
    toggleFavorite,
    moveToFolder,
    getFilteredRecipes,
    refreshRecipes: loadRecipes,
  };
};

export default useRecipes;
/**
 * useRecipes Hook
 * Manages recipe state and CRUD operations
 * Now with Firebase Firestore sync (when available)
 */

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { saveRecipes as saveRecipesToStorage, loadRecipes as loadRecipesFromStorage } from '../utils/storage';
import { isFirestoreAvailable } from '../services/firebase/availability';

// Conditionally import Firestore functions
let syncRecipesWithFirestore = null;
let saveRecipeToFirestore = null;
let deleteRecipeFromFirestore = null;

if (isFirestoreAvailable()) {
  try {
    const firestoreModule = require('../services/firebase/firestore');
    syncRecipesWithFirestore = firestoreModule.syncRecipes;
    saveRecipeToFirestore = firestoreModule.saveRecipeToFirestore;
    deleteRecipeFromFirestore = firestoreModule.deleteRecipeFromFirestore;
  } catch (e) {
    console.error('Failed to load Firestore module:', e);
  }
}

export const useRecipes = (user) => {
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [synced, setSynced] = useState(false);

  /**
   * Load saved recipes and sync with Firestore if user is signed in
   */
  const loadRecipes = async () => {
    console.log(`📂 [LOAD] Starting loadRecipes, user.uid: ${user?.uid}, synced: ${synced}`);
    try {
      setLoadingRecipes(true);
      // Load recipes for the specific user (or global if no user)
      const localRecipes = await loadRecipesFromStorage(user?.uid);
      console.log(`📂 [LOAD] Loaded ${localRecipes.length} recipes from storage`);

      if (user && !synced && syncRecipesWithFirestore) {
        // User is signed in and Firestore is available - sync
        console.log('🔄 [LOAD] Syncing with Firestore...');
        const mergedRecipes = await syncRecipesWithFirestore(user.uid, localRecipes);

        // Save merged recipes locally with user-specific key
        await saveRecipesToStorage(mergedRecipes, user.uid);
        setRecipes(mergedRecipes);
        setSynced(true);
        console.log(`📚 [LOAD] Loaded and synced ${mergedRecipes.length} recipes`);
      } else {
        // No user, already synced, or Firestore not available - use local recipes
        setRecipes(localRecipes);
        console.log(`📚 [LOAD] Loaded ${localRecipes.length} recipes (no sync needed, synced=${synced})`);
      }
    } catch (error) {
      console.error('❌ [LOAD] Failed to load recipes:', error);
      // Fallback to local recipes
      try {
        const localRecipes = await loadRecipesFromStorage(user?.uid);
        setRecipes(localRecipes);
      } catch (fallbackError) {
        console.error('❌ [LOAD] Failed to load local recipes:', fallbackError);
        setRecipes([]);
      }
    } finally {
      setLoadingRecipes(false);
      console.log(`✅ [LOAD] loadRecipes complete`);
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
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid);

    if (success) {
      setRecipes(updatedRecipes);
      console.log('✅ Recipe saved! Total recipes:', updatedRecipes.length);

      // Sync to Firestore in background if user is signed in and Firestore is available
      if (user && saveRecipeToFirestore) {
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
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid);

    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeWithTimestamp.id) {
        setSelectedRecipe(recipeWithTimestamp);
      }

      // Sync to Firestore in background if user is signed in and Firestore is available
      if (user && saveRecipeToFirestore) {
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
    console.log(`🗑️ [DELETE] Starting deletion for recipe ${recipeId}, user.uid: ${user?.uid}`);
    console.log(`🗑️ [DELETE] Current recipes count: ${recipes.length}`);

    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, deletedAt: Date.now(), updatedAt: Date.now() } : r
    );

    console.log(`🗑️ [DELETE] Updated recipes count: ${updatedRecipes.length}`);
    const deletedRecipe = updatedRecipes.find(r => r.id === recipeId);
    console.log(`🗑️ [DELETE] Recipe has deletedAt: ${!!deletedRecipe?.deletedAt}`);

    const success = await saveRecipesToStorage(updatedRecipes, user?.uid);
    console.log(`🗑️ [DELETE] Save to storage success: ${success}`);

    if (success) {
      setRecipes(updatedRecipes);
      setSelectedRecipe(null);
      console.log(`🗑️ [DELETE] State updated, recipes count now: ${updatedRecipes.length}`);

      // Sync to Firestore - MUST await to ensure it completes before app closes
      if (user && saveRecipeToFirestore && deleteRecipeFromFirestore) {
        const deletedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (deletedRecipe) {
          try {
            // Save the recipe with deletedAt flag - AWAIT it!
            await saveRecipeToFirestore(user.uid, deletedRecipe);
            console.log(`✅ Synced soft-deleted recipe ${recipeId} to Firestore`);

            // ALSO track it in deletion list to prevent restoration if sync fails
            // We use the deletion tracking without actually deleting the document
            // This ensures it won't restore even if the deletedAt flag doesn't sync
            const firestore = require('@react-native-firebase/firestore').default;
            await firestore()
              .collection('users')
              .doc(user.uid)
              .set({
                deletedRecipeIds: firestore.FieldValue.arrayUnion(recipeId),
                lastDeletionAt: firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
            console.log(`✅ Tracked soft-deleted recipe ${recipeId} in deletion list`);
          } catch (err) {
            console.error('❌ Failed to sync deletion to Firestore:', err);
            // Don't fail the deletion if Firestore sync fails - deletion tracking will handle restoration prevention
          }
        }
      }

      console.log(`✅ [DELETE] Deletion complete for recipe ${recipeId}`);
      return true;
    }

    console.error(`❌ [DELETE] Failed to save recipes to storage for recipe ${recipeId}`);
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
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid);

    if (success) {
      setRecipes(updatedRecipes);

      // Sync to Firestore if user is signed in
      if (user && saveRecipeToFirestore) {
        const restoredRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (restoredRecipe) {
          saveRecipeToFirestore(user.uid, restoredRecipe).catch(err =>
            console.error('Failed to sync restored recipe to Firestore:', err)
          );

          // Remove from deletion tracking list since it's being restored
          try {
            const firestore = require('@react-native-firebase/firestore').default;
            await firestore()
              .collection('users')
              .doc(user.uid)
              .set({
                deletedRecipeIds: firestore.FieldValue.arrayRemove(recipeId),
              }, { merge: true });
            console.log(`✅ Removed recipe ${recipeId} from deletion tracking list`);
          } catch (err) {
            console.error('Failed to remove from deletion tracking:', err);
          }
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
              const success = await saveRecipesToStorage(updated, user?.uid);

              if (success) {
                setRecipes(updated);
                setSelectedRecipe(null);

                // Delete from Firestore if user is signed in - AWAIT it!
                if (user && deleteRecipeFromFirestore) {
                  try {
                    await deleteRecipeFromFirestore(user.uid, recipeId);
                    console.log(`✅ Deleted recipe ${recipeId} from Firestore`);
                  } catch (err) {
                    console.error('❌ Failed to delete recipe from Firestore:', err);
                    Alert.alert('Warning', 'Recipe deleted locally but may still exist in cloud. Please check your internet connection.');
                  }
                }

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
              const deletedRecipes = recipes.filter(r => r.deletedAt);
              const updated = recipes.filter(r => !r.deletedAt);
              const success = await saveRecipesToStorage(updated, user?.uid);

              if (success) {
                setRecipes(updated);

                // Delete from Firestore if user is signed in - AWAIT all deletions!
                if (user && deleteRecipeFromFirestore) {
                  try {
                    await Promise.all(
                      deletedRecipes.map(recipe =>
                        deleteRecipeFromFirestore(user.uid, recipe.id)
                      )
                    );
                    console.log(`✅ Deleted ${deletedRecipes.length} recipes from Firestore`);
                  } catch (err) {
                    console.error('❌ Failed to delete some recipes from Firestore:', err);
                    Alert.alert('Warning', 'Recipes deleted locally but some may still exist in cloud. Please check your internet connection.');
                  }
                }

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
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid);

    if (success) {
      setRecipes(updatedRecipes);

      // Update selectedRecipe if it's the one being toggled
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, isFavorite: !selectedRecipe.isFavorite });
      }

      // Sync to Firestore in background if user is signed in and Firestore is available
      if (user && saveRecipeToFirestore) {
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
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid);

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
   * Move multiple recipes to folder (for batch operations)
   */
  const moveManyToFolder = async (recipeIds, newFolder) => {
    const recipeIdSet = new Set(recipeIds);
    const updatedRecipes = recipes.map(r =>
      recipeIdSet.has(r.id) ? { ...r, folder: newFolder, updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid);

    if (success) {
      setRecipes(updatedRecipes);

      // Update selectedRecipe if it's one of the ones being moved
      if (selectedRecipe && recipeIdSet.has(selectedRecipe.id)) {
        setSelectedRecipe({ ...selectedRecipe, folder: newFolder });
      }

      // Sync to Firestore in background if user is signed in
      if (user) {
        const movedRecipes = updatedRecipes.filter(r => recipeIdSet.has(r.id));
        movedRecipes.forEach(recipe => {
          saveRecipeToFirestore(user.uid, recipe).catch(err =>
            console.error('Failed to sync folder move to Firestore:', err)
          );
        });
      }

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
    moveManyToFolder,
    getFilteredRecipes,
    refreshRecipes: loadRecipes,
  };
};

export default useRecipes;
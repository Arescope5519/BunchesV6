/**
 * useRecipes Hook
 * Manages recipe state and CRUD operations
 * Now with Firebase Firestore sync (when available)
 */

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { saveRecipes as saveRecipesToStorage, loadRecipes as loadRecipesFromStorage } from '../utils/storage';
import { isFirestoreAvailable } from '../services/firebase/availability';

// Conditionally import Firestore sync function (for initial load)
let syncRecipesWithFirestore = null;

if (isFirestoreAvailable()) {
  try {
    const firestoreModule = require('../services/firebase/firestore');
    syncRecipesWithFirestore = firestoreModule.syncRecipes;
  } catch (e) {
    console.error('Failed to load Firestore module:', e);
  }
}

/**
 * Helper to save a recipe to Firestore - imports directly to avoid conditional import issues
 */
const saveToFirestore = async (userId, recipe) => {
  try {
    const firestore = require('@react-native-firebase/firestore').default;
    const recipeRef = firestore()
      .collection('users')
      .doc(userId)
      .collection('recipes')
      .doc(recipe.id);

    await recipeRef.set(recipe, { merge: true });
    console.log(`✅ Recipe ${recipe.id} synced to Firestore`);
    return true;
  } catch (err) {
    console.error(`Failed to sync recipe ${recipe.id} to Firestore:`, err);
    return false;
  }
};

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

      if (user && !synced && syncRecipesWithFirestore) {
        // User is signed in and Firestore is available - sync
        console.log('🔄 Syncing with Firestore...');
        const mergedRecipes = await syncRecipesWithFirestore(user.uid, localRecipes);

        // Save merged recipes locally
        await saveRecipesToStorage(mergedRecipes);
        setRecipes(mergedRecipes);
        setSynced(true);
        console.log(`📚 Loaded and synced ${mergedRecipes.length} recipes`);
      } else {
        // No user, already synced, or Firestore not available - use local recipes
        setRecipes(localRecipes);
        console.log(`📚 Loaded ${localRecipes.length} recipes`);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
      // Fallback to local recipes
      try {
        const localRecipes = await loadRecipesFromStorage();
        setRecipes(localRecipes);
      } catch (fallbackError) {
        console.error('Failed to load local recipes:', fallbackError);
        setRecipes([]);
      }
    } finally {
      setLoadingRecipes(false);
    }
  };

  /**
   * Quick reload from local storage only (no Firestore sync)
   */
  const reloadFromStorage = async () => {
    const localRecipes = await loadRecipesFromStorage();
    setRecipes(localRecipes);
    return localRecipes;
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
        saveToFirestore(user.uid, recipeWithTimestamp);
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
        saveToFirestore(user.uid, recipeWithTimestamp);
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

      // Sync to Firestore - MUST await to ensure it completes before app closes
      if (user) {
        const deletedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (deletedRecipe) {
          try {
            const firestore = require('@react-native-firebase/firestore').default;

            // FIRST: Track it in deletion list to prevent restoration
            // This is the most important step - even if other sync fails
            await firestore()
              .collection('users')
              .doc(user.uid)
              .set({
                deletedRecipeIds: firestore.FieldValue.arrayUnion(recipeId),
                lastDeletionAt: firestore.FieldValue.serverTimestamp(),
              }, { merge: true });

            // Save the recipe with deletedAt flag using direct import
            await saveToFirestore(user.uid, deletedRecipe);

            // CRITICAL: Wait for server confirmation
            await firestore().waitForPendingWrites();

            console.log(`✅ Soft-deleted recipe ${recipeId} synced and confirmed with server`);
          } catch (err) {
            console.error('Failed to sync deletion to Firestore:', err);
            // Don't fail the deletion if Firestore sync fails - local deletion still works
          }
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
        return { ...restored, updatedAt: Date.now() };
      }
      return r;
    });
    const success = await saveRecipesToStorage(updatedRecipes);

    if (success) {
      setRecipes(updatedRecipes);

      // Sync to Firestore if user is signed in
      if (user) {
        const restoredRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (restoredRecipe) {
          try {
            const firestore = require('@react-native-firebase/firestore').default;

            // Remove from deletion tracking list FIRST
            await firestore()
              .collection('users')
              .doc(user.uid)
              .set({
                deletedRecipeIds: firestore.FieldValue.arrayRemove(recipeId),
              }, { merge: true });

            // Save the restored recipe using direct import
            await saveToFirestore(user.uid, restoredRecipe);

            // Wait for server confirmation
            await firestore().waitForPendingWrites();

            console.log(`✅ Restored recipe ${recipeId} and confirmed with server`);
          } catch (err) {
            console.error('Failed to sync restored recipe:', err);
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
            onPress: () => {
              // Use non-async wrapper to avoid silent failures in Alert callbacks
              (async () => {
                try {
                  console.log('🗑️ Starting permanent delete for recipe:', recipeId);

                  // Load fresh from storage to avoid stale closure issues
                  const currentRecipes = await loadRecipesFromStorage();
                  const updated = currentRecipes.filter(r => r.id !== recipeId);

                  const success = await saveRecipesToStorage(updated);

                  if (success) {
                    // Update UI immediately
                    setRecipes(updated);
                    setSelectedRecipe(null);

                    // Resolve immediately so UI updates right away
                    resolve(true);

                    // Sync to Firestore in background (don't wait for it)
                    if (user) {
                      (async () => {
                        try {
                          const firestore = require('@react-native-firebase/firestore').default;

                          await firestore()
                            .collection('users')
                            .doc(user.uid)
                            .set({
                              deletedRecipeIds: firestore.FieldValue.arrayUnion(recipeId),
                              lastDeletionAt: firestore.FieldValue.serverTimestamp(),
                            }, { merge: true });

                          await firestore()
                            .collection('users')
                            .doc(user.uid)
                            .collection('recipes')
                            .doc(recipeId)
                            .delete();

                          await firestore().waitForPendingWrites();
                          console.log('✅ Firestore sync complete for deleted recipe');
                        } catch (err) {
                          console.error('❌ Firestore sync failed:', err);
                        }
                      })();
                    }
                  } else {
                    Alert.alert('Error', 'Failed to delete recipe locally.');
                    resolve(false);
                  }
                } catch (err) {
                  console.error('🗑️ Permanent delete failed:', err);
                  Alert.alert('Error', `Delete failed: ${err.message}`);
                  resolve(false);
                }
              })();
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
              const success = await saveRecipesToStorage(updated);

              if (success) {
                setRecipes(updated);

                // Delete from Firestore if user is signed in
                if (user) {
                  try {
                    // Show syncing message
                    Alert.alert('Syncing...', `Deleting ${deletedRecipes.length} recipes from cloud. Please wait.`);

                    // Import firestore directly to ensure it's available
                    const firestore = require('@react-native-firebase/firestore').default;

                    // Track all deletions first
                    const recipeIdsToDelete = deletedRecipes.map(r => r.id);
                    await firestore()
                      .collection('users')
                      .doc(user.uid)
                      .set({
                        deletedRecipeIds: firestore.FieldValue.arrayUnion(...recipeIdsToDelete),
                        lastDeletionAt: firestore.FieldValue.serverTimestamp(),
                      }, { merge: true });

                    // Delete all recipe documents
                    const batch = firestore().batch();
                    deletedRecipes.forEach(recipe => {
                      const recipeRef = firestore()
                        .collection('users')
                        .doc(user.uid)
                        .collection('recipes')
                        .doc(recipe.id);
                      batch.delete(recipeRef);
                    });
                    await batch.commit();

                    // Wait for server confirmation
                    await firestore().waitForPendingWrites();

                    Alert.alert('✅ Emptied', `${deletedRecipes.length} recipes permanently deleted and synced to cloud.`);
                  } catch (err) {
                    console.error('❌ Failed to delete some recipes from Firestore:', err);
                    Alert.alert('Warning', `Recipes deleted locally but cloud sync failed: ${err.message}`);
                  }
                } else {
                  Alert.alert('Emptied', 'Recently Deleted has been emptied. Sign in to sync deletions to cloud.');
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
          saveToFirestore(user.uid, updatedRecipe);
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
          saveToFirestore(user.uid, updatedRecipe);
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
    const success = await saveRecipesToStorage(updatedRecipes);

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
          saveToFirestore(user.uid, recipe);
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
    reloadFromStorage,
  };
};

export default useRecipes;
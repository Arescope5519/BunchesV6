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
  saveRecipeWithDualWrite,
} from '../services/supabase/database';
import { MY_CREATIONS_FOLDER } from './useFolders';

/**
 * Check if a recipe is custom (created by user, not imported from URL)
 */
const isCustomRecipe = (recipe) => {
  const url = recipe.url || recipe.sourceUrl || recipe.source_url;
  return !url || url.startsWith('bunches://');
};

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
      console.log(`📱 Loading recipes... User: ${userId ? 'logged in' : 'not logged in'}`);

      const localRecipes = await loadRecipesFromStorage(userId);
      const deletedCount = localRecipes.filter(r => r.deletedAt).length;
      console.log(`📦 Local storage: ${localRecipes.length} recipes (${deletedCount} deleted)`);
      // Debug image_url presence
      const recipesWithImages = localRecipes.filter(r => r.image_url && !r.deletedAt);
      console.log(`📷 Recipes with image_url: ${recipesWithImages.length}`);
      if (recipesWithImages.length > 0) {
        console.log(`📷 Sample image_url:`, recipesWithImages[0].image_url?.substring(0, 80));
      }

      if (user && !synced) {
        // User is signed in - sync with Supabase
        console.log('🔄 Syncing with Supabase...');
        try {
          const mergedRecipes = await syncRecipesWithSupabase(user.uid, localRecipes);
          await saveRecipesToStorage(mergedRecipes, userId);
          setRecipes(mergedRecipes);
          setSynced(true);
          const mergedDeletedCount = mergedRecipes.filter(r => r.deletedAt).length;
          console.log(`📚 Synced: ${mergedRecipes.length} recipes (${mergedDeletedCount} deleted)`);
        } catch (syncError) {
          console.error('Sync failed, using local recipes:', syncError);
          setRecipes(localRecipes);
        }
      } else {
        setRecipes(localRecipes);
        console.log(`📚 Loaded ${localRecipes.length} recipes (no sync needed)`);
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
  const saveRecipe = async (recipe, options = {}) => {
    const { silent = false } = options;
    // Note: Removed wait-for-loading loop as it caused delays
    // The save can proceed even during initial load

    // Check for duplicate by URL first (more reliable than ID for imported recipes)
    const recipeUrl = recipe.url || recipe.sourceUrl || recipe.source_url;
    if (recipeUrl) {
      const existingByUrl = recipes.find(r => {
        const rUrl = r.url || r.sourceUrl || r.source_url;
        return rUrl && rUrl === recipeUrl && !r.deletedAt;
      });
      if (existingByUrl) {
        console.log(`⚠️ Recipe already exists with URL: ${recipeUrl}`);
        return true; // Already exists, consider it a success
      }
    }

    // Build folders array - auto-add custom recipes to "My Creations"
    let recipeFolders = Array.isArray(recipe.folders) ? [...recipe.folders] :
                        (recipe.folder ? [recipe.folder] : ['All Recipes']);

    // If this is a custom recipe (no external URL), ensure it's in My Creations
    if (isCustomRecipe(recipe) && !recipeFolders.some(f => f === MY_CREATIONS_FOLDER || f.startsWith(MY_CREATIONS_FOLDER + '/'))) {
      recipeFolders.push(MY_CREATIONS_FOLDER);
    }

    const recipeWithTimestamp = {
      ...recipe,
      id: recipe.id || `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      folders: recipeFolders,
      createdAt: recipe.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    // Filter out any existing recipe with the same ID to prevent duplicates
    const existingRecipes = recipes.filter(r => r.id !== recipeWithTimestamp.id);
    const updatedRecipes = [recipeWithTimestamp, ...existingRecipes];
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);
      console.log('✅ Recipe saved locally! Total recipes:', updatedRecipes.length);

      // Sync to Supabase - wait for it to complete
      if (user) {
        console.log('🔄 Syncing recipe to Supabase:', recipeWithTimestamp.title);
        try {
          await saveRecipeWithDualWrite(user.uid, recipeWithTimestamp);
          console.log('✅ Recipe synced to Supabase');
        } catch (err) {
          console.error('❌ Supabase sync failed:', err);
          // Still return true since local save succeeded
          // But alert the user with the error
          if (!silent) {
            const errorMsg = err?.message || err?.toString() || 'Unknown error';
            Alert.alert('Sync Warning', `Recipe saved locally but cloud sync failed: ${errorMsg}`);
          }
        }
      } else {
        console.log('⚠️ No user logged in - recipe only saved locally');
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

    // Build set of existing URLs for duplicate detection
    const existingUrls = new Set(
      currentRecipes
        .filter(r => !r.deletedAt)
        .map(r => r.url || r.sourceUrl || r.source_url)
        .filter(Boolean)
    );

    // Filter out recipes that already exist by URL
    const uniqueNewRecipes = newRecipes.filter(recipe => {
      const recipeUrl = recipe.url || recipe.sourceUrl || recipe.source_url;
      if (recipeUrl && existingUrls.has(recipeUrl)) {
        console.log(`⚠️ Skipping duplicate recipe (URL exists): ${recipe.title || recipeUrl}`);
        return false;
      }
      return true;
    });

    if (uniqueNewRecipes.length === 0) {
      console.log('⚠️ All recipes already exist, nothing to save');
      return true; // Consider it success
    }

    const recipesWithTimestamps = uniqueNewRecipes.map((recipe, index) => ({
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
      console.log(`✅ Batch saved ${uniqueNewRecipes.length} recipes!`);

      // Sync to Supabase in background
      if (user) {
        console.log('🔄 Syncing batch to Supabase...');
        recipesWithTimestamps.forEach(recipe => {
          saveRecipeWithDualWrite(user.uid, recipe)
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
   * Automatically tracks edits for imported recipes
   */
  const updateRecipe = async (updatedRecipe, editDescription = '') => {
    // Find the original recipe to check if it was imported from URL
    const originalRecipe = recipes.find(r => r.id === updatedRecipe.id);

    let recipeWithTimestamp = {
      ...updatedRecipe,
      updatedAt: Date.now(),
    };

    // If this is an imported recipe (has originalRecipe), track the edit
    if (originalRecipe && originalRecipe.originalRecipe) {
      const editHistory = originalRecipe.editHistory || [];
      recipeWithTimestamp = {
        ...recipeWithTimestamp,
        hasEdits: true,
        viewingOriginal: false, // Always show edited version after edit
        editHistory: [
          ...editHistory,
          {
            timestamp: Date.now(),
            description: editDescription || 'Recipe modified',
          }
        ],
      };
    }

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
        saveRecipeWithDualWrite(user.uid, recipeWithTimestamp).catch(console.error);
      }

      return true;
    }
    return false;
  };

  /**
   * Delete recipe (soft delete)
   */
  const deleteRecipe = async (recipeId) => {
    const recipeToDelete = recipes.find(r => r.id === recipeId);
    console.log(`🗑️ Deleting recipe: "${recipeToDelete?.title}" (ID: ${recipeId})`);

    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, deletedAt: Date.now(), updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      console.log(`✅ Recipe marked as deleted locally`);
      setRecipes(updatedRecipes);
      setSelectedRecipe(null);

      // Sync deletion to database
      if (user) {
        console.log(`🔄 Syncing deletion to Supabase...`);
        try {
          await deleteRecipeFromDatabase(user.uid, recipeId);
          console.log(`✅ Recipe deleted from Supabase`);
        } catch (dbError) {
          console.error(`❌ Failed to delete from Supabase:`, dbError);
          // Still return true since local delete succeeded
        }
      } else {
        console.log(`⚠️ No user logged in, skipping Supabase sync`);
      }

      return true;
    }
    console.error(`❌ Failed to save deleted recipe to local storage`);
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
          saveRecipeWithDualWrite(user.uid, restoredRecipe).catch(console.error);
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
          saveRecipeWithDualWrite(user.uid, updatedRecipe).catch(console.error);
        }
      }
    }
  };

  /**
   * Update recipe stats (likes, saves, views)
   */
  const updateRecipeStats = async (recipeId, statType, increment = 1) => {
    const updatedRecipes = recipes.map(r => {
      if (r.id === recipeId) {
        const currentStats = r.stats || { likes: 0, saves: 0, views: 0 };
        return {
          ...r,
          stats: {
            ...currentStats,
            [statType]: (currentStats[statType] || 0) + increment,
          },
          updatedAt: Date.now(),
        };
      }
      return r;
    });

    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);
    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        const updated = updatedRecipes.find(r => r.id === recipeId);
        setSelectedRecipe(updated);
      }

      // Sync to Supabase
      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeWithDualWrite(user.uid, updatedRecipe).catch(err =>
            console.error('Failed to sync stats to Supabase:', err)
          );
        }
      }
    }
  };

  /**
   * Toggle between original and edited version of a recipe
   * For recipes imported from URLs that have been modified
   */
  const toggleRecipeVersion = async (recipeId, showOriginal) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe || !recipe.originalRecipe) {
      return false;
    }

    if (showOriginal) {
      // Store current edited version before switching to original
      const editedVersion = {
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        total_time: recipe.total_time,
        servings: recipe.servings,
        nutrition: recipe.nutrition,
        image_url: recipe.image_url,
      };

      const updatedRecipes = recipes.map(r => {
        if (r.id === recipeId) {
          return {
            ...r,
            // Save edited version
            editedVersion: editedVersion,
            // Apply original version
            title: r.originalRecipe.title,
            ingredients: r.originalRecipe.ingredients,
            instructions: r.originalRecipe.instructions,
            prep_time: r.originalRecipe.prep_time,
            cook_time: r.originalRecipe.cook_time,
            total_time: r.originalRecipe.total_time,
            servings: r.originalRecipe.servings,
            nutrition: r.originalRecipe.nutrition,
            image_url: r.originalRecipe.image_url || r.originalRecipe.image,
            viewingOriginal: true,
            updatedAt: Date.now(),
          };
        }
        return r;
      });

      const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);
      if (success) {
        setRecipes(updatedRecipes);
        if (selectedRecipe && selectedRecipe.id === recipeId) {
          const updated = updatedRecipes.find(r => r.id === recipeId);
          setSelectedRecipe(updated);
        }
        return true;
      }
    } else {
      // Switch back to edited version
      if (!recipe.editedVersion && !recipe.hasEdits) {
        // No edits exist, nothing to toggle to
        return false;
      }

      const editedData = recipe.editedVersion || {};
      const updatedRecipes = recipes.map(r => {
        if (r.id === recipeId) {
          return {
            ...r,
            // Apply edited version (or keep current if no saved edited version)
            title: editedData.title || r.title,
            ingredients: editedData.ingredients || r.ingredients,
            instructions: editedData.instructions || r.instructions,
            prep_time: editedData.prep_time || r.prep_time,
            cook_time: editedData.cook_time || r.cook_time,
            total_time: editedData.total_time || r.total_time,
            servings: editedData.servings || r.servings,
            nutrition: editedData.nutrition || r.nutrition,
            image_url: editedData.image_url || editedData.image || r.image_url,
            viewingOriginal: false,
            updatedAt: Date.now(),
          };
        }
        return r;
      });

      const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);
      if (success) {
        setRecipes(updatedRecipes);
        if (selectedRecipe && selectedRecipe.id === recipeId) {
          const updated = updatedRecipes.find(r => r.id === recipeId);
          setSelectedRecipe(updated);
        }
        return true;
      }
    }

    return false;
  };

  /**
   * Mark a recipe as having edits (called when user modifies an imported recipe)
   */
  const markRecipeAsEdited = async (recipeId, editDescription = '') => {
    const updatedRecipes = recipes.map(r => {
      if (r.id === recipeId) {
        const editHistory = r.editHistory || [];
        return {
          ...r,
          hasEdits: true,
          editHistory: [
            ...editHistory,
            {
              timestamp: Date.now(),
              description: editDescription,
            }
          ],
          updatedAt: Date.now(),
        };
      }
      return r;
    });

    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);
    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        const updated = updatedRecipes.find(r => r.id === recipeId);
        setSelectedRecipe(updated);
      }

      // Sync to Supabase
      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeWithDualWrite(user.uid, updatedRecipe).catch(err =>
            console.error('Failed to sync edit status to Supabase:', err)
          );
        }
      }
      return true;
    }
    return false;
  };

  /**
   * Select a variant for a recipe
   */
  const selectVariant = async (recipeId, variantId) => {
    const updatedRecipes = recipes.map(r => {
      if (r.id === recipeId) {
        return {
          ...r,
          selectedVariantId: variantId,
          viewingOriginal: variantId === null,
          updatedAt: Date.now(),
        };
      }
      return r;
    });

    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);
    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        const updated = updatedRecipes.find(r => r.id === recipeId);
        setSelectedRecipe(updated);
      }

      // Sync to Supabase
      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeWithDualWrite(user.uid, updatedRecipe).catch(err =>
            console.error('Failed to sync variant selection to Supabase:', err)
          );
        }
      }
      return true;
    }
    return false;
  };

  /**
   * Create a new variant for a recipe (copies current state as starting point)
   */
  const createVariant = async (recipeId, variantName) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return false;

    const newVariantId = `variant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newVariant = {
      id: newVariantId,
      name: variantName,
      edits: {
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
      },
      createdAt: Date.now(),
    };

    const updatedRecipes = recipes.map(r => {
      if (r.id === recipeId) {
        const existingVariants = r.variants || [];
        return {
          ...r,
          variants: [...existingVariants, newVariant],
          selectedVariantId: newVariantId,
          hasEdits: true,
          updatedAt: Date.now(),
        };
      }
      return r;
    });

    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);
    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        const updated = updatedRecipes.find(r => r.id === recipeId);
        setSelectedRecipe(updated);
      }

      // Sync to Supabase
      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeWithDualWrite(user.uid, updatedRecipe).catch(err =>
            console.error('Failed to sync new variant to Supabase:', err)
          );
        }
      }
      return true;
    }
    return false;
  };

  /**
   * Delete a variant from a recipe
   */
  const deleteVariant = async (recipeId, variantId) => {
    const updatedRecipes = recipes.map(r => {
      if (r.id === recipeId) {
        const existingVariants = r.variants || [];
        const filteredVariants = existingVariants.filter(v => v.id !== variantId);
        return {
          ...r,
          variants: filteredVariants,
          selectedVariantId: r.selectedVariantId === variantId ? null : r.selectedVariantId,
          hasEdits: filteredVariants.length > 0 || r.editedVersion != null,
          updatedAt: Date.now(),
        };
      }
      return r;
    });

    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);
    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        const updated = updatedRecipes.find(r => r.id === recipeId);
        setSelectedRecipe(updated);
      }

      // Sync to Supabase
      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeWithDualWrite(user.uid, updatedRecipe).catch(err =>
            console.error('Failed to sync variant deletion to Supabase:', err)
          );
        }
      }
      return true;
    }
    return false;
  };

  /**
   * Move recipe to folder (replaces all folders with the new one)
   */
  const moveToFolder = async (recipeId, newFolder) => {
    const newFolders = [newFolder];
    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, folder: newFolder, folders: newFolders, updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);

      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, folder: newFolder, folders: newFolders });
      }

      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeWithDualWrite(user.uid, updatedRecipe).catch(console.error);
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
          saveRecipeWithDualWrite(user.uid, recipe).catch(console.error);
        });
      }

      return true;
    }
    return false;
  };

  /**
   * Get filtered recipes by folder
   * Supports multi-folder: checks both `folders` array and legacy `folder` field
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
      return activeRecipes.filter(r => {
        const recipeFolders = r.folders || [r.folder || 'All Recipes'];
        return recipeFolders.includes(currentFolder);
      });
    }
  };

  /**
   * Add recipe to a folder (multi-folder support)
   * Keeps recipe in existing folders and adds to new folder
   * @param {boolean} silent - If true, don't show alerts (for batch operations)
   */
  const addToFolder = async (recipeId, folderToAdd, silent = false) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return false;

    const currentFolders = recipe.folders || [recipe.folder || 'All Recipes'];
    if (currentFolders.includes(folderToAdd)) {
      return true;
    }

    const newFolders = [...currentFolders, folderToAdd];
    const primaryFolder = newFolders.find(f => f !== 'All Recipes') || newFolders[0];

    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, folders: newFolders, folder: primaryFolder, updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, folders: newFolders, folder: primaryFolder });
      }
      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeWithDualWrite(user.uid, updatedRecipe).catch(console.error);
        }
      }
      if (!silent) {
        Alert.alert('Success', `Added to "${folderToAdd}"`);
      }
      return true;
    }
    return false;
  };

  /**
   * Remove recipe from a folder (multi-folder support)
   * Keeps recipe in other folders
   * @param {boolean} silent - If true, don't show alerts (for batch operations)
   */
  const removeFromFolder = async (recipeId, folderToRemove, silent = false) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return false;

    const currentFolders = recipe.folders || [recipe.folder || 'All Recipes'];
    if (!currentFolders.includes(folderToRemove)) {
      return true;
    }

    let newFolders = currentFolders.filter(f => f !== folderToRemove);
    if (newFolders.length === 0) {
      newFolders = ['All Recipes'];
    }
    const primaryFolder = newFolders.find(f => f !== 'All Recipes') || newFolders[0];

    const updatedRecipes = recipes.map(r =>
      r.id === recipeId ? { ...r, folders: newFolders, folder: primaryFolder, updatedAt: Date.now() } : r
    );
    const success = await saveRecipesToStorage(updatedRecipes, user?.uid || null);

    if (success) {
      setRecipes(updatedRecipes);
      if (selectedRecipe && selectedRecipe.id === recipeId) {
        setSelectedRecipe({ ...selectedRecipe, folders: newFolders, folder: primaryFolder });
      }
      if (user) {
        const updatedRecipe = updatedRecipes.find(r => r.id === recipeId);
        if (updatedRecipe) {
          saveRecipeWithDualWrite(user.uid, updatedRecipe).catch(console.error);
        }
      }
      if (!silent) {
        Alert.alert('Success', `Removed from "${folderToRemove}"`);
      }
      return true;
    }
    return false;
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
    addToFolder,
    removeFromFolder,
    getFilteredRecipes,
    refreshRecipes: loadRecipes,
    reloadFromStorage,
    // Stats tracking
    updateRecipeStats,
    // Version management
    toggleRecipeVersion,
    markRecipeAsEdited,
    // Variant management
    selectVariant,
    createVariant,
    deleteVariant,
  };
};

export default useRecipes;

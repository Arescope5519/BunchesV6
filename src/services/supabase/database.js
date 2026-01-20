/**
 * Supabase Database Service
 * Handles recipes, folders, and data synchronization
 */

import { supabase } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = '@last_sync_timestamp';

/**
 * Save recipes to Supabase for a user
 * @param {string} userId - User's unique ID
 * @param {Array} recipes - Array of recipe objects
 */
export const saveRecipesToDatabase = async (userId, recipes) => {
  try {
    const recipesToUpsert = recipes.map(recipe => {
      // Handle createdAt - could be number, string, or Date
      let createdAtISO;
      if (recipe.createdAt) {
        if (typeof recipe.createdAt === 'number') {
          createdAtISO = new Date(recipe.createdAt).toISOString();
        } else if (typeof recipe.createdAt === 'string') {
          createdAtISO = new Date(recipe.createdAt).toISOString();
        } else {
          createdAtISO = new Date().toISOString();
        }
      } else {
        createdAtISO = new Date().toISOString();
      }

      return {
        id: recipe.id,
        user_id: userId,
        title: recipe.title || 'Untitled Recipe',
        ingredients: recipe.ingredients || '',
        instructions: recipe.instructions || '',
        folder: recipe.folder || 'All Recipes',
        source_url: recipe.sourceUrl || recipe.source_url || null,
        image_url: recipe.imageUrl || recipe.image_url || recipe.image || null,
        notes: recipe.notes || null,
        prep_time: recipe.prep_time || recipe.prepTime || null,
        cook_time: recipe.cook_time || recipe.cookTime || null,
        servings: recipe.servings || null,
        tags: recipe.tags || [],
        deleted_at: recipe.deletedAt ? new Date(recipe.deletedAt).toISOString() : null,
        created_at: createdAtISO,
        updated_at: new Date().toISOString(),
      };
    });

    // Filter out any recipes that somehow still don't have an ID
    const validRecipes = recipesToUpsert.filter(r => r.id);

    if (validRecipes.length === 0) {
      console.log('⚠️ No valid recipes to save (all missing IDs)');
      return;
    }

    const { error } = await supabase
      .from('recipes')
      .upsert(validRecipes, { onConflict: 'id' });

    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }

    console.log(`✅ Saved ${validRecipes.length} recipes to Supabase`);
  } catch (error) {
    console.error('❌ Error saving recipes:', error);
    throw error;
  }
};

/**
 * Load recipes from Supabase for a user
 * @param {string} userId - User's unique ID
 * @returns {Promise<Array>} Array of recipes
 */
export const loadRecipesFromDatabase = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;

    const recipes = data.map(row => ({
      id: row.id,
      title: row.title,
      ingredients: row.ingredients,
      instructions: row.instructions,
      folder: row.folder,
      source_url: row.source_url,
      image_url: row.image_url,
      notes: row.notes,
      prep_time: row.prep_time,
      cook_time: row.cook_time,
      servings: row.servings,
      tags: row.tags || [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));

    console.log(`📚 Loaded ${recipes.length} recipes from Supabase`);
    return recipes;
  } catch (error) {
    console.error('❌ Error loading recipes:', error);
    throw error;
  }
};

/**
 * Save a single recipe
 * @param {string} userId - User's unique ID
 * @param {Object} recipe - Recipe object
 */
export const saveRecipeToDatabase = async (userId, recipe) => {
  try {
    const imageUrl = recipe.imageUrl || recipe.image_url;
    console.log('📸 Saving recipe with image_url:', imageUrl);

    const { error } = await supabase
      .from('recipes')
      .upsert({
        id: recipe.id,
        user_id: userId,
        title: recipe.title,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        folder: recipe.folder,
        source_url: recipe.sourceUrl || recipe.source_url,
        image_url: imageUrl,
        notes: recipe.notes,
        tags: recipe.tags || [],
        created_at: recipe.createdAt ? new Date(recipe.createdAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) throw error;

    console.log(`✅ Saved recipe "${recipe.title}"`);
  } catch (error) {
    console.error('❌ Error saving recipe:', error);
    throw error;
  }
};

/**
 * Delete a recipe (soft delete)
 * @param {string} userId - User's unique ID
 * @param {string} recipeId - Recipe ID
 */
export const deleteRecipeFromDatabase = async (userId, recipeId) => {
  try {
    const { error } = await supabase
      .from('recipes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', recipeId)
      .eq('user_id', userId);

    if (error) throw error;

    console.log(`✅ Deleted recipe ${recipeId}`);
  } catch (error) {
    console.error('❌ Error deleting recipe:', error);
    throw error;
  }
};

/**
 * Sync recipes between local storage and Supabase
 * @param {string} userId - User's unique ID
 * @param {Array} localRecipes - Local recipes
 * @returns {Promise<Array>} Merged recipes
 */
export const syncRecipes = async (userId, localRecipes) => {
  try {
    console.log('🔄 Starting recipe sync...');
    console.log(`📦 Local recipes to sync: ${localRecipes.length}`);

    // Debug: Log deleted recipes
    const deletedLocal = localRecipes.filter(r => r.deletedAt);
    console.log(`🗑️ Locally deleted recipes: ${deletedLocal.length}`);
    deletedLocal.forEach(r => console.log(`  - "${r.title}" (deletedAt: ${r.deletedAt})`));

    // Ensure all local recipes have IDs (for pre-migration data)
    const localRecipesWithIds = localRecipes.map(recipe => {
      if (!recipe.id) {
        console.log(`⚠️ Recipe "${recipe.title}" missing ID, generating one...`);
        return {
          ...recipe,
          id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: recipe.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
      }
      return recipe;
    });

    // Load ALL recipes from database (including deleted) to check sync status
    const { data: allDbData, error: allDbError } = await supabase
      .from('recipes')
      .select('id, deleted_at, updated_at')
      .eq('user_id', userId);

    if (allDbError) throw allDbError;

    const dbDeletedMap = new Map(allDbData.map(r => [r.id, r.deleted_at]));

    // Load non-deleted from database for merge
    const dbRecipes = await loadRecipesFromDatabase(userId);
    console.log(`☁️ Database recipes: ${dbRecipes.length}`);

    // Create maps for quick lookup
    const dbMap = new Map(dbRecipes.map(r => [r.id, r]));
    const localMap = new Map(localRecipesWithIds.map(r => [r.id, r]));

    const mergedRecipes = [];
    const recipesToUpload = [];
    const recipesToDelete = [];

    // Track locally deleted recipe IDs to ensure they don't come back
    const locallyDeletedIds = new Set(
      localRecipesWithIds.filter(r => r.deletedAt).map(r => r.id)
    );

    // Process local recipes
    localRecipesWithIds.forEach(localRecipe => {
      const dbRecipe = dbMap.get(localRecipe.id);
      const dbDeletedAt = dbDeletedMap.get(localRecipe.id);

      if (localRecipe.deletedAt) {
        // Recipe is deleted locally - ALWAYS keep local deleted version
        if (!dbDeletedAt) {
          // But not deleted in database - sync the deletion
          console.log(`🗑️ Syncing deletion for: "${localRecipe.title}"`);
          recipesToDelete.push(localRecipe.id);
        }
        // Keep in merged for "Recently Deleted" functionality
        mergedRecipes.push(localRecipe);
        return;
      }

      if (!dbRecipe) {
        // Only in local - upload it
        console.log(`📤 Uploading local recipe: "${localRecipe.title}"`);
        recipesToUpload.push(localRecipe);
        mergedRecipes.push(localRecipe);
      } else {
        // Exists in both - keep newer
        const localTime = localRecipe.updatedAt || localRecipe.createdAt || 0;
        const dbTime = dbRecipe.updatedAt || dbRecipe.createdAt || 0;

        if (localTime > dbTime) {
          recipesToUpload.push(localRecipe);
          mergedRecipes.push(localRecipe);
        } else {
          mergedRecipes.push(dbRecipe);
        }
      }
    });

    // Add recipes only in database (not in local AND not locally deleted)
    dbRecipes.forEach(dbRecipe => {
      // Don't add back recipes that are locally deleted
      if (!localMap.has(dbRecipe.id) && !locallyDeletedIds.has(dbRecipe.id)) {
        mergedRecipes.push(dbRecipe);
      }
    });

    // Upload local changes
    if (recipesToUpload.length > 0) {
      console.log(`📤 Uploading ${recipesToUpload.length} recipes to database...`);
      await saveRecipesToDatabase(userId, recipesToUpload);
    } else {
      console.log('✓ No new recipes to upload');
    }

    // Sync deletions to database
    if (recipesToDelete.length > 0) {
      console.log(`🗑️ Syncing ${recipesToDelete.length} deletions to database...`);
      for (const recipeId of recipesToDelete) {
        await deleteRecipeFromDatabase(userId, recipeId);
      }
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

    // Debug: Log merged results
    const deletedInMerged = mergedRecipes.filter(r => r.deletedAt);
    const activeInMerged = mergedRecipes.filter(r => !r.deletedAt);
    console.log(`✅ Sync complete. ${mergedRecipes.length} total recipes`);
    console.log(`   - Active: ${activeInMerged.length}, Deleted: ${deletedInMerged.length}`);
    return mergedRecipes;
  } catch (error) {
    console.error('❌ Error syncing recipes:', error);
    throw error;
  }
};

/**
 * Save folders to database
 * @param {string} userId - User's unique ID
 * @param {Array} folders - Array of folder names
 */
export const saveFoldersToDatabase = async (userId, folders) => {
  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        folders: folders,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;

    console.log(`✅ Saved ${folders.length} folders`);
  } catch (error) {
    console.error('❌ Error saving folders:', error);
    throw error;
  }
};

/**
 * Load folders from database
 * @param {string} userId - User's unique ID
 * @returns {Promise<Array>} Array of folder names
 */
export const loadFoldersFromDatabase = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('folders')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const folders = data?.folders || [];
    console.log(`✅ Loaded ${folders.length} folders`);
    return folders;
  } catch (error) {
    console.error('❌ Error loading folders:', error);
    return [];
  }
};

export default {
  saveRecipesToDatabase,
  loadRecipesFromDatabase,
  saveRecipeToDatabase,
  deleteRecipeFromDatabase,
  syncRecipes,
  saveFoldersToDatabase,
  loadFoldersFromDatabase,
};

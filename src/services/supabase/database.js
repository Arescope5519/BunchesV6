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
    const recipesToUpsert = recipes.map(recipe => ({
      id: recipe.id,
      user_id: userId,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      folder: recipe.folder,
      source_url: recipe.sourceUrl || recipe.source_url,
      image_url: recipe.imageUrl || recipe.image_url,
      notes: recipe.notes,
      deleted_at: recipe.deletedAt || null,
      created_at: recipe.createdAt ? new Date(recipe.createdAt).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('recipes')
      .upsert(recipesToUpsert, { onConflict: 'id' });

    if (error) throw error;

    console.log(`✅ Saved ${recipes.length} recipes to Supabase`);
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
      sourceUrl: row.source_url,
      imageUrl: row.image_url,
      notes: row.notes,
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

    // Load from database
    const dbRecipes = await loadRecipesFromDatabase(userId);

    // Create maps for quick lookup
    const dbMap = new Map(dbRecipes.map(r => [r.id, r]));
    const localMap = new Map(localRecipes.map(r => [r.id, r]));

    const mergedRecipes = [];
    const recipesToUpload = [];

    // Process local recipes
    localRecipes.forEach(localRecipe => {
      if (localRecipe.deletedAt) return; // Skip deleted

      const dbRecipe = dbMap.get(localRecipe.id);

      if (!dbRecipe) {
        // Only in local - upload it
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

    // Add recipes only in database
    dbRecipes.forEach(dbRecipe => {
      if (!localMap.has(dbRecipe.id)) {
        mergedRecipes.push(dbRecipe);
      }
    });

    // Upload local changes
    if (recipesToUpload.length > 0) {
      await saveRecipesToDatabase(userId, recipesToUpload);
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

    console.log(`✅ Sync complete. ${mergedRecipes.length} total recipes`);
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

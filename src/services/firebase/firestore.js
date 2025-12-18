/**
 * Local Storage Service (formerly Firestore)
 * Handles recipe data persistence using AsyncStorage
 *
 * Note: Cloud sync disabled - data stored locally only
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const RECIPES_KEY = '@bunches_recipes';
const FOLDERS_KEY = '@bunches_folders';

/**
 * Save recipes to local storage (no-op for cloud sync)
 * Kept for API compatibility
 */
export const saveRecipesToFirestore = async (userId, recipes) => {
  console.log(`📱 [LOCAL] Cloud sync disabled - recipes stored locally only`);
  // Recipes are saved through the useRecipes hook, no additional action needed
};

/**
 * Load recipes from local storage
 * @param {string} userId - User's unique ID (not used in local mode)
 * @returns {Promise<Array>} Array of recipes
 */
export const loadRecipesFromFirestore = async (userId) => {
  try {
    const stored = await AsyncStorage.getItem(RECIPES_KEY);
    const recipes = stored ? JSON.parse(stored) : [];
    console.log(`📱 [LOCAL] Loaded ${recipes.length} recipes from local storage`);
    return recipes;
  } catch (error) {
    console.error('❌ Error loading recipes from local storage:', error);
    return [];
  }
};

/**
 * Save a single recipe (no-op for cloud sync)
 */
export const saveRecipeToFirestore = async (userId, recipe) => {
  console.log(`📱 [LOCAL] Recipe "${recipe.title}" saved locally`);
};

/**
 * Delete a recipe (no-op for cloud sync)
 */
export const deleteRecipeFromFirestore = async (userId, recipeId) => {
  console.log(`📱 [LOCAL] Recipe ${recipeId} deleted locally`);
};

/**
 * Sync recipes - in local mode, just returns local recipes
 * @param {string} userId - User's unique ID
 * @param {Array} localRecipes - Local recipes
 * @returns {Promise<Array>} Same recipes (no sync)
 */
export const syncRecipes = async (userId, localRecipes) => {
  console.log(`📱 [LOCAL] Cloud sync disabled - using ${localRecipes.length} local recipes`);
  return localRecipes;
};

/**
 * Save folders to local storage
 */
export const saveFoldersToFirestore = async (userId, folders) => {
  try {
    await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    console.log(`📱 [LOCAL] Saved ${folders.length} folders locally`);
  } catch (error) {
    console.error('❌ Error saving folders:', error);
  }
};

/**
 * Load folders from local storage
 */
export const loadFoldersFromFirestore = async (userId) => {
  try {
    const stored = await AsyncStorage.getItem(FOLDERS_KEY);
    const folders = stored ? JSON.parse(stored) : [];
    console.log(`📱 [LOCAL] Loaded ${folders.length} folders from local storage`);
    return folders;
  } catch (error) {
    console.error('❌ Error loading folders:', error);
    return [];
  }
};

/**
 * Enable offline persistence (no-op in local mode)
 */
export const enableOfflinePersistence = async () => {
  console.log('📱 [LOCAL] Running in local-only mode');
};

export default {
  saveRecipesToFirestore,
  loadRecipesFromFirestore,
  saveRecipeToFirestore,
  deleteRecipeFromFirestore,
  syncRecipes,
  saveFoldersToFirestore,
  loadFoldersFromFirestore,
  enableOfflinePersistence,
};

/**
 * Pending Recipes Service
 * Handles recipes shared via iOS Share Extension
 */

import { NativeModules, Platform } from 'react-native';

import { log } from '../utils/log';
const { PendingRecipesModule } = NativeModules;

// Debug logging
log('[PendingRecipes] Platform:', Platform.OS);
log('[PendingRecipes] PendingRecipesModule available:', !!PendingRecipesModule);
if (PendingRecipesModule) {
  log('[PendingRecipes] Module methods:', Object.keys(PendingRecipesModule));
}

/**
 * Get all pending recipes from the share extension queue
 * @returns {Promise<Array>} Array of pending recipe objects
 */
export const getPendingRecipes = async () => {
  log('[PendingRecipes] getPendingRecipes called');

  // Only available on iOS
  if (Platform.OS !== 'ios') {
    log('[PendingRecipes] Not iOS, returning empty array');
    return [];
  }

  if (!PendingRecipesModule) {
    log('[PendingRecipes] PendingRecipesModule not available!');
    return [];
  }

  try {
    log('[PendingRecipes] Calling native getPendingRecipes...');
    const jsonString = await PendingRecipesModule.getPendingRecipes();
    log('[PendingRecipes] Raw response:', jsonString);
    const recipes = JSON.parse(jsonString);
    log('[PendingRecipes] Parsed recipes:', recipes?.length || 0, 'items');
    return recipes || [];
  } catch (error) {
    console.error('[PendingRecipes] Error getting pending recipes:', error);
    return [];
  }
};

/**
 * Clear all pending recipes from the queue
 * @returns {Promise<boolean>}
 */
export const clearPendingRecipes = async () => {
  if (Platform.OS !== 'ios' || !PendingRecipesModule) {
    return true;
  }

  try {
    await PendingRecipesModule.clearPendingRecipes();
    return true;
  } catch (error) {
    console.error('Error clearing pending recipes:', error);
    return false;
  }
};

/**
 * Remove a specific recipe from the pending queue
 * @param {string} recipeId - The ID of the recipe to remove
 * @returns {Promise<boolean>}
 */
export const removePendingRecipe = async (recipeId) => {
  if (Platform.OS !== 'ios' || !PendingRecipesModule) {
    return true;
  }

  try {
    await PendingRecipesModule.removePendingRecipe(recipeId);
    return true;
  } catch (error) {
    console.error('Error removing pending recipe:', error);
    return false;
  }
};

export default {
  getPendingRecipes,
  clearPendingRecipes,
  removePendingRecipe,
};

/**
 * Pending Recipes Service
 * Handles recipes shared via iOS Share Extension
 */

import { NativeModules, Platform } from 'react-native';

const { PendingRecipesModule } = NativeModules;

/**
 * Get all pending recipes from the share extension queue
 * @returns {Promise<Array>} Array of pending recipe objects
 */
export const getPendingRecipes = async () => {
  // Only available on iOS
  if (Platform.OS !== 'ios' || !PendingRecipesModule) {
    return [];
  }

  try {
    const jsonString = await PendingRecipesModule.getPendingRecipes();
    const recipes = JSON.parse(jsonString);
    return recipes || [];
  } catch (error) {
    console.error('Error getting pending recipes:', error);
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

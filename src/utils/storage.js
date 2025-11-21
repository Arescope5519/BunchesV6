/**
 * AsyncStorage Wrapper
 * Centralized storage operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Base Storage Keys (for non-authenticated storage)
export const STORAGE_KEYS = {
  RECIPES: 'recipes',
  FOLDERS: 'folders',
  GROCERY_LIST: 'groceryList',
  LAST_USER_ID: '@last_user_id', // Track the last signed-in user
};

/**
 * Get user-specific storage key
 * @param {string} baseKey - Base storage key
 * @param {string} userId - User ID (optional)
 * @returns {string} User-specific key or base key if no userId
 */
const getUserKey = (baseKey, userId) => {
  if (userId) {
    return `${baseKey}_${userId}`;
  }
  return baseKey;
};

/**
 * Clear storage for a specific user when switching accounts
 * @param {string} newUserId - The new user ID being signed in
 */
export const handleUserSwitch = async (newUserId) => {
  try {
    const lastUserId = await AsyncStorage.getItem(STORAGE_KEYS.LAST_USER_ID);

    // If switching to a different user, we don't need to clear old data
    // (it's isolated by user-specific keys), just update the last user ID
    if (lastUserId !== newUserId) {
      console.log(`🔄 User switch detected: ${lastUserId || 'none'} → ${newUserId || 'none'}`);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_USER_ID, newUserId || '');
    }
  } catch (error) {
    console.error('Failed to handle user switch:', error);
  }
};

/**
 * Save recipes to storage
 * @param {Array} recipes - Recipes to save
 * @param {string} userId - Optional user ID for user-specific storage
 */
export const saveRecipes = async (recipes, userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.RECIPES, userId);
    await AsyncStorage.setItem(key, JSON.stringify(recipes));
    console.log(`💾 Saved ${recipes.length} recipes to ${key}`);
    return true;
  } catch (error) {
    console.error('Failed to save recipes:', error);
    return false;
  }
};

/**
 * Load recipes from storage
 * @param {string} userId - Optional user ID for user-specific storage
 */
export const loadRecipes = async (userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.RECIPES, userId);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const recipes = JSON.parse(stored);
      console.log(`📚 Loaded ${recipes.length} recipes from ${key}`);
      return recipes;
    }
    console.log(`📚 No recipes found in ${key}`);
    return [];
  } catch (error) {
    console.error('Failed to load recipes:', error);
    return [];
  }
};

/**
 * Save folders to storage
 * @param {Array} folders - Folders to save
 * @param {string} userId - Optional user ID for user-specific storage
 */
export const saveFolders = async (folders, userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.FOLDERS, userId);
    await AsyncStorage.setItem(key, JSON.stringify(folders));
    console.log(`💾 Saved ${folders.length} folders to ${key}`);
    return true;
  } catch (error) {
    console.error('Failed to save folders:', error);
    return false;
  }
};

/**
 * Load folders from storage
 * @param {string} userId - Optional user ID for user-specific storage
 */
export const loadFolders = async (userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.FOLDERS, userId);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const folders = JSON.parse(stored);
      // Ensure "Recently Deleted" is always included
      if (!folders.includes('Recently Deleted')) {
        folders.push('Recently Deleted');
      }
      console.log(`📁 Loaded ${folders.length} folders from ${key}`);
      return folders;
    }
    console.log(`📁 No folders found in ${key}, using defaults`);
    return ['All Recipes', 'Favorites', 'Recently Deleted']; // Default folders
  } catch (error) {
    console.error('Failed to load folders:', error);
    return ['All Recipes', 'Favorites', 'Recently Deleted'];
  }
};

/**
 * Save grocery list to storage
 * @param {Array} groceryList - Grocery list to save
 * @param {string} userId - Optional user ID for user-specific storage
 */
export const saveGroceryList = async (groceryList, userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.GROCERY_LIST, userId);
    await AsyncStorage.setItem(key, JSON.stringify(groceryList));
    console.log(`💾 Saved ${groceryList.length} grocery items to ${key}`);
    return true;
  } catch (error) {
    console.error('Failed to save grocery list:', error);
    return false;
  }
};

/**
 * Load grocery list from storage
 * @param {string} userId - Optional user ID for user-specific storage
 */
export const loadGroceryList = async (userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.GROCERY_LIST, userId);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const list = JSON.parse(stored);
      console.log(`🛒 Loaded ${list.length} grocery items from ${key}`);
      return list;
    }
    console.log(`🛒 No grocery list found in ${key}`);
    return [];
  } catch (error) {
    console.error('Failed to load grocery list:', error);
    return [];
  }
};
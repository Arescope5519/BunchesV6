/**
 * AsyncStorage Wrapper
 * Centralized storage operations
 *
 * IMPORTANT: Storage keys are now user-specific to prevent data mixing between accounts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Base Storage Keys (will be prefixed with userId when user is logged in)
export const STORAGE_KEYS = {
  RECIPES: 'recipes',
  FOLDERS: 'folders',
  GROCERY_LIST: 'groceryList',
};

/**
 * Get user-specific storage key
 * @param {string} baseKey - The base key (e.g., 'recipes')
 * @param {string|null} userId - The user ID (optional)
 * @returns {string} - User-specific key or base key if no user
 */
const getUserKey = (baseKey, userId) => {
  if (userId) {
    return `${baseKey}_${userId}`;
  }
  return baseKey;
};

/**
 * Save recipes to storage
 * @param {Array} recipes - The recipes to save
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const saveRecipes = async (recipes, userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.RECIPES, userId);
    await AsyncStorage.setItem(key, JSON.stringify(recipes));
    console.log(`📦 Saved ${recipes.length} recipes to key: ${key}`);
    return true;
  } catch (error) {
    console.error('Failed to save recipes:', error);
    return false;
  }
};

/**
 * Load recipes from storage
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const loadRecipes = async (userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.RECIPES, userId);
    const stored = await AsyncStorage.getItem(key);
    console.log(`📦 Loading recipes from key: ${key}`);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.error('Failed to load recipes:', error);
    return [];
  }
};

/**
 * Save folders to storage
 * @param {Array} folders - The folders to save
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const saveFolders = async (folders, userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.FOLDERS, userId);
    await AsyncStorage.setItem(key, JSON.stringify(folders));
    return true;
  } catch (error) {
    console.error('Failed to save folders:', error);
    return false;
  }
};

/**
 * Load folders from storage
 * @param {string|null} userId - Optional user ID for user-specific storage
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
      return folders;
    }
    return ['All Recipes', 'Favorites', 'Recently Deleted']; // Default folders
  } catch (error) {
    console.error('Failed to load folders:', error);
    return ['All Recipes', 'Favorites', 'Recently Deleted'];
  }
};

/**
 * Save grocery list to storage
 * @param {Array} groceryList - The grocery list to save
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const saveGroceryList = async (groceryList, userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.GROCERY_LIST, userId);
    await AsyncStorage.setItem(key, JSON.stringify(groceryList));
    return true;
  } catch (error) {
    console.error('Failed to save grocery list:', error);
    return false;
  }
};

/**
 * Load grocery list from storage
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const loadGroceryList = async (userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.GROCERY_LIST, userId);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.error('Failed to load grocery list:', error);
    return [];
  }
};
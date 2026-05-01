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
  APP_SETTINGS: 'appSettings',
  FOLLOWED_COOKBOOKS: 'followedCookbooks',
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
      const recipes = JSON.parse(stored);

      // Deduplicate by ID (local storage can have duplicates from bugs)
      const seen = new Set();
      const deduped = [];
      for (const recipe of recipes) {
        if (!seen.has(recipe.id)) {
          seen.add(recipe.id);
          deduped.push(recipe);
        }
      }

      if (deduped.length !== recipes.length) {
        console.log(`⚠️ Removed ${recipes.length - deduped.length} duplicate recipes from local storage`);
        // Save the deduplicated list back
        await AsyncStorage.setItem(key, JSON.stringify(deduped));
      }

      return deduped;
    }
    return [];
  } catch (error) {
    console.error('Failed to load recipes:', error);
    return [];
  }
};

/**
 * Save folders to storage
 * @param {Array} folders - The folders to save (can be strings or objects with { name, isPrivate })
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const saveFolders = async (folders, userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.FOLDERS, userId);
    // Normalize folders to objects
    const normalizedFolders = folders.map(f =>
      typeof f === 'string' ? { name: f, isPrivate: false } : f
    );
    await AsyncStorage.setItem(key, JSON.stringify(normalizedFolders));
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
      // Convert old string format to new object format
      const normalizedFolders = folders.map(f =>
        typeof f === 'string' ? { name: f, isPrivate: false } : f
      );
      // Ensure "Recently Deleted" is always included
      const hasRecentlyDeleted = normalizedFolders.some(f => f.name === 'Recently Deleted');
      if (!hasRecentlyDeleted) {
        normalizedFolders.push({ name: 'Recently Deleted', isPrivate: false });
      }
      return normalizedFolders;
    }
    // Default folders (all public by default)
    return [
      { name: 'All Recipes', isPrivate: false },
      { name: 'Favorites', isPrivate: false },
      { name: 'Recently Deleted', isPrivate: false }
    ];
  } catch (error) {
    console.error('Failed to load folders:', error);
    return [
      { name: 'All Recipes', isPrivate: false },
      { name: 'Favorites', isPrivate: false },
      { name: 'Recently Deleted', isPrivate: false }
    ];
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

/**
 * Save followed cookbooks to storage
 * @param {Array} cookbooks - The followed cookbooks to save
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const saveFollowedCookbooks = async (cookbooks, userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.FOLLOWED_COOKBOOKS, userId);
    await AsyncStorage.setItem(key, JSON.stringify(cookbooks));
    return true;
  } catch (error) {
    console.error('Failed to save followed cookbooks:', error);
    return false;
  }
};

/**
 * Load followed cookbooks from storage
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const loadFollowedCookbooks = async (userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.FOLLOWED_COOKBOOKS, userId);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.error('Failed to load followed cookbooks:', error);
    return [];
  }
};

/**
 * Save app settings to storage
 * @param {Object} settings - The settings to save
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const saveAppSettings = async (settings, userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.APP_SETTINGS, userId);
    await AsyncStorage.setItem(key, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Failed to save app settings:', error);
    return false;
  }
};

/**
 * Load app settings from storage
 * @param {string|null} userId - Optional user ID for user-specific storage
 */
export const loadAppSettings = async (userId = null) => {
  try {
    const key = getUserKey(STORAGE_KEYS.APP_SETTINGS, userId);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      showQuickLinkButton: false, // Default: hidden
    };
  } catch (error) {
    console.error('Failed to load app settings:', error);
    return {
      showQuickLinkButton: false,
    };
  }
};
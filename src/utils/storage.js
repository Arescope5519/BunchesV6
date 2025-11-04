/**
 * AsyncStorage Wrapper
 * Centralized storage operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
export const STORAGE_KEYS = {
  RECIPES: 'recipes',
  FOLDERS: 'folders',
  GROCERY_LIST: 'groceryList',
};

/**
 * Save recipes to storage
 */
export const saveRecipes = async (recipes) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(recipes));
    return true;
  } catch (error) {
    console.error('Failed to save recipes:', error);
    return false;
  }
};

/**
 * Load recipes from storage
 */
export const loadRecipes = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.RECIPES);
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
 */
export const saveFolders = async (folders) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
    return true;
  } catch (error) {
    console.error('Failed to save folders:', error);
    return false;
  }
};

/**
 * Load folders from storage
 */
export const loadFolders = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.FOLDERS);
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
 */
export const saveGroceryList = async (groceryList) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.GROCERY_LIST, JSON.stringify(groceryList));
    return true;
  } catch (error) {
    console.error('Failed to save grocery list:', error);
    return false;
  }
};

/**
 * Load grocery list from storage
 */
export const loadGroceryList = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.GROCERY_LIST);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.error('Failed to load grocery list:', error);
    return [];
  }
};
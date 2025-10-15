/**
 * AsyncStorage Wrapper
 * Centralized storage operations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
export const STORAGE_KEYS = {
  RECIPES: 'recipes',
  FOLDERS: 'folders',
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
      return JSON.parse(stored);
    }
    return ['All Recipes', 'Favorites']; // Default folders
  } catch (error) {
    console.error('Failed to load folders:', error);
    return ['All Recipes', 'Favorites'];
  }
};
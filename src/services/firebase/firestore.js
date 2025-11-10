/**
 * Firestore Service
 * Handles all recipe data synchronization with Firebase
 */

import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECIPES_COLLECTION = 'recipes';
const FOLDERS_COLLECTION = 'folders';
const LAST_SYNC_KEY = '@last_sync_timestamp';

/**
 * Save recipes to Firestore for a user
 * @param {string} userId - User's unique ID
 * @param {Array} recipes - Array of recipe objects
 * @returns {Promise<void>}
 */
export const saveRecipesToFirestore = async (userId, recipes) => {
  try {
    const batch = firestore().batch();

    recipes.forEach((recipe) => {
      const recipeRef = firestore()
        .collection('users')
        .doc(userId)
        .collection(RECIPES_COLLECTION)
        .doc(recipe.id);

      batch.set(recipeRef, {
        ...recipe,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();
    console.log(`✅ Saved ${recipes.length} recipes to Firestore`);
  } catch (error) {
    console.error('❌ Error saving recipes to Firestore:', error);
    throw error;
  }
};

/**
 * Load recipes from Firestore for a user
 * @param {string} userId - User's unique ID
 * @returns {Promise<Array>} Array of recipes
 */
export const loadRecipesFromFirestore = async (userId) => {
  try {
    const snapshot = await firestore()
      .collection('users')
      .doc(userId)
      .collection(RECIPES_COLLECTION)
      .get();

    const recipes = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      recipes.push({
        ...data,
        id: doc.id,
        // Convert Firestore Timestamp to number
        updatedAt: data.updatedAt?.toMillis() || Date.now(),
        createdAt: data.createdAt || Date.now(),
      });
    });

    console.log(`✅ Loaded ${recipes.length} recipes from Firestore`);
    return recipes;
  } catch (error) {
    console.error('❌ Error loading recipes from Firestore:', error);
    throw error;
  }
};

/**
 * Save a single recipe to Firestore
 * @param {string} userId - User's unique ID
 * @param {Object} recipe - Recipe object
 * @returns {Promise<void>}
 */
export const saveRecipeToFirestore = async (userId, recipe) => {
  try {
    await firestore()
      .collection('users')
      .doc(userId)
      .collection(RECIPES_COLLECTION)
      .doc(recipe.id)
      .set({
        ...recipe,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

    console.log(`✅ Saved recipe "${recipe.title}" to Firestore`);
  } catch (error) {
    console.error('❌ Error saving recipe to Firestore:', error);
    throw error;
  }
};

/**
 * Delete a recipe from Firestore
 * @param {string} userId - User's unique ID
 * @param {string} recipeId - Recipe ID to delete
 * @returns {Promise<void>}
 */
export const deleteRecipeFromFirestore = async (userId, recipeId) => {
  try {
    await firestore()
      .collection('users')
      .doc(userId)
      .collection(RECIPES_COLLECTION)
      .doc(recipeId)
      .delete();

    console.log(`✅ Deleted recipe ${recipeId} from Firestore`);
  } catch (error) {
    console.error('❌ Error deleting recipe from Firestore:', error);
    throw error;
  }
};

/**
 * Sync recipes between local storage and Firestore
 * @param {string} userId - User's unique ID
 * @param {Array} localRecipes - Local recipes from AsyncStorage
 * @returns {Promise<Array>} Merged recipes
 */
export const syncRecipes = async (userId, localRecipes) => {
  try {
    console.log('🔄 Starting recipe sync...');

    // Load recipes from Firestore
    const firestoreRecipes = await loadRecipesFromFirestore(userId);

    // Create a map for quick lookup
    const firestoreMap = new Map();
    firestoreRecipes.forEach(recipe => {
      firestoreMap.set(recipe.id, recipe);
    });

    const localMap = new Map();
    localRecipes.forEach(recipe => {
      localMap.set(recipe.id, recipe);
    });

    // Merge logic: keep the most recent version of each recipe
    const mergedRecipes = [];
    const recipesToUpload = [];

    // Process local recipes
    localRecipes.forEach(localRecipe => {
      const firestoreRecipe = firestoreMap.get(localRecipe.id);

      if (!firestoreRecipe) {
        // Recipe only exists locally - upload it
        recipesToUpload.push(localRecipe);
        mergedRecipes.push(localRecipe);
      } else {
        // Recipe exists in both - keep the newer version
        const localTime = localRecipe.updatedAt || localRecipe.createdAt || 0;
        const firestoreTime = firestoreRecipe.updatedAt || firestoreRecipe.createdAt || 0;

        if (localTime > firestoreTime) {
          // Local is newer - upload it
          recipesToUpload.push(localRecipe);
          mergedRecipes.push(localRecipe);
        } else {
          // Firestore is newer or same - use it
          mergedRecipes.push(firestoreRecipe);
        }
      }
    });

    // Add recipes that only exist in Firestore
    firestoreRecipes.forEach(firestoreRecipe => {
      if (!localMap.has(firestoreRecipe.id)) {
        mergedRecipes.push(firestoreRecipe);
      }
    });

    // Upload new/updated recipes to Firestore
    if (recipesToUpload.length > 0) {
      await saveRecipesToFirestore(userId, recipesToUpload);
    }

    // Update last sync timestamp
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

    console.log(`✅ Sync complete. ${mergedRecipes.length} total recipes, ${recipesToUpload.length} uploaded`);

    return mergedRecipes;
  } catch (error) {
    console.error('❌ Error syncing recipes:', error);
    throw error;
  }
};

/**
 * Save folders/cookbooks to Firestore
 * @param {string} userId - User's unique ID
 * @param {Array} folders - Array of folder names
 * @returns {Promise<void>}
 */
export const saveFoldersToFirestore = async (userId, folders) => {
  try {
    await firestore()
      .collection('users')
      .doc(userId)
      .set({
        folders: folders,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

    console.log(`✅ Saved ${folders.length} folders to Firestore`);
  } catch (error) {
    console.error('❌ Error saving folders to Firestore:', error);
    throw error;
  }
};

/**
 * Load folders from Firestore
 * @param {string} userId - User's unique ID
 * @returns {Promise<Array>} Array of folder names
 */
export const loadFoldersFromFirestore = async (userId) => {
  try {
    const doc = await firestore()
      .collection('users')
      .doc(userId)
      .get();

    if (doc.exists) {
      const data = doc.data();
      const folders = data.folders || [];
      console.log(`✅ Loaded ${folders.length} folders from Firestore`);
      return folders;
    }

    return [];
  } catch (error) {
    console.error('❌ Error loading folders from Firestore:', error);
    throw error;
  }
};

/**
 * Enable offline persistence (cached data available without internet)
 * @returns {Promise<void>}
 */
export const enableOfflinePersistence = async () => {
  try {
    // Firestore automatically enables offline persistence on React Native
    // But we can configure cache size
    await firestore().settings({
      cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
    });

    console.log('✅ Offline persistence enabled');
  } catch (error) {
    console.error('❌ Error enabling offline persistence:', error);
  }
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

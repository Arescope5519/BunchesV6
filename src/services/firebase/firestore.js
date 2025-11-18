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
    let snapshot;

    // Try to get from server first to ensure we have latest data
    // This fixes the issue where Firestore's cache returns stale data
    try {
      snapshot = await firestore()
        .collection('users')
        .doc(userId)
        .collection(RECIPES_COLLECTION)
        .get({ source: 'server' });
      console.log('✅ Loaded recipes from Firestore server');
    } catch (serverError) {
      // Fall back to cache if server is unavailable (offline)
      console.log('⚠️ Server unavailable, loading from Firestore cache');
      snapshot = await firestore()
        .collection('users')
        .doc(userId)
        .collection(RECIPES_COLLECTION)
        .get({ source: 'cache' });
    }

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

    console.log(`📚 Loaded ${recipes.length} recipes from Firestore`);
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
 * Also adds recipe ID to deletion tracking list to prevent restoration after reinstall
 * @param {string} userId - User's unique ID
 * @param {string} recipeId - Recipe ID to delete
 * @returns {Promise<void>}
 */
export const deleteRecipeFromFirestore = async (userId, recipeId) => {
  try {
    const userDocRef = firestore()
      .collection('users')
      .doc(userId);

    // Delete the recipe document
    await userDocRef
      .collection(RECIPES_COLLECTION)
      .doc(recipeId)
      .delete();

    // Track this deletion to prevent restoration after reinstall
    await userDocRef.set({
      deletedRecipeIds: firestore.FieldValue.arrayUnion(recipeId),
      lastDeletionAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Deleted recipe ${recipeId} from Firestore and tracked deletion`);
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

    // Load deleted recipe IDs from user doc (try server first for fresh data)
    let userDoc;
    try {
      userDoc = await firestore()
        .collection('users')
        .doc(userId)
        .get({ source: 'server' });
    } catch (serverError) {
      // Fall back to cache if offline
      userDoc = await firestore()
        .collection('users')
        .doc(userId)
        .get({ source: 'cache' });
    }

    const deletedRecipeIds = new Set(userDoc.exists && userDoc.data().deletedRecipeIds || []);
    if (deletedRecipeIds.size > 0) {
      console.log(`🗑️ Found ${deletedRecipeIds.size} previously deleted recipe IDs`);
    }

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
        // SPECIAL CASE: If local version is deleted, always prefer local to preserve deletion
        if (localRecipe.deletedAt && !firestoreRecipe.deletedAt) {
          // Local was deleted but Firestore doesn't have the deletion yet - use local
          recipesToUpload.push(localRecipe);
          mergedRecipes.push(localRecipe);
          console.log(`⚠️ Preserving local deletion for recipe: ${localRecipe.title || localRecipe.id}`);
        } else {
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
      }
    });

    // Add recipes that only exist in Firestore
    // BUT exclude deleted recipes (soft-deleted OR permanently deleted) to prevent
    // them from coming back after uninstall/reinstall
    const recipesToDeleteFromFirestore = [];

    firestoreRecipes.forEach(firestoreRecipe => {
      if (!localMap.has(firestoreRecipe.id)) {
        // Recipe only exists in Firestore
        if (firestoreRecipe.deletedAt) {
          // It's a soft-deleted recipe - don't restore it, and delete it from Firestore
          recipesToDeleteFromFirestore.push(firestoreRecipe.id);
          console.log(`🗑️ Auto-cleaning soft-deleted recipe from Firestore: ${firestoreRecipe.title || firestoreRecipe.id}`);
        } else if (deletedRecipeIds.has(firestoreRecipe.id)) {
          // It's a permanently deleted recipe - don't restore it, and delete it from Firestore
          recipesToDeleteFromFirestore.push(firestoreRecipe.id);
          console.log(`🗑️ Auto-cleaning permanently deleted recipe from Firestore: ${firestoreRecipe.title || firestoreRecipe.id}`);
        } else {
          // Normal recipe - add it to merged list
          mergedRecipes.push(firestoreRecipe);
        }
      }
    });

    // Clean up deleted recipes from Firestore (both soft-deleted and permanently deleted)
    if (recipesToDeleteFromFirestore.length > 0) {
      console.log(`🗑️ Cleaning ${recipesToDeleteFromFirestore.length} deleted recipes from Firestore...`);
      const deleteBatch = firestore().batch();
      recipesToDeleteFromFirestore.forEach(recipeId => {
        const recipeRef = firestore()
          .collection('users')
          .doc(userId)
          .collection(RECIPES_COLLECTION)
          .doc(recipeId);
        deleteBatch.delete(recipeRef);
      });
      await deleteBatch.commit();
      console.log(`✅ Cleaned ${recipesToDeleteFromFirestore.length} deleted recipes from Firestore`);
    }

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

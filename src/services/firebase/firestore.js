/**
 * Firestore Service
 * Handles all recipe data synchronization with Firebase
 * Uses Firebase JS SDK
 */

import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp, arrayUnion, getDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseFirestore } from './config';

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
    const db = getFirebaseFirestore();
    const batch = writeBatch(db);

    recipes.forEach((recipe) => {
      const recipeRef = doc(db, 'users', userId, RECIPES_COLLECTION, recipe.id);
      batch.set(recipeRef, {
        ...recipe,
        updatedAt: serverTimestamp(),
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
    const db = getFirebaseFirestore();
    const recipesRef = collection(db, 'users', userId, RECIPES_COLLECTION);
    const snapshot = await getDocs(recipesRef);
    console.log('✅ Loaded recipes from Firestore');

    const recipes = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      recipes.push({
        ...data,
        id: docSnap.id,
        // Convert Firestore Timestamp to number
        updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || Date.now()),
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
    const db = getFirebaseFirestore();
    const recipeRef = doc(db, 'users', userId, RECIPES_COLLECTION, recipe.id);

    await setDoc(recipeRef, {
      ...recipe,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Saved recipe "${recipe.name || recipe.title}" to Firestore`);
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
    const db = getFirebaseFirestore();
    const userDocRef = doc(db, 'users', userId);

    // FIRST: Track this deletion in the user doc to prevent restoration
    await setDoc(userDocRef, {
      deletedRecipeIds: arrayUnion(recipeId),
      lastDeletionAt: serverTimestamp(),
    }, { merge: true });

    // Delete the recipe document
    const recipeRef = doc(db, 'users', userId, RECIPES_COLLECTION, recipeId);
    await deleteDoc(recipeRef);

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
    const db = getFirebaseFirestore();

    // Load deleted recipe IDs from user doc
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    const deletedRecipeIds = new Set(userDocSnap.exists() && userDocSnap.data()?.deletedRecipeIds || []);
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
          recipesToUpload.push(localRecipe);
          mergedRecipes.push(localRecipe);
          console.log(`⚠️ Preserving local deletion for recipe: ${localRecipe.name || localRecipe.id}`);
        } else {
          const localTime = localRecipe.updatedAt || localRecipe.createdAt || 0;
          const firestoreTime = firestoreRecipe.updatedAt || firestoreRecipe.createdAt || 0;

          if (localTime > firestoreTime) {
            recipesToUpload.push(localRecipe);
            mergedRecipes.push(localRecipe);
          } else {
            mergedRecipes.push(firestoreRecipe);
          }
        }
      }
    });

    // Add recipes that only exist in Firestore
    // BUT exclude deleted recipes to prevent them from coming back
    const recipesToDeleteFromFirestore = [];

    firestoreRecipes.forEach(firestoreRecipe => {
      if (!localMap.has(firestoreRecipe.id)) {
        if (firestoreRecipe.deletedAt) {
          recipesToDeleteFromFirestore.push(firestoreRecipe.id);
          console.log(`🗑️ Auto-cleaning soft-deleted recipe from Firestore: ${firestoreRecipe.name || firestoreRecipe.id}`);
        } else if (deletedRecipeIds.has(firestoreRecipe.id)) {
          recipesToDeleteFromFirestore.push(firestoreRecipe.id);
          console.log(`🗑️ Auto-cleaning permanently deleted recipe from Firestore: ${firestoreRecipe.name || firestoreRecipe.id}`);
        } else {
          mergedRecipes.push(firestoreRecipe);
        }
      }
    });

    // Clean up deleted recipes from Firestore
    if (recipesToDeleteFromFirestore.length > 0) {
      console.log(`🗑️ Cleaning ${recipesToDeleteFromFirestore.length} deleted recipes from Firestore...`);
      const deleteBatch = writeBatch(db);
      recipesToDeleteFromFirestore.forEach(recipeId => {
        const recipeRef = doc(db, 'users', userId, RECIPES_COLLECTION, recipeId);
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
    const db = getFirebaseFirestore();
    const userRef = doc(db, 'users', userId);

    await setDoc(userRef, {
      folders: folders,
      updatedAt: serverTimestamp(),
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
    const db = getFirebaseFirestore();
    const userRef = doc(db, 'users', userId);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
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
 * Enable offline persistence
 * @returns {Promise<void>}
 */
export const enableOfflinePersistence = async () => {
  try {
    const db = getFirebaseFirestore();
    await enableIndexedDbPersistence(db);
    console.log('✅ Offline persistence enabled');
  } catch (error) {
    if (error.code === 'failed-precondition') {
      console.log('⚠️ Offline persistence unavailable: multiple tabs open');
    } else if (error.code === 'unimplemented') {
      console.log('⚠️ Offline persistence not supported in this environment');
    } else {
      console.error('❌ Error enabling offline persistence:', error);
    }
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

/**
 * Temporary Firestore Cleanup Utility
 * Use this to check and clean soft-deleted recipes from Firestore
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseFirestore } from '../services/firebase/config';

const RECIPES_STORAGE_KEY = '@recipes';

/**
 * Check what recipes are in Firestore vs local storage
 */
export const checkFirestoreRecipes = async (userId) => {
  try {
    const db = getFirebaseFirestore();
    console.log('🔍 Checking Firestore recipes for user:', userId);

    // Load deletion tracking list (from server to get fresh data)
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    const deletedRecipeIds = new Set(userDoc.exists() && userDoc.data().deletedRecipeIds || []);

    const recipesRef = collection(db, 'users', userId, 'recipes');
    const snapshot = await getDocs(recipesRef);

    const allRecipes = [];
    const deletedRecipes = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const recipe = {
        id: docSnap.id,
        title: data.title,
        deletedAt: data.deletedAt,
      };

      allRecipes.push(recipe);

      if (data.deletedAt) {
        deletedRecipes.push(recipe);
      }
    });

    // Also load local recipes to compare
    const localRecipesJSON = await AsyncStorage.getItem(RECIPES_STORAGE_KEY);
    const localRecipes = localRecipesJSON ? JSON.parse(localRecipesJSON) : [];
    const localRecipeIds = new Set(localRecipes.map(r => r.id));

    // Find recipes in Firestore that were permanently deleted (tracked in deletedRecipeIds)
    // OR don't exist locally and aren't soft-deleted (these are stuck deleted recipes)
    const stuckRecipes = allRecipes.filter(r =>
      deletedRecipeIds.has(r.id) || (!localRecipeIds.has(r.id) && !r.deletedAt)
    );

    console.log(`📊 Found ${allRecipes.length} total recipes in Firestore`);
    console.log(`🗑️ Found ${deletedRecipes.length} soft-deleted recipes`);
    console.log(`⚠️ Found ${stuckRecipes.length} recipes in Firestore that don't exist locally`);

    if (deletedRecipes.length > 0) {
      console.log('Soft-deleted recipes:');
      deletedRecipes.forEach(r => {
        console.log(`  - ${r.title} (ID: ${r.id})`);
      });
    }

    if (stuckRecipes.length > 0) {
      console.log('Stuck recipes (in Firestore but not local):');
      stuckRecipes.forEach(r => {
        console.log(`  - ${r.title} (ID: ${r.id})`);
      });
    }

    return { allRecipes, deletedRecipes, stuckRecipes, localRecipeIds };
  } catch (error) {
    console.error('❌ Error checking Firestore:', error);
    throw error;
  }
};

/**
 * Clean up all soft-deleted AND stuck recipes from Firestore
 */
export const cleanupDeletedRecipes = async (userId) => {
  try {
    const db = getFirebaseFirestore();
    console.log('🧹 Starting Firestore cleanup...');

    // Get both soft-deleted and stuck recipes
    const { deletedRecipes, stuckRecipes } = await checkFirestoreRecipes(userId);

    const recipesToDelete = [...deletedRecipes, ...stuckRecipes];

    if (recipesToDelete.length === 0) {
      console.log('✅ No recipes to clean up. Firestore is clean!');
      return 0;
    }

    // FIRST: Add all recipe IDs to deletion tracking list
    // This ensures they won't be restored even if document deletion fails
    const recipeIdsToDelete = recipesToDelete.map(r => r.id);
    const userDocRef = doc(db, 'users', userId);

    await setDoc(userDocRef, {
      deletedRecipeIds: arrayUnion(...recipeIdsToDelete),
      lastDeletionAt: serverTimestamp(),
    }, { merge: true });

    console.log(`📝 Tracked ${recipeIdsToDelete.length} recipe IDs in deletion list`);

    // Now delete the recipe documents
    const batch = writeBatch(db);
    let count = 0;

    recipesToDelete.forEach((recipe) => {
      const recipeRef = doc(db, 'users', userId, 'recipes', recipe.id);

      batch.delete(recipeRef);
      count++;
      console.log(`  Deleting: ${recipe.title || recipe.id}`);
    });

    await batch.commit();

    console.log(`✅ Cleaned up ${count} recipes from Firestore`);

    return count;
  } catch (error) {
    console.error('❌ Error cleaning Firestore:', error);
    throw error;
  }
};

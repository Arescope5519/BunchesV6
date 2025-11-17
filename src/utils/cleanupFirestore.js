/**
 * Temporary Firestore Cleanup Utility
 * Use this to check and clean soft-deleted recipes from Firestore
 */

import firestore from '@react-native-firebase/firestore';

/**
 * Check what recipes are in Firestore (including soft-deleted ones)
 */
export const checkFirestoreRecipes = async (userId) => {
  try {
    console.log('🔍 Checking Firestore recipes for user:', userId);

    const snapshot = await firestore()
      .collection('users')
      .doc(userId)
      .collection('recipes')
      .get();

    const allRecipes = [];
    const deletedRecipes = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const recipe = {
        id: doc.id,
        title: data.title,
        deletedAt: data.deletedAt,
      };

      allRecipes.push(recipe);

      if (data.deletedAt) {
        deletedRecipes.push(recipe);
      }
    });

    console.log(`📊 Found ${allRecipes.length} total recipes in Firestore`);
    console.log(`🗑️ Found ${deletedRecipes.length} soft-deleted recipes`);

    if (deletedRecipes.length > 0) {
      console.log('Soft-deleted recipes:');
      deletedRecipes.forEach(r => {
        console.log(`  - ${r.title} (ID: ${r.id})`);
      });
    }

    return { allRecipes, deletedRecipes };
  } catch (error) {
    console.error('❌ Error checking Firestore:', error);
    throw error;
  }
};

/**
 * Clean up all soft-deleted recipes from Firestore
 */
export const cleanupDeletedRecipes = async (userId) => {
  try {
    console.log('🧹 Starting Firestore cleanup...');

    const snapshot = await firestore()
      .collection('users')
      .doc(userId)
      .collection('recipes')
      .where('deletedAt', '!=', null)
      .get();

    if (snapshot.empty) {
      console.log('✅ No soft-deleted recipes found. Firestore is clean!');
      return 0;
    }

    const batch = firestore().batch();
    let count = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
      console.log(`  Deleting: ${doc.data().title || doc.id}`);
    });

    await batch.commit();
    console.log(`✅ Cleaned up ${count} soft-deleted recipes from Firestore`);

    return count;
  } catch (error) {
    console.error('❌ Error cleaning Firestore:', error);
    throw error;
  }
};

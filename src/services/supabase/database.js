/**
 * Supabase Database Service
 * Handles recipes, folders, and data synchronization
 */

import { supabase } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHighConfidenceTags } from '../../utils/autoTag';

import { log } from '../../utils/log';
const LAST_SYNC_KEY = '@last_sync_timestamp';

/**
 * Save recipes to Supabase for a user
 * @param {string} userId - User's unique ID
 * @param {Array} recipes - Array of recipe objects
 */
export const saveRecipesToDatabase = async (userId, recipes) => {
  try {
    const recipesToUpsert = recipes.map(recipe => {
      // Handle createdAt - could be number, string, or Date
      let createdAtISO;
      if (recipe.createdAt) {
        if (typeof recipe.createdAt === 'number') {
          createdAtISO = new Date(recipe.createdAt).toISOString();
        } else if (typeof recipe.createdAt === 'string') {
          createdAtISO = new Date(recipe.createdAt).toISOString();
        } else {
          createdAtISO = new Date().toISOString();
        }
      } else {
        createdAtISO = new Date().toISOString();
      }

      return {
        id: recipe.id,
        user_id: userId,
        title: recipe.title || 'Untitled Recipe',
        ingredients: recipe.ingredients || '',
        instructions: recipe.instructions || '',
        folder: recipe.folder || 'All Recipes',
        source_url: recipe.url || recipe.sourceUrl || recipe.source_url || null,
        image_url: recipe.imageUrl || recipe.image_url || recipe.image || null,
        notes: recipe.notes || null,
        tags: recipe.tags || [],
        is_private: recipe.isPrivate || false,
        deleted_at: recipe.deletedAt ? new Date(recipe.deletedAt).toISOString() : null,
        created_at: createdAtISO,
        updated_at: new Date().toISOString(),
        // New fields for stats and versioning
        stats: recipe.stats || { likes: 0, saves: 0, views: 0 },
        original_recipe: recipe.originalRecipe || null,
        has_edits: recipe.hasEdits || false,
        edit_history: recipe.editHistory || [],
        viewing_original: recipe.viewingOriginal || false,
        edited_version: recipe.editedVersion || null,
      };
    });

    // Filter out any recipes that somehow still don't have an ID
    const validRecipes = recipesToUpsert.filter(r => r.id);

    if (validRecipes.length === 0) {
      log('⚠️ No valid recipes to save (all missing IDs)');
      return;
    }

    const { error } = await supabase
      .from('recipes')
      .upsert(validRecipes, { onConflict: 'id' });

    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }

    log(`✅ Saved ${validRecipes.length} recipes to Supabase`);
  } catch (error) {
    console.error('❌ Error saving recipes:', error);
    throw error;
  }
};

/**
 * Load recipes from Supabase for a user (V2 - reads from new tables)
 * @param {string} userId - User's unique ID
 * @returns {Promise<Array>} Array of recipes
 */
export const loadRecipesFromDatabase = async (userId) => {
  try {
    // Query user_recipes_v2 joined with global_recipes
    const { data, error } = await supabase
      .from('user_recipes_v2')
      .select(`
        id,
        user_id,
        global_recipe_id,
        local_recipe_data,
        local_edits,
        folder,
        folders,
        tags,
        is_favorite,
        notes,
        imported_from,
        imported_at,
        deleted_at,
        created_at,
        updated_at,
        global_recipes (
          id,
          source_url,
          title,
          ingredients,
          instructions,
          image_url,
          prep_time,
          cook_time,
          total_time,
          servings,
          nutrition,
          author,
          tags
        )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;

    const recipes = data.map(row => {
      // Get base recipe data from global_recipes or local_recipe_data
      const globalRecipe = row.global_recipes;
      const localData = row.local_recipe_data;

      // Base recipe comes from global or local
      const baseTitle = globalRecipe?.title || localData?.title || 'Untitled';
      const baseIngredients = globalRecipe?.ingredients || localData?.ingredients;
      const baseInstructions = globalRecipe?.instructions || localData?.instructions;
      const baseImageUrl = globalRecipe?.image_url || localData?.image_url;
      const sourceUrl = globalRecipe?.source_url || null;

      // Parse ingredients
      let ingredients = baseIngredients;
      if (typeof ingredients === 'string') {
        try {
          const parsed = JSON.parse(ingredients);
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            ingredients = parsed;
          } else if (Array.isArray(parsed)) {
            ingredients = { main: parsed };
          } else {
            ingredients = { main: ingredients.split('\n').filter(l => l.trim()) };
          }
        } catch {
          ingredients = { main: ingredients.split('\n').filter(l => l.trim()) };
        }
      } else if (Array.isArray(ingredients)) {
        ingredients = { main: ingredients };
      } else if (!ingredients || typeof ingredients !== 'object') {
        ingredients = { main: [] };
      }

      // Parse instructions
      let instructions = baseInstructions;
      if (typeof instructions === 'string') {
        try {
          const parsed = JSON.parse(instructions);
          if (Array.isArray(parsed)) {
            instructions = parsed;
          } else {
            instructions = instructions.split('\n').filter(l => l.trim());
          }
        } catch {
          instructions = instructions.split('\n').filter(l => l.trim());
        }
      } else if (!Array.isArray(instructions)) {
        instructions = [];
      }

      // Extract variants from local_edits
      const localEdits = row.local_edits || {};
      const variants = localEdits.variants || [];
      const selectedVariantId = localEdits.selectedVariantId || null;
      const hasEdits = variants.length > 0;

      // Build originalRecipe for compatibility (base version)
      const originalRecipe = hasEdits ? {
        title: baseTitle,
        ingredients: ingredients,
        instructions: instructions,
      } : null;

      // Handle folders array - use folders if available, fallback to single folder
      const folders = row.folders && row.folders.length > 0
        ? row.folders
        : [row.folder || 'All Recipes'];
      // Primary folder for backward compatibility (first custom folder, or first folder)
      const primaryFolder = folders.find(f => f !== 'All Recipes') || folders[0] || 'All Recipes';

      return {
        id: row.id,
        title: baseTitle,
        ingredients: ingredients,
        instructions: instructions,
        folder: primaryFolder,  // For backward compatibility
        folders: folders,       // New: array of all folders
        url: sourceUrl,
        source_url: sourceUrl,
        image_url: baseImageUrl,
        notes: row.notes,
        prep_time: globalRecipe?.prep_time || localData?.prep_time || null,
        cook_time: globalRecipe?.cook_time || localData?.cook_time || null,
        servings: globalRecipe?.servings || localData?.servings || null,
        nutrition: globalRecipe?.nutrition || localData?.nutrition || null,
        tags: row.tags || [],                       // user's own tags (editable)
        globalTags: globalRecipe?.tags || [],       // shared auto-tags (read-only)
        source: localData?.source || null,          // 'manual' | 'scan' | null
        createdBy: localData?.createdBy || null,
        isFavorite: row.is_favorite || false,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        importedFrom: row.imported_from,
        importedAt: row.imported_at ? new Date(row.imported_at).getTime() : null,
        // Versioning
        originalRecipe: originalRecipe,
        hasEdits: hasEdits,
        viewingOriginal: selectedVariantId === null,
        variants: variants,
        selectedVariantId: selectedVariantId,
        // Global reference
        globalRecipeId: row.global_recipe_id,
      };
    });

    // Deduplicate by global_recipe_id (merge folders for same recipe)
    // This handles cases where the same recipe exists multiple times with different folders
    const deduped = [];
    const seenGlobalIds = new Map(); // global_recipe_id -> index in deduped
    const seenIds = new Set(); // for recipes without global_recipe_id

    for (const recipe of recipes) {
      if (recipe.globalRecipeId) {
        // Recipe has a global reference - dedupe by globalRecipeId
        const existingIndex = seenGlobalIds.get(recipe.globalRecipeId);
        if (existingIndex !== undefined) {
          // Merge folders from duplicate entry
          const existing = deduped[existingIndex];
          const existingFolders = existing.folders || [existing.folder || 'All Recipes'];
          const newFolders = recipe.folders || [recipe.folder || 'All Recipes'];
          const mergedFolders = [...new Set([...existingFolders, ...newFolders])];
          existing.folders = mergedFolders;
          existing.folder = mergedFolders.find(f => f !== 'All Recipes') || mergedFolders[0];
          log(`🔄 Merged duplicate recipe "${recipe.title}" - folders: ${mergedFolders.join(', ')}`);
        } else {
          seenGlobalIds.set(recipe.globalRecipeId, deduped.length);
          deduped.push(recipe);
        }
      } else {
        // No global reference - dedupe by ID
        if (!seenIds.has(recipe.id)) {
          seenIds.add(recipe.id);
          deduped.push(recipe);
        }
      }
    }

    if (deduped.length !== recipes.length) {
      log(`⚠️ [V2] Merged ${recipes.length - deduped.length} duplicate entries`);
    }

    log(`📚 [V2] Loaded ${deduped.length} recipes from new tables`);
    return deduped;
  } catch (error) {
    console.error('❌ [V2] Error loading recipes:', error);
    // Fallback to old table if V2 fails
    log('⚠️ Falling back to old recipes table...');
    return await loadRecipesFromDatabaseLegacy(userId);
  }
};

/**
 * Load recipes from old table (legacy fallback)
 * @param {string} userId - User's unique ID
 * @returns {Promise<Array>} Array of recipes
 */
export const loadRecipesFromDatabaseLegacy = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;

    const recipes = data.map(row => {
      let ingredients = row.ingredients;
      if (typeof ingredients === 'string') {
        try {
          const parsed = JSON.parse(ingredients);
          if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            ingredients = parsed;
          } else if (Array.isArray(parsed)) {
            ingredients = { main: parsed };
          } else {
            ingredients = { main: ingredients.split('\n').filter(l => l.trim()) };
          }
        } catch {
          ingredients = { main: ingredients.split('\n').filter(l => l.trim()) };
        }
      } else if (Array.isArray(ingredients)) {
        ingredients = { main: ingredients };
      } else if (!ingredients || typeof ingredients !== 'object') {
        ingredients = { main: [] };
      }

      let instructions = row.instructions;
      if (typeof instructions === 'string') {
        try {
          const parsed = JSON.parse(instructions);
          if (Array.isArray(parsed)) {
            instructions = parsed;
          } else {
            instructions = instructions.split('\n').filter(l => l.trim());
          }
        } catch {
          instructions = instructions.split('\n').filter(l => l.trim());
        }
      } else if (!Array.isArray(instructions)) {
        instructions = [];
      }

      return {
        id: row.id,
        title: row.title,
        ingredients: ingredients,
        instructions: instructions,
        folder: row.folder,
        url: row.source_url,
        source_url: row.source_url,
        image_url: row.image_url,
        notes: row.notes,
        nutrition: row.nutrition || null,
        prep_time: row.prep_time || null,
        cook_time: row.cook_time || null,
        servings: row.servings || null,
        tags: row.tags || [],
        isPrivate: row.is_private || false,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        stats: row.stats || { likes: 0, saves: 0, views: 0 },
        originalRecipe: row.original_recipe || null,
        hasEdits: row.has_edits || (row.variants?.length > 0) || false,
        editHistory: row.edit_history || [],
        viewingOriginal: row.viewing_original || false,
        editedVersion: row.edited_version || null,
        variants: row.variants || [],
        selectedVariantId: row.selected_variant_id || null,
      };
    });

    log(`📚 [Legacy] Loaded ${recipes.length} recipes from old table`);
    return recipes;
  } catch (error) {
    console.error('❌ [Legacy] Error loading recipes:', error);
    throw error;
  }
};

/**
 * Save a single recipe
 * @param {string} userId - User's unique ID
 * @param {Object} recipe - Recipe object
 */
export const saveRecipeToDatabase = async (userId, recipe) => {
  try {
    const imageUrl = recipe.imageUrl || recipe.image_url || recipe.image;

    // Serialize ingredients as JSON string to preserve structure
    let ingredients;
    if (typeof recipe.ingredients === 'object' && recipe.ingredients !== null) {
      ingredients = JSON.stringify(recipe.ingredients);
    } else if (Array.isArray(recipe.ingredients)) {
      ingredients = JSON.stringify({ main: recipe.ingredients });
    } else {
      ingredients = recipe.ingredients || '';
    }

    // Serialize instructions as JSON string to preserve array
    let instructions;
    if (Array.isArray(recipe.instructions)) {
      instructions = JSON.stringify(recipe.instructions);
    } else {
      instructions = recipe.instructions || '';
    }

    // Build recipe_data object with all local data including folders
    const recipeData = {
      id: recipe.id,
      title: recipe.title,
      folders: recipe.folders || (recipe.folder ? [recipe.folder] : ['All Recipes']),
      folder: recipe.folder || recipe.folders?.[0] || 'All Recipes',
      image_url: imageUrl,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      notes: recipe.notes,
      createdBy: recipe.createdBy,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    };

    log('📸 Saving recipe:', recipe.title, 'image_url:', imageUrl, 'folders:', recipeData.folders);

    const { error } = await supabase
      .from('recipes')
      .upsert({
        id: recipe.id,
        user_id: userId,
        title: recipe.title || 'Untitled Recipe',
        ingredients: ingredients,
        instructions: instructions,
        folder: recipe.folder || recipe.folders?.[0] || 'All Recipes',
        source_url: recipe.url || recipe.sourceUrl || recipe.source_url || null,
        image_url: imageUrl || null,
        notes: recipe.notes || null,
        tags: recipe.tags || [],
        is_private: recipe.isPrivate || false,
        created_at: recipe.createdAt ? new Date(recipe.createdAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Store full recipe data for proper folder support
        recipe_data: recipeData,
        // New fields for stats and versioning
        stats: recipe.stats || { likes: 0, saves: 0, views: 0 },
        original_recipe: recipe.originalRecipe || null,
        has_edits: recipe.hasEdits || (recipe.variants?.length > 0) || false,
        edit_history: recipe.editHistory || [],
        viewing_original: recipe.viewingOriginal || false,
        edited_version: recipe.editedVersion || null,
        // Variants support
        variants: recipe.variants || [],
        selected_variant_id: recipe.selectedVariantId || null,
      }, { onConflict: 'id' });

    if (error) throw error;

    log(`✅ Saved recipe "${recipe.title}" with folders:`, recipeData.folders);
  } catch (error) {
    console.error('❌ Error saving recipe:', error);
    throw error;
  }
};

/**
 * Delete a recipe (soft delete)
 * @param {string} userId - User's unique ID
 * @param {string} recipeId - Recipe ID
 */
export const deleteRecipeFromDatabase = async (userId, recipeId) => {
  const deletedAt = new Date().toISOString();
  let anySuccess = false;

  // Delete from OLD recipes table
  try {
    const { error } = await supabase
      .from('recipes')
      .update({ deleted_at: deletedAt })
      .eq('id', recipeId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Delete from recipes failed:', error);
    } else {
      log(`✅ Marked deleted in recipes table: ${recipeId}`);
      anySuccess = true;
    }
  } catch (err) {
    console.error('❌ recipes delete error:', err);
  }

  // Also delete from user_recipes_v2 table (matches by cloud id OR local_recipe_data.id)
  try {
    // Try direct id match first
    const { error: idErr, count: idCount } = await supabase
      .from('user_recipes_v2')
      .update({ deleted_at: deletedAt }, { count: 'exact' })
      .eq('id', recipeId)
      .eq('user_id', userId);

    if (!idErr && (idCount || 0) > 0) {
      log(`✅ Marked deleted in user_recipes_v2 by id: ${recipeId} (${idCount} rows)`);
      anySuccess = true;
    } else {
      // Recipe id might be a local recipe id, not the cloud row id
      // Fetch all rows for this user and match on local_recipe_data.id
      const { data: rows } = await supabase
        .from('user_recipes_v2')
        .select('id, local_recipe_data')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (rows && rows.length > 0) {
        const matchingIds = rows
          .filter(r => r.local_recipe_data?.id === recipeId)
          .map(r => r.id);

        if (matchingIds.length > 0) {
          const { error: v2Err } = await supabase
            .from('user_recipes_v2')
            .update({ deleted_at: deletedAt })
            .in('id', matchingIds);

          if (!v2Err) {
            log(`✅ Marked deleted in user_recipes_v2 by local id: ${recipeId} (${matchingIds.length} rows)`);
            anySuccess = true;
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ user_recipes_v2 delete error:', err);
  }

  if (!anySuccess) {
    throw new Error(`Failed to delete recipe ${recipeId} from any table`);
  }
};

/**
 * Sync recipes between local storage and Supabase
 * @param {string} userId - User's unique ID
 * @param {Array} localRecipes - Local recipes
 * @returns {Promise<Array>} Merged recipes
 */
export const syncRecipes = async (userId, localRecipes) => {
  try {
    log('🔄 Starting recipe sync...');
    log(`📦 Local recipes to sync: ${localRecipes.length}`);

    // Debug: Log deleted recipes
    const deletedLocal = localRecipes.filter(r => r.deletedAt);
    log(`🗑️ Locally deleted recipes: ${deletedLocal.length}`);
    deletedLocal.forEach(r => log(`  - "${r.title}" (deletedAt: ${r.deletedAt})`));

    // Ensure all local recipes have IDs (for pre-migration data)
    const localRecipesWithIds = localRecipes.map(recipe => {
      if (!recipe.id) {
        log(`⚠️ Recipe "${recipe.title}" missing ID, generating one...`);
        return {
          ...recipe,
          id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: recipe.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
      }
      return recipe;
    });

    // Load ALL recipes from database (including deleted) to check sync status
    const { data: allDbData, error: allDbError } = await supabase
      .from('recipes')
      .select('id, deleted_at, updated_at')
      .eq('user_id', userId);

    if (allDbError) throw allDbError;

    const dbDeletedMap = new Map(allDbData.map(r => [r.id, r.deleted_at]));

    // Load non-deleted from database for merge
    const dbRecipes = await loadRecipesFromDatabase(userId);
    log(`☁️ Database recipes: ${dbRecipes.length}`);

    // Create maps for quick lookup
    const dbMap = new Map(dbRecipes.map(r => [r.id, r]));
    const localMap = new Map(localRecipesWithIds.map(r => [r.id, r]));

    const mergedRecipes = [];
    const recipesToUpload = [];
    const recipesToDelete = [];

    // Track locally deleted recipe IDs to ensure they don't come back
    const locallyDeletedIds = new Set(
      localRecipesWithIds.filter(r => r.deletedAt).map(r => r.id)
    );

    // Process local recipes
    localRecipesWithIds.forEach(localRecipe => {
      const dbRecipe = dbMap.get(localRecipe.id);
      const dbDeletedAt = dbDeletedMap.get(localRecipe.id);

      if (localRecipe.deletedAt) {
        // Recipe is deleted locally - ALWAYS keep local deleted version
        if (!dbDeletedAt) {
          // But not deleted in database - sync the deletion
          log(`🗑️ Syncing deletion for: "${localRecipe.title}"`);
          recipesToDelete.push(localRecipe.id);
        }
        // Keep in merged for "Recently Deleted" functionality
        mergedRecipes.push(localRecipe);
        return;
      }

      if (!dbRecipe) {
        // Not in V2 - check if it was deleted in old table before we upload
        if (dbDeletedAt) {
          log(`🗑️ Recipe "${localRecipe.title}" was deleted in DB (old table), propagating deletion to local`);
          mergedRecipes.push({
            ...localRecipe,
            deletedAt: new Date(dbDeletedAt).getTime(),
            updatedAt: Date.now(),
          });
          return;
        }
        // Only in local - upload it
        log(`📤 Uploading local recipe: "${localRecipe.title}"`);
        recipesToUpload.push(localRecipe);
        mergedRecipes.push(localRecipe);
      } else {
        // Exists in both - keep newer
        const localTime = localRecipe.updatedAt || localRecipe.createdAt || 0;
        const dbTime = dbRecipe.updatedAt || dbRecipe.createdAt || 0;

        if (localTime > dbTime) {
          recipesToUpload.push(localRecipe);
          // Carry over global auto-tags - they only live on the DB side,
          // so a locally-newer copy must not erase them
          mergedRecipes.push({
            ...localRecipe,
            globalTags: (localRecipe.globalTags && localRecipe.globalTags.length > 0)
              ? localRecipe.globalTags
              : dbRecipe.globalTags || [],
          });
        } else {
          mergedRecipes.push(dbRecipe);
        }
      }
    });

    // Add recipes only in database (not in local AND not locally deleted)
    dbRecipes.forEach(dbRecipe => {
      // Don't add back recipes that are locally deleted
      if (!localMap.has(dbRecipe.id) && !locallyDeletedIds.has(dbRecipe.id)) {
        mergedRecipes.push(dbRecipe);
      }
    });

    // Upload local changes
    if (recipesToUpload.length > 0) {
      log(`📤 Uploading ${recipesToUpload.length} recipes to database...`);
      await saveRecipesToDatabase(userId, recipesToUpload);
    } else {
      log('✓ No new recipes to upload');
    }

    // Sync deletions to database
    if (recipesToDelete.length > 0) {
      log(`🗑️ Syncing ${recipesToDelete.length} deletions to database...`);
      for (const recipeId of recipesToDelete) {
        await deleteRecipeFromDatabase(userId, recipeId);
      }
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

    // Debug: Log merged results
    const deletedInMerged = mergedRecipes.filter(r => r.deletedAt);
    const activeInMerged = mergedRecipes.filter(r => !r.deletedAt);
    log(`✅ Sync complete. ${mergedRecipes.length} total recipes`);
    log(`   - Active: ${activeInMerged.length}, Deleted: ${deletedInMerged.length}`);

    // Deduplicate by globalRecipeId and ID (merge folders, keep newest)
    const deduped = [];
    const seenGlobalIds = new Map();
    const seenIds = new Map();

    for (const recipe of mergedRecipes) {
      const key = recipe.globalRecipeId || recipe.id;
      const map = recipe.globalRecipeId ? seenGlobalIds : seenIds;
      const existingIndex = map.get(key);

      if (existingIndex === undefined) {
        map.set(key, deduped.length);
        deduped.push(recipe);
      } else {
        const existing = deduped[existingIndex];
        // Merge folders
        const existingFolders = existing.folders || [existing.folder || 'All Recipes'];
        const newFolders = recipe.folders || [recipe.folder || 'All Recipes'];
        const mergedFolders = [...new Set([...existingFolders, ...newFolders])];

        // Keep the newer recipe but with merged folders
        const existingTime = existing.updatedAt || existing.createdAt || 0;
        const newTime = recipe.updatedAt || recipe.createdAt || 0;
        if (newTime > existingTime) {
          deduped[existingIndex] = { ...recipe, folders: mergedFolders, folder: mergedFolders.find(f => f !== 'All Recipes') || mergedFolders[0] };
        } else {
          existing.folders = mergedFolders;
          existing.folder = mergedFolders.find(f => f !== 'All Recipes') || mergedFolders[0];
        }
      }
    }

    if (deduped.length !== mergedRecipes.length) {
      log(`⚠️ Merged ${mergedRecipes.length - deduped.length} duplicate recipes`);
    }

    return deduped;
  } catch (error) {
    console.error('❌ Error syncing recipes:', error);
    throw error;
  }
};

/**
 * Save folders to database
 * @param {string} userId - User's unique ID
 * @param {Array} folders - Array of folder names
 */
export const saveFoldersToDatabase = async (userId, folders) => {
  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        folders: folders,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;

    log(`✅ Saved ${folders.length} folders`);
  } catch (error) {
    console.error('❌ Error saving folders:', error);
    throw error;
  }
};

/**
 * Load folders from database
 * @param {string} userId - User's unique ID
 * @returns {Promise<Array>} Array of folder names
 */
export const loadFoldersFromDatabase = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('folders')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const folders = data?.folders || [];
    log(`✅ Loaded ${folders.length} folders`);
    return folders;
  } catch (error) {
    console.error('❌ Error loading folders:', error);
    return [];
  }
};

/**
 * Save tag search counts to database (user_settings.tag_search_counts)
 * @param {string} userId - User's unique ID
 * @param {Object} counts - { [tagLowercase]: { display, count, lastUsed } }
 */
export const saveTagSearchCountsToDatabase = async (userId, counts) => {
  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        tag_search_counts: counts || {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Error saving tag search counts:', error);
    return false;
  }
};

/**
 * Load tag search counts from database
 * @param {string} userId - User's unique ID
 * @returns {Promise<Object>} counts object (empty on error/missing)
 */
export const loadTagSearchCountsFromDatabase = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('tag_search_counts')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return data?.tag_search_counts || {};
  } catch (error) {
    console.error('❌ Error loading tag search counts:', error);
    return {};
  }
};

/**
 * Delete ALL recipes for a user (hard delete from database)
 * Used when user clears all data
 * @param {string} userId - User's unique ID
 */
export const deleteAllRecipesFromDatabase = async (userId) => {
  try {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    log(`✅ Deleted all recipes for user ${userId} from database`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting all recipes:', error);
    throw error;
  }
};

// ============================================================================
// MIGRATION V2: Dual-write functions for global_recipes + user_recipes_v2
// These run in parallel with the existing recipes table during migration
// ============================================================================

/**
 * Check if a recipe URL already exists in global_recipes
 * @param {string} sourceUrl - The recipe URL to check
 * @returns {Promise<Object|null>} The global recipe if found, null otherwise
 */
export const findGlobalRecipeByUrl = async (sourceUrl) => {
  if (!sourceUrl) return null;

  try {
    const { data, error } = await supabase
      .from('global_recipes')
      .select('*')
      .eq('source_url', sourceUrl)
      .single();

    if (error && error.code === 'PGRST116') {
      // Not found
      return null;
    }
    if (error) throw error;

    return data;
  } catch (error) {
    console.error('❌ Error finding global recipe:', error);
    return null;
  }
};

/**
 * Fetch a global recipe by its id (for recipe deep links)
 * @param {string} globalRecipeId
 * @returns {Promise<Object|null>}
 */
export const getGlobalRecipeById = async (globalRecipeId) => {
  if (!globalRecipeId) return null;
  try {
    const { data, error } = await supabase
      .from('global_recipes')
      .select('*')
      .eq('id', globalRecipeId)
      .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('❌ Error fetching global recipe by id:', error);
    return null;
  }
};

/**
 * Create a new global recipe entry
 * @param {Object} recipe - Recipe data
 * @returns {Promise<Object|null>} The created global recipe
 */
export const createGlobalRecipe = async (recipe) => {
  const sourceUrl = recipe.url || recipe.sourceUrl || recipe.source_url;
  if (!sourceUrl) return null;

  try {
    // Serialize ingredients/instructions as JSON
    let ingredients = recipe.ingredients;
    if (typeof ingredients === 'object' && ingredients !== null) {
      ingredients = ingredients;
    } else if (typeof ingredients === 'string') {
      try {
        ingredients = JSON.parse(ingredients);
      } catch {
        ingredients = { main: ingredients.split('\n').filter(l => l.trim()) };
      }
    }

    let instructions = recipe.instructions;
    if (typeof instructions === 'string') {
      try {
        instructions = JSON.parse(instructions);
      } catch {
        instructions = instructions.split('\n').filter(l => l.trim());
      }
    }

    // High-confidence auto-tags, computed once and stored on the global
    // (shared, unchanging) version of the recipe
    const autoTags = getHighConfidenceTags({
      title: recipe.title,
      instructions: instructions,
      prep_time: recipe.prep_time || recipe.prepTime,
      cook_time: recipe.cook_time || recipe.cookTime,
      total_time: recipe.total_time || recipe.totalTime,
    });

    const { data, error } = await supabase
      .from('global_recipes')
      .insert({
        source_url: sourceUrl,
        title: recipe.title || 'Untitled Recipe',
        ingredients: ingredients,
        instructions: instructions,
        image_url: recipe.imageUrl || recipe.image_url || recipe.image || null,
        prep_time: recipe.prep_time || recipe.prepTime || null,
        cook_time: recipe.cook_time || recipe.cookTime || null,
        total_time: recipe.total_time || recipe.totalTime || null,
        servings: recipe.servings || null,
        nutrition: recipe.nutrition || null,
        author: recipe.author || null,
        description: recipe.description || null,
        cuisine: recipe.cuisine || null,
        category: recipe.category || null,
        tags: autoTags,
      })
      .select()
      .single();

    if (error) {
      // If duplicate key error, recipe already exists - fetch it
      if (error.code === '23505') {
        log('🔄 Global recipe already exists, fetching...');
        return await findGlobalRecipeByUrl(sourceUrl);
      }
      throw error;
    }

    log(`✅ Created global recipe: ${recipe.title}`);
    return data;
  } catch (error) {
    console.error('❌ Error creating global recipe:', error);
    return null;
  }
};

/**
 * Save to user_recipes_v2 table (dual-write)
 * @param {string} userId - User's unique ID
 * @param {Object} recipe - Recipe data
 * @param {string|null} globalRecipeId - ID of global recipe (null for manual recipes)
 */
export const saveToUserRecipesV2 = async (userId, recipe, globalRecipeId = null) => {
  try {
    // For manual recipes (no URL), store full data in local_recipe_data
    let localRecipeData = null;
    if (!globalRecipeId) {
      // Serialize ingredients/instructions
      let ingredients = recipe.ingredients;
      if (typeof ingredients === 'object' && ingredients !== null) {
        ingredients = ingredients;
      } else if (typeof ingredients === 'string') {
        try {
          ingredients = JSON.parse(ingredients);
        } catch {
          ingredients = { main: ingredients.split('\n').filter(l => l.trim()) };
        }
      }

      let instructions = recipe.instructions;
      if (typeof instructions === 'string') {
        try {
          instructions = JSON.parse(instructions);
        } catch {
          instructions = instructions.split('\n').filter(l => l.trim());
        }
      }

      localRecipeData = {
        id: recipe.id,
        title: recipe.title,
        ingredients: ingredients,
        instructions: instructions,
        source: recipe.source || null, // 'manual' | 'scan' | null
        image_url: recipe.imageUrl || recipe.image_url || recipe.image || null,
        folders: recipe.folders || (recipe.folder ? [recipe.folder] : ['All Recipes']),
        folder: recipe.folder || recipe.folders?.[0] || 'All Recipes',
        prep_time: recipe.prep_time || recipe.prepTime || null,
        cook_time: recipe.cook_time || recipe.cookTime || null,
        total_time: recipe.total_time || recipe.totalTime || null,
        servings: recipe.servings || null,
        nutrition: recipe.nutrition || null,
        createdBy: recipe.createdBy || null,
        createdAt: recipe.createdAt || Date.now(),
      };
    }

    // Build local_edits with variants support
    let localEdits = null;

    if (recipe.variants && recipe.variants.length > 0) {
      // New variants format
      localEdits = {
        variants: recipe.variants,
        selectedVariantId: recipe.selectedVariantId || null,
      };
    } else if (recipe.hasEdits && recipe.editedVersion) {
      // Legacy single-edit format - convert to variant
      localEdits = {
        variants: [{
          id: 'default-edit',
          name: 'My Edits',
          edits: {
            title: recipe.editedVersion?.title,
            ingredients: recipe.editedVersion?.ingredients,
            instructions: recipe.editedVersion?.instructions,
          },
          createdAt: Date.now(),
        }],
        selectedVariantId: recipe.viewingOriginal ? null : 'default-edit',
        // Preserve edit history for migration
        editHistory: recipe.editHistory || [],
      };
    }

    const { error } = await supabase
      .from('user_recipes_v2')
      .upsert({
        id: recipe.id,
        user_id: userId,
        global_recipe_id: globalRecipeId,
        local_recipe_data: localRecipeData,
        local_edits: localEdits,
        folders: recipe.folders || [recipe.folder || 'All Recipes'],
        folder: recipe.folder || recipe.folders?.[0] || 'All Recipes',
        tags: recipe.tags || [],
        is_favorite: recipe.isFavorite || false,
        notes: recipe.notes || null,
        imported_from: recipe.importedFrom || null,
        imported_at: recipe.importedAt ? new Date(recipe.importedAt).toISOString() : null,
        deleted_at: recipe.deletedAt ? new Date(recipe.deletedAt).toISOString() : null,
        created_at: recipe.createdAt ? new Date(recipe.createdAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) throw error;

    log(`✅ [V2] Saved to user_recipes_v2: ${recipe.title}`);
    return true;
  } catch (error) {
    console.error('❌ [V2] Error saving to user_recipes_v2:', error);
    // Don't throw - this is dual-write, old table is still primary
    return false;
  }
};

/**
 * Dual-write: Save recipe to both old and new tables
 * @param {string} userId - User's unique ID
 * @param {Object} recipe - Recipe data
 */
export const saveRecipeWithDualWrite = async (userId, recipe) => {
  // 1. Save to OLD table (primary - existing behavior)
  await saveRecipeToDatabase(userId, recipe);

  // 2. Save to NEW tables (secondary - migration)
  try {
    let sourceUrl = recipe.url || recipe.sourceUrl || recipe.source_url;
    let globalRecipeId = null;

    // For manual recipes (no external URL), use Bunches user as source
    if (!sourceUrl) {
      // Generate a Bunches source URL: bunches://user/{userId}/recipes/{recipeId}
      sourceUrl = `bunches://user/${userId}/recipes/${recipe.id}`;

      // Add creator info to recipe for global entry
      const recipeWithSource = {
        ...recipe,
        source_url: sourceUrl,
        author: recipe.createdBy?.username || 'Bunches User',
      };

      // Check if this manual recipe already exists globally
      let globalRecipe = await findGlobalRecipeByUrl(sourceUrl);

      if (!globalRecipe) {
        globalRecipe = await createGlobalRecipe(recipeWithSource);
      } else {
        // Owner-controlled global entry (bunches:// source): keep its
        // photo in sync when the user adds/changes/removes one later
        const currentImage = recipe.imageUrl || recipe.image_url || recipe.image || null;
        if ((globalRecipe.image_url || null) !== currentImage) {
          await supabase
            .from('global_recipes')
            .update({ image_url: currentImage })
            .eq('id', globalRecipe.id);
          log('🖼️ Updated global recipe photo');
        }
      }

      globalRecipeId = globalRecipe?.id || null;
    } else {
      // External URL - check if global recipe exists
      let globalRecipe = await findGlobalRecipeByUrl(sourceUrl);

      if (!globalRecipe) {
        // Create new global recipe
        globalRecipe = await createGlobalRecipe(recipe);
      }

      globalRecipeId = globalRecipe?.id || null;
    }

    // Save to user_recipes_v2
    await saveToUserRecipesV2(userId, recipe, globalRecipeId);

    log(`✅ [DUAL] Recipe saved to both tables: ${recipe.title}`);
  } catch (error) {
    // Log but don't fail - old table write succeeded
    console.error('⚠️ [DUAL] V2 write failed (old table succeeded):', error);
  }
};

export default {
  saveRecipesToDatabase,
  loadRecipesFromDatabase,
  saveRecipeToDatabase,
  deleteRecipeFromDatabase,
  deleteAllRecipesFromDatabase,
  syncRecipes,
  saveFoldersToDatabase,
  loadFoldersFromDatabase,
  saveTagSearchCountsToDatabase,
  loadTagSearchCountsFromDatabase,
  // V2 Migration exports
  findGlobalRecipeByUrl,
  getGlobalRecipeById,
  createGlobalRecipe,
  saveToUserRecipesV2,
  saveRecipeWithDualWrite,
};

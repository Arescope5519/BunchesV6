/**
 * FILENAME: src/services/supabase/sharedFolders.js
 * PURPOSE: Shared cookbooks - folders several accounts add recipes to.
 *
 * Access control lives in RLS (sql/shared_folders.sql): owner invites /
 * removes members and any recipe; every member adds recipes and removes
 * their own additions. Content is references to global_recipes - the
 * shared layer only, so personal notes and edits are never exposed.
 */

import { supabase } from './config';
import { log } from '../../utils/log';

// Same tolerant parsing as getFullPublicRecipe in social.js - global
// rows store ingredients as a sections object and instructions as an
// array, but older rows can be strings.
const parseIngredients = (raw) => {
  if (!raw) return { main: [] };
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (Array.isArray(raw)) return { main: raw };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed)) return { main: parsed };
    return { main: [String(parsed)] };
  } catch {
    return { main: String(raw).split('\n').filter(l => l.trim()) };
  }
};

const parseInstructions = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return String(raw).split('\n').filter(l => l.trim());
  }
};

const fetchUsernames = async (userIds) => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, username')
    .in('user_id', ids);
  const map = {};
  (data || []).forEach(p => { map[p.user_id] = p.username; });
  return map;
};

// Shape a shared-folder recipe like getFullPublicRecipe does, so the
// existing RecipeDetail (read-only) and import flow take it as-is.
const formatSharedRecipe = (row, usernames) => {
  const g = row.global_recipes || {};
  return {
    id: g.id,
    globalRecipeId: g.id,
    title: g.title || 'Untitled',
    image_url: g.image_url || null,
    imageUrl: g.image_url || null,
    source_url: g.source_url || null,
    sourceUrl: g.source_url || null,
    ingredients: parseIngredients(g.ingredients),
    instructions: parseInstructions(g.instructions),
    servings: g.servings || null,
    total_time: g.total_time || null,
    nutrition: g.nutrition || null,
    author: g.author || null,
    tags: Array.isArray(g.tags) ? g.tags : [],
    folders: [],
    folder: 'All Recipes',
    addedBy: row.added_by,
    addedByUsername: usernames[row.added_by] || null,
    addedAt: row.added_at,
    ownerUserId: row.added_by,
    ownerUsername: usernames[row.added_by] || null,
    isReadOnly: true,
  };
};

export const createSharedFolder = async (name) => {
  try {
    const { data, error } = await supabase.rpc('create_shared_folder', {
      folder_name: name,
    });
    if (error) {
      console.error('❌ createSharedFolder error:', error);
      return { success: false };
    }
    return { success: true, folderId: data };
  } catch (err) {
    console.error('❌ createSharedFolder error:', err);
    return { success: false };
  }
};

/**
 * Everything the cookbook page needs: my active shared folders (with
 * member + recipe counts) and my pending invites.
 */
export const getMySharedFolders = async (userId) => {
  try {
    const { data: memberships, error } = await supabase
      .from('shared_folder_members')
      .select('folder_id, role, status, invited_by, shared_folders (id, name, owner_id)')
      .eq('user_id', userId);
    if (error || !memberships) {
      if (error) console.error('❌ getMySharedFolders error:', error);
      return { folders: [], invites: [] };
    }

    const active = memberships.filter(m => m.status === 'active' && m.shared_folders);
    const invited = memberships.filter(m => m.status === 'invited' && m.shared_folders);
    const activeIds = active.map(m => m.folder_id);

    // Counts across all my folders in two queries, tallied client-side
    let memberCounts = {};
    let recipeCounts = {};
    if (activeIds.length > 0) {
      const [{ data: mRows }, { data: rRows }] = await Promise.all([
        supabase.from('shared_folder_members')
          .select('folder_id').in('folder_id', activeIds).eq('status', 'active'),
        supabase.from('shared_folder_recipes')
          .select('folder_id').in('folder_id', activeIds),
      ]);
      (mRows || []).forEach(r => { memberCounts[r.folder_id] = (memberCounts[r.folder_id] || 0) + 1; });
      (rRows || []).forEach(r => { recipeCounts[r.folder_id] = (recipeCounts[r.folder_id] || 0) + 1; });
    }

    const usernames = await fetchUsernames(
      invited.flatMap(m => [m.invited_by, m.shared_folders.owner_id])
    );

    return {
      folders: active.map(m => ({
        id: m.shared_folders.id,
        name: m.shared_folders.name,
        ownerId: m.shared_folders.owner_id,
        isOwner: m.shared_folders.owner_id === userId,
        role: m.role,
        memberCount: memberCounts[m.folder_id] || 1,
        recipeCount: recipeCounts[m.folder_id] || 0,
      })),
      invites: invited.map(m => ({
        folderId: m.shared_folders.id,
        name: m.shared_folders.name,
        invitedByUsername: usernames[m.invited_by] || usernames[m.shared_folders.owner_id] || null,
      })),
    };
  } catch (err) {
    console.error('❌ getMySharedFolders error:', err);
    return { folders: [], invites: [] };
  }
};

export const respondToSharedInvite = async (folderId, userId, accept) => {
  try {
    if (accept) {
      const { error } = await supabase
        .from('shared_folder_members')
        .update({ status: 'active' })
        .eq('folder_id', folderId)
        .eq('user_id', userId);
      return !error;
    }
    const { error } = await supabase
      .from('shared_folder_members')
      .delete()
      .eq('folder_id', folderId)
      .eq('user_id', userId);
    return !error;
  } catch (err) {
    console.error('❌ respondToSharedInvite error:', err);
    return false;
  }
};

/**
 * Full folder contents: members (with usernames) and recipes formatted
 * for RecipeDetail / the import flow.
 */
export const getSharedFolderDetail = async (folderId) => {
  try {
    const [{ data: members, error: mErr }, { data: recipeRows, error: rErr }] = await Promise.all([
      supabase.from('shared_folder_members')
        .select('user_id, role, status, created_at')
        .eq('folder_id', folderId),
      supabase.from('shared_folder_recipes')
        .select(`
          global_recipe_id, added_by, added_at,
          global_recipes (
            id, title, image_url, source_url, ingredients, instructions,
            servings, total_time, nutrition, author, tags
          )
        `)
        .eq('folder_id', folderId)
        .order('added_at', { ascending: false }),
    ]);
    if (mErr || rErr) {
      console.error('❌ getSharedFolderDetail error:', mErr || rErr);
      return null;
    }

    const usernames = await fetchUsernames([
      ...(members || []).map(m => m.user_id),
      ...(recipeRows || []).map(r => r.added_by),
    ]);

    return {
      members: (members || []).map(m => ({
        userId: m.user_id,
        username: usernames[m.user_id] || null,
        role: m.role,
        status: m.status,
      })),
      recipes: (recipeRows || [])
        .filter(r => r.global_recipes)
        .map(r => formatSharedRecipe(r, usernames)),
    };
  } catch (err) {
    console.error('❌ getSharedFolderDetail error:', err);
    return null;
  }
};

export const inviteToSharedFolder = async (folderId, inviterId, inviteeId) => {
  try {
    const { error } = await supabase.from('shared_folder_members').insert({
      folder_id: folderId,
      user_id: inviteeId,
      role: 'editor',
      status: 'invited',
      invited_by: inviterId,
    });
    if (error) {
      if (error.code === '23505') return { success: false, duplicate: true };
      console.error('❌ inviteToSharedFolder error:', error);
      return { success: false };
    }
    return { success: true };
  } catch (err) {
    console.error('❌ inviteToSharedFolder error:', err);
    return { success: false };
  }
};

// Covers remove (owner acting on someone) and leave/decline (acting on
// yourself) - RLS decides which is allowed.
export const removeSharedFolderMember = async (folderId, userId) => {
  try {
    const { error } = await supabase
      .from('shared_folder_members')
      .delete()
      .eq('folder_id', folderId)
      .eq('user_id', userId);
    return !error;
  } catch (err) {
    console.error('❌ removeSharedFolderMember error:', err);
    return false;
  }
};

export const addRecipeToSharedFolder = async (folderId, globalRecipeId, userId) => {
  try {
    const { error } = await supabase.from('shared_folder_recipes').insert({
      folder_id: folderId,
      global_recipe_id: globalRecipeId,
      added_by: userId,
    });
    if (error) {
      if (error.code === '23505') return { success: true, duplicate: true };
      console.error('❌ addRecipeToSharedFolder error:', error);
      return { success: false };
    }
    log('📁 Added recipe to shared folder', folderId);
    return { success: true };
  } catch (err) {
    console.error('❌ addRecipeToSharedFolder error:', err);
    return { success: false };
  }
};

/**
 * Bulk add (importing a whole local cookbook). Duplicates - recipes
 * someone already added - are silently skipped via ON CONFLICT DO
 * NOTHING, so re-importing a folder is safe.
 */
export const addRecipesToSharedFolder = async (folderId, globalRecipeIds, userId) => {
  try {
    const rows = [...new Set(globalRecipeIds.filter(Boolean))].map(gid => ({
      folder_id: folderId,
      global_recipe_id: gid,
      added_by: userId,
    }));
    if (rows.length === 0) return { success: true, added: 0 };
    const { error } = await supabase
      .from('shared_folder_recipes')
      .upsert(rows, { onConflict: 'folder_id,global_recipe_id', ignoreDuplicates: true });
    if (error) {
      console.error('❌ addRecipesToSharedFolder error:', error);
      return { success: false };
    }
    log('📁 Bulk-added', rows.length, 'recipes to shared folder', folderId);
    return { success: true, added: rows.length };
  } catch (err) {
    console.error('❌ addRecipesToSharedFolder error:', err);
    return { success: false };
  }
};

export const removeRecipeFromSharedFolder = async (folderId, globalRecipeId) => {
  try {
    const { error } = await supabase
      .from('shared_folder_recipes')
      .delete()
      .eq('folder_id', folderId)
      .eq('global_recipe_id', globalRecipeId);
    return !error;
  } catch (err) {
    console.error('❌ removeRecipeFromSharedFolder error:', err);
    return false;
  }
};

export const deleteSharedFolder = async (folderId) => {
  try {
    const { error } = await supabase
      .from('shared_folders')
      .delete()
      .eq('id', folderId);
    return !error;
  } catch (err) {
    console.error('❌ deleteSharedFolder error:', err);
    return false;
  }
};

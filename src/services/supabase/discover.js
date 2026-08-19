/**
 * FILENAME: src/services/supabase/discover.js
 * PURPOSE: Discover feed queries - browse recipes from followed users and
 * from public profiles.
 *
 * Privacy model: this feed NEVER queries global_recipes directly. Every
 * user recipe has a global counterpart (the dual-write), including ones
 * their owner considers private, so a raw global_recipes browse would
 * leak private recipes. Instead both feeds start from user_profiles rows
 * with is_public = true - the same gate the profile viewer uses - and
 * read those users' user_recipes_v2 rows, which RLS already permits
 * (UserProfile.js relies on the same cross-user read).
 *
 * Gated behind the "discover" feature flag (sql/add_feature_flags.sql);
 * admins always see it.
 */

import { supabase } from './config';
import { log } from '../../utils/log';

export const DISCOVER_PAGE_SIZE = 24;

/**
 * Flatten an ingredients value (object of sections, array, or JSON/text
 * string) into a plain list of lines for the feed preview.
 */
const flattenIngredients = (raw) => {
  if (!raw) return [];
  let val = raw;
  if (typeof val === 'string') {
    try { val = JSON.parse(val); }
    catch { return val.split('\n').map(l => l.trim()).filter(Boolean); }
  }
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'object') {
    return Object.values(val).flat().map(String);
  }
  return [];
};

/**
 * Map a user_recipes_v2 row (joined with global_recipes) to a feed card.
 * Mirrors the id/title/image resolution in getUserPublicRecipes so
 * getFullPublicRecipe(ownerUserId, id) finds the same recipe.
 */
const mapRowToCard = (row, profileMap) => {
  const local = row.local_recipe_data || {};
  const profile = profileMap[row.user_id] || {};
  return {
    id: local.id || row.id,
    ownerUserId: row.user_id,
    ownerUsername: profile.username || 'Unknown',
    ownerAvatarUrl: profile.avatar_url || null,
    title: local.title || row.global_recipes?.title || 'Untitled',
    imageUrl: local.image_url || local.imageUrl || row.global_recipes?.image_url || null,
    ingredientLines: flattenIngredients(local.ingredients || row.global_recipes?.ingredients),
    globalRecipeId: row.global_recipe_id || null,
    createdAt: row.created_at,
  };
};

/**
 * Shared recipe-page query for a set of owner ids.
 */
const fetchRecipesForUsers = async (userIds, profileMap, offset, limit) => {
  if (!userIds.length) return [];

  const { data, error } = await supabase
    .from('user_recipes_v2')
    .select(`
      id,
      user_id,
      local_recipe_data,
      global_recipe_id,
      created_at,
      global_recipes (
        id,
        title,
        image_url,
        source_url,
        ingredients
      )
    `)
    .in('user_id', userIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data || []).map(row => mapRowToCard(row, profileMap));
};

/**
 * Fetch public profiles for a set of user ids, returning only the public
 * ones as an id -> {username, avatar_url} map.
 */
const fetchPublicProfileMap = async (userIds) => {
  if (!userIds.length) return {};
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, username, avatar_url, is_public')
    .in('user_id', userIds)
    .eq('is_public', true);

  if (error) throw error;
  const map = {};
  (data || []).forEach(p => { map[p.user_id] = p; });
  return map;
};

/**
 * Feed of recent recipes from users the current user follows.
 * Only followed users with PUBLIC profiles appear - following someone
 * whose profile has since gone private stops showing their recipes,
 * matching the profile viewer's behavior.
 */
export const getDiscoverFollowingFeed = async (userId, { offset = 0, limit = DISCOVER_PAGE_SIZE } = {}) => {
  try {
    const { data: follows, error } = await supabase
      .from('user_followers')
      .select('following_id')
      .eq('follower_id', userId);

    if (error) throw error;

    const followedIds = (follows || []).map(f => f.following_id);
    const profileMap = await fetchPublicProfileMap(followedIds);
    const publicIds = Object.keys(profileMap);

    const cards = await fetchRecipesForUsers(publicIds, profileMap, offset, limit);
    log(`🧭 Discover following feed: ${cards.length} recipes from ${publicIds.length} followed users`);
    return cards;
  } catch (err) {
    // Rethrow so the UI can show the reason - a silent [] here is
    // indistinguishable from a legitimately empty feed
    console.error('❌ getDiscoverFollowingFeed error:', err);
    throw err;
  }
};

/**
 * Feed of recent recipes from all public profiles (excluding the current
 * user's own). This is the deliberately-simple v1: newest first, no
 * ranking. The algorithmic version replaces the ordering here without
 * touching the UI.
 */
export const getDiscoverPublicFeed = async (userId, { offset = 0, limit = DISCOVER_PAGE_SIZE } = {}) => {
  try {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('user_id, username, avatar_url')
      .eq('is_public', true)
      .neq('user_id', userId)
      .limit(200);

    if (error) throw error;

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
    const publicIds = Object.keys(profileMap);

    const cards = await fetchRecipesForUsers(publicIds, profileMap, offset, limit);
    log(`🧭 Discover public feed: ${cards.length} recipes from ${publicIds.length} public users`);
    return cards;
  } catch (err) {
    console.error('❌ getDiscoverPublicFeed error:', err);
    throw err;
  }
};

// ============================================================
// Likes (sql/add_recipe_likes.sql) - keyed by global recipe id so one
// recipe accumulates one count across everyone who saved it
// ============================================================

/**
 * Like status for a page of feed cards in one query.
 * @returns {{ counts: Object<string, number>, likedByMe: Set<string> }}
 */
export const getLikesForRecipes = async (userId, globalRecipeIds) => {
  const ids = (globalRecipeIds || []).filter(Boolean);
  if (!ids.length) return { counts: {}, likedByMe: new Set() };

  const { data, error } = await supabase
    .from('recipe_likes')
    .select('global_recipe_id, user_id')
    .in('global_recipe_id', ids);

  if (error) throw error;

  const counts = {};
  const likedByMe = new Set();
  (data || []).forEach(row => {
    counts[row.global_recipe_id] = (counts[row.global_recipe_id] || 0) + 1;
    if (row.user_id === userId) likedByMe.add(row.global_recipe_id);
  });
  return { counts, likedByMe };
};

export const likeRecipe = async (userId, globalRecipeId) => {
  const { error } = await supabase
    .from('recipe_likes')
    .insert({ user_id: userId, global_recipe_id: globalRecipeId });
  // 23505 = already liked (double-tap race) - fine
  if (error && error.code !== '23505') throw error;
  return true;
};

export const unlikeRecipe = async (userId, globalRecipeId) => {
  const { error } = await supabase
    .from('recipe_likes')
    .delete()
    .eq('user_id', userId)
    .eq('global_recipe_id', globalRecipeId);
  if (error) throw error;
  return true;
};

export default {
  DISCOVER_PAGE_SIZE,
  getDiscoverFollowingFeed,
  getDiscoverPublicFeed,
  getLikesForRecipes,
  likeRecipe,
  unlikeRecipe,
};

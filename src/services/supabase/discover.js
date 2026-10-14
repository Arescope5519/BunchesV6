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
    tags: Array.isArray(row.global_recipes?.tags) ? row.global_recipes.tags : [],
    globalRecipeId: row.global_recipe_id || null,
    createdAt: row.created_at,
  };
};

// Seeded shuffle so the feed is randomized per LOAD, not per page:
// every page of one session agrees on the same arrangement (no
// duplicates while scrolling), and pull-to-refresh rolls a new seed.
// The future ranking algorithm replaces this in the same slot.
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const seededShuffle = (arr, seed) => {
  const rand = mulberry32(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Only the newest N recipes compete for the shuffled feed, so it
// stays loosely recent without being a strict timeline
const SHUFFLE_WINDOW = 150;

/**
 * Shared recipe-page query for a set of owner ids. With a `seed`, the
 * newest SHUFFLE_WINDOW rows are shuffled deterministically and paged
 * from that arrangement; without one, plain newest-first.
 */
const fetchRecipesForUsers = async (userIds, profileMap, offset, limit, seed = null) => {
  if (!userIds.length) return [];

  const windowed = seed != null;
  const query = supabase
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
        ingredients,
        tags
      )
    `)
    .in('user_id', userIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(windowed ? 0 : offset, windowed ? SHUFFLE_WINDOW - 1 : offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  const cards = (data || []).map(row => mapRowToCard(row, profileMap));
  if (!windowed) return cards;
  return seededShuffle(cards, seed).slice(offset, offset + limit);
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
export const getDiscoverFollowingFeed = async (userId, { offset = 0, limit = DISCOVER_PAGE_SIZE, seed = null } = {}) => {
  try {
    const { data: follows, error } = await supabase
      .from('user_followers')
      .select('following_id')
      .eq('follower_id', userId);

    if (error) throw error;

    const followedIds = (follows || []).map(f => f.following_id);
    const profileMap = await fetchPublicProfileMap(followedIds);
    const publicIds = Object.keys(profileMap);

    const cards = await fetchRecipesForUsers(publicIds, profileMap, offset, limit, seed);
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
export const getDiscoverPublicFeed = async (userId, { offset = 0, limit = DISCOVER_PAGE_SIZE, seed = null } = {}) => {
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

    const cards = await fetchRecipesForUsers(publicIds, profileMap, offset, limit, seed);
    log(`🧭 Discover public feed: ${cards.length} recipes from ${publicIds.length} public users`);
    return cards;
  } catch (err) {
    console.error('❌ getDiscoverPublicFeed error:', err);
    throw err;
  }
};

// ============================================================
// Shelves - Grubhub-style horizontal rails slotted between the big
// Following cards. v1 picks subjects with a plain heuristic (the most
// active public user, the most common tag in a recent sample); the
// future algorithm replaces THIS function only - the card shape and UI
// stay put.
//
// Compliance note (CLAUDE.md "declarations that go stale"): shelves
// are curated content. Fine behind the discover flag; re-check the
// content-rating answers before launching them to everyone.
// ============================================================

const SHELF_SIZE = 10;
const SHELF_MIN = 3;

/**
 * Build one user shelf and one tag shelf from a single sample of recent
 * public recipes. Either can be null when the data is too thin.
 * @returns {Promise<Array<{type, key, title, cards}>>}
 */
export const getFeedShelves = async (userId) => {
  try {
    // Fresh seed per load: shelf composition varies too, not just order
    const sample = await getDiscoverPublicFeed(userId, { offset: 0, limit: 60, seed: Date.now() >>> 0 });
    const shelves = [];

    // User shelf: whoever has the most recipes in the sample
    const byOwner = {};
    sample.forEach(c => {
      (byOwner[c.ownerUserId] = byOwner[c.ownerUserId] || []).push(c);
    });
    const topOwner = Object.values(byOwner)
      .sort((a, b) => b.length - a.length)[0];
    if (topOwner && topOwner.length >= SHELF_MIN) {
      shelves.push({
        type: 'user',
        key: `user:${topOwner[0].ownerUserId}`,
        title: `More from @${topOwner[0].ownerUsername}`,
        cards: topOwner.slice(0, SHELF_SIZE),
      });
    }

    // Tag shelf: the most common tag, skipping the user shelf's owner
    // dominating it with the same rows where possible
    const byTag = {};
    sample.forEach(c => {
      (c.tags || []).forEach(tag => {
        (byTag[tag] = byTag[tag] || []).push(c);
      });
    });
    const topTagEntry = Object.entries(byTag)
      .sort((a, b) => b[1].length - a[1].length)[0];
    if (topTagEntry && topTagEntry[1].length >= SHELF_MIN) {
      const [tag, cards] = topTagEntry;
      const label = tag.charAt(0).toUpperCase() + tag.slice(1);
      shelves.push({
        type: 'tag',
        key: `tag:${tag}`,
        title: label,
        cards: cards.slice(0, SHELF_SIZE),
      });
    }

    log(`🧭 Feed shelves: ${shelves.map(s => s.key).join(', ') || 'none'}`);
    return shelves;
  } catch (err) {
    // Shelves are garnish - a failure should never take down the feed
    console.error('❌ getFeedShelves error:', err);
    return [];
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

/**
 * Everything the user has liked, newest like first. Likes store the
 * global id, but the privacy rule holds: cards resolve through
 * user_recipes_v2 (RLS decides what this viewer may still see), never
 * global_recipes directly - a liked recipe whose owners all went
 * private quietly drops out.
 */
export const getLikedFeed = async (userId, { offset = 0, limit = DISCOVER_PAGE_SIZE } = {}) => {
  try {
    const { data: likes, error } = await supabase
      .from('recipe_likes')
      .select('global_recipe_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const likedIds = (likes || []).map(l => l.global_recipe_id);
    if (!likedIds.length) return [];
    const likedAt = {};
    likes.forEach(l => { likedAt[l.global_recipe_id] = l.created_at; });

    const { data: rows, error: rowErr } = await supabase
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
          ingredients,
          tags
        )
      `)
      .in('global_recipe_id', likedIds)
      .is('deleted_at', null);
    if (rowErr) throw rowErr;

    // RLS already decided we may see these rows, so any readable
    // owner profile serves for attribution (no is_public filter -
    // a friend's shared recipe is legitimately visible here)
    const ownerIds = [...new Set((rows || []).map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, username, avatar_url')
      .in('user_id', ownerIds);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

    // One card per liked recipe (prefer a copy whose owner resolves),
    // in the order the likes happened
    const byGlobal = new Map();
    (rows || []).forEach(r => {
      const existing = byGlobal.get(r.global_recipe_id);
      if (!existing || (!profileMap[existing.user_id] && profileMap[r.user_id])) {
        byGlobal.set(r.global_recipe_id, r);
      }
    });

    const cards = likedIds
      .map(gid => byGlobal.get(gid))
      .filter(Boolean)
      .map(row => ({ ...mapRowToCard(row, profileMap), likedAt: likedAt[row.global_recipe_id] }));
    log(`🧭 Liked feed: ${cards.length} of ${likedIds.length} likes still visible`);
    return cards;
  } catch (err) {
    console.error('❌ getLikedFeed error:', err);
    throw err;
  }
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
  getFeedShelves,
  getLikedFeed,
  getLikesForRecipes,
  likeRecipe,
  unlikeRecipe,
};

/**
 * FILENAME: src/components/DiscoverFeed.js
 * PURPOSE: The Feed - two very different presentations of other users'
 * recipes. Following is an Instagram-style full-width feed (big image,
 * fixed title + ingredients block, like/save/share actions) because it's
 * your friends and each recipe deserves real estate. Discover is a
 * 3-column collage for volume browsing. Feature-flagged via HomeScreen.
 *
 * Likes key off the GLOBAL recipe id (sql/add_recipe_likes.sql), so the
 * same shared recipe carries one count everywhere. Save and share
 * delegate to HomeScreen via props - they reuse the cookbook import
 * picker and the mutuals share sheet.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { LetterPlaceholder } from './LetterPlaceholder';
import {
  getDiscoverFollowingFeed,
  getDiscoverPublicFeed,
  getLikesForRecipes,
  likeRecipe,
  unlikeRecipe,
  DISCOVER_PAGE_SIZE,
} from '../services/supabase/discover';
import { getBlockedUsers } from '../services/supabase/social';
import { log } from '../utils/log';

const TABS = [
  { key: 'following', label: 'Following' },
  { key: 'everyone', label: 'Discover' },
];

const EMPTY_COPY = {
  following: {
    icon: 'people-outline',
    title: 'No recipes yet',
    body: 'Recipes from people you follow will show up here. Find friends in the Social tab to get started.',
  },
  everyone: {
    icon: 'compass-outline',
    title: 'Nothing here yet',
    body: 'Recipes from public profiles will show up here as the community grows.',
  },
};

const INGREDIENT_PREVIEW_LINES = 6;

const DiscoverFeed = ({ userId, onOpenRecipe, onSaveRecipe, onShareRecipe }) => {
  const [activeTab, setActiveTab] = useState('following');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [likeCounts, setLikeCounts] = useState({});
  const [likedSet, setLikedSet] = useState(new Set());
  const blockedIdsRef = useRef(null);

  const getBlockedIds = useCallback(async () => {
    if (blockedIdsRef.current) return blockedIdsRef.current;
    try {
      const blocked = await getBlockedUsers(userId);
      blockedIdsRef.current = new Set((blocked || []).map(b => b.userId || b.user_id || b.id));
    } catch {
      blockedIdsRef.current = new Set();
    }
    return blockedIdsRef.current;
  }, [userId]);

  const mergeLikeData = useCallback(async (cards) => {
    try {
      const ids = cards.map(c => c.globalRecipeId).filter(Boolean);
      if (!ids.length) return;
      const { counts, likedByMe } = await getLikesForRecipes(userId, ids);
      setLikeCounts(prev => ({ ...prev, ...counts }));
      setLikedSet(prev => {
        const next = new Set(prev);
        likedByMe.forEach(id => next.add(id));
        return next;
      });
    } catch (err) {
      // Likes are decoration on the feed - a failed fetch shouldn't
      // block the content
      console.error('❌ Like fetch failed:', err);
    }
  }, [userId]);

  const fetchPage = useCallback(async (tab, offset) => {
    const fetcher = tab === 'following' ? getDiscoverFollowingFeed : getDiscoverPublicFeed;
    const [cards, blockedIds] = await Promise.all([
      fetcher(userId, { offset, limit: DISCOVER_PAGE_SIZE }),
      getBlockedIds(),
    ]);

    // Drop blocked users, and collapse duplicates of the same shared
    // recipe (many users saving one import) down to the newest copy
    const seen = new Set();
    return cards.filter(c => {
      if (blockedIds.has(c.ownerUserId)) return false;
      const key = c.globalRecipeId || `${c.ownerUserId}:${c.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [userId, getBlockedIds]);

  const load = useCallback(async (tab, { refresh = false } = {}) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setFeedError(null);
    try {
      const cards = await fetchPage(tab, 0);
      setItems(cards);
      setHasMore(cards.length >= DISCOVER_PAGE_SIZE);
      mergeLikeData(cards);
    } catch (err) {
      setItems([]);
      setFeedError(err?.message || String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage, mergeLikeData]);

  useEffect(() => {
    if (!userId) return;
    load(activeTab);
  }, [userId, activeTab, load]);

  const loadMore = async () => {
    if (loadingMore || loading || refreshing || !hasMore) return;
    setLoadingMore(true);
    try {
      const cards = await fetchPage(activeTab, items.length);
      const existing = new Set(items.map(c => c.globalRecipeId || `${c.ownerUserId}:${c.id}`));
      const fresh = cards.filter(c => !existing.has(c.globalRecipeId || `${c.ownerUserId}:${c.id}`));
      setItems(prev => [...prev, ...fresh]);
      setHasMore(cards.length >= DISCOVER_PAGE_SIZE);
      mergeLikeData(fresh);
    } catch (err) {
      // Keep what's on screen; stop paging so this doesn't retry-loop
      console.error('❌ Discover loadMore error:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleLike = async (card) => {
    const gid = card.globalRecipeId;
    if (!gid) return;
    const wasLiked = likedSet.has(gid);

    // Optimistic flip; revert on failure
    setLikedSet(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(gid); else next.add(gid);
      return next;
    });
    setLikeCounts(prev => ({
      ...prev,
      [gid]: Math.max((prev[gid] || 0) + (wasLiked ? -1 : 1), 0),
    }));

    try {
      if (wasLiked) await unlikeRecipe(userId, gid);
      else await likeRecipe(userId, gid);
    } catch (err) {
      console.error('❌ Like toggle failed:', err);
      setLikedSet(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(gid); else next.delete(gid);
        return next;
      });
      setLikeCounts(prev => ({
        ...prev,
        [gid]: Math.max((prev[gid] || 0) + (wasLiked ? 1 : -1), 0),
      }));
    }
  };

  // --- Following: full-width feed card ---
  const renderFeedCard = ({ item }) => {
    const gid = item.globalRecipeId;
    const liked = gid ? likedSet.has(gid) : false;
    const count = gid ? (likeCounts[gid] || 0) : 0;
    return (
      <View style={styles.feedCard}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            log('🧭 Feed card opened:', item.title);
            onOpenRecipe(item);
          }}
        >
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.feedImage} resizeMode="cover" />
          ) : (
            <LetterPlaceholder title={item.title} size={64} style={styles.feedImage} />
          )}
          <View style={styles.feedBody}>
            <Text style={styles.feedOwner} numberOfLines={1}>@{item.ownerUsername}</Text>
            <Text style={styles.feedTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.feedIngredients} numberOfLines={INGREDIENT_PREVIEW_LINES}>
              {(item.ingredientLines || []).slice(0, INGREDIENT_PREVIEW_LINES).join('\n')}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.actionRow}>
          {gid ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => toggleLike(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={24}
                color={liked ? colors.error : colors.text}
              />
              {count > 0 && <Text style={styles.actionCount}>{count}</Text>}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onSaveRecipe?.(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="save-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onShareRecipe?.(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // --- Discover: collage tile ---
  const renderTile = ({ item }) => (
    <TouchableOpacity
      style={styles.tile}
      activeOpacity={0.85}
      onPress={() => {
        log('🧭 Discover card opened:', item.title);
        onOpenRecipe(item);
      }}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.tileImage} resizeMode="cover" />
      ) : (
        <LetterPlaceholder title={item.title} size={36} style={styles.tileImage} />
      )}
      <Text style={styles.tileTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.tileOwner} numberOfLines={1}>@{item.ownerUsername}</Text>
    </TouchableOpacity>
  );

  const empty = EMPTY_COPY[activeTab];
  const isFollowing = activeTab === 'following';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.tabRow}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabPill, activeTab === tab.key && styles.tabPillActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : feedError ? (
        <View style={styles.centerFill}>
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={64} color={colors.textLight} />
            <Text style={styles.emptyTitle}>Couldn't load the feed</Text>
            <Text style={styles.errorDetail}>{feedError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => load(activeTab)}>
              <Text style={styles.retryLabel}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          // numColumns can't change on a live list - remount per tab
          key={isFollowing ? 'feed' : 'grid'}
          data={items}
          keyExtractor={(item) => `${item.ownerUserId}:${item.id}`}
          renderItem={isFollowing ? renderFeedCard : renderTile}
          numColumns={isFollowing ? 1 : 3}
          columnWrapperStyle={isFollowing ? undefined : styles.column}
          contentContainerStyle={items.length ? styles.listContent : styles.centerFill}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(activeTab, { refresh: true })}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={empty.icon} size={64} color={colors.textLight} />
              <Text style={styles.emptyTitle}>{empty.title}</Text>
              <Text style={styles.emptyBody}>{empty.body}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.footerSpinner} />
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPill: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  tabLabelActive: {
    color: '#fff',
  },
  centerFill: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },

  // Following feed
  feedCard: {
    marginBottom: 26,
    paddingHorizontal: 16,
  },
  feedImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
  },
  feedBody: {
    paddingHorizontal: 2,
    paddingTop: 12,
  },
  feedOwner: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 4,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 25,
    marginBottom: 6,
  },
  feedIngredients: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    // Fixed-height block so every card's actions line up whether the
    // recipe has 2 ingredients or 20
    minHeight: 20 * INGREDIENT_PREVIEW_LINES,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingHorizontal: 2,
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  // Discover collage
  column: {
    gap: 2,
    marginBottom: 14,
  },
  tile: {
    flex: 1,
    maxWidth: '33%',
  },
  tileImage: {
    width: '100%',
    aspectRatio: 1,
  },
  tileTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 15,
    marginTop: 5,
    paddingHorizontal: 4,
  },
  tileOwner: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 1,
    paddingHorizontal: 4,
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorDetail: {
    fontSize: 12,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  retryLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footerSpinner: {
    marginVertical: 16,
  },
});

export default DiscoverFeed;

/**
 * FILENAME: src/components/DiscoverFeed.js
 * PURPOSE: The Discover screen - browse recipes from people you follow
 * and from public profiles. Feature-flagged: HomeScreen renders this only
 * when the "discover" flag (or admin) is set; everyone else still sees
 * the Coming Soon panel.
 *
 * v1 is deliberately simple: two tabs (Following / Everyone), newest
 * first, tap a card to open the recipe read-only via the same
 * getFullPublicRecipe path the profile viewer uses. Ranking comes later
 * inside the discover service without touching this component.
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
  DISCOVER_PAGE_SIZE,
} from '../services/supabase/discover';
import { getBlockedUsers } from '../services/supabase/social';
import { log } from '../utils/log';

const TABS = [
  { key: 'following', label: 'Following' },
  { key: 'everyone', label: 'Everyone' },
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

const DiscoverFeed = ({ userId, onOpenRecipe }) => {
  const [activeTab, setActiveTab] = useState('following');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
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
    try {
      const cards = await fetchPage(tab, 0);
      setItems(cards);
      setHasMore(cards.length >= DISCOVER_PAGE_SIZE);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!userId) return;
    load(activeTab);
  }, [userId, activeTab, load]);

  const loadMore = async () => {
    if (loadingMore || loading || refreshing || !hasMore) return;
    setLoadingMore(true);
    try {
      const cards = await fetchPage(activeTab, items.length);
      // Filter anything already on screen (dedup keys reset per page)
      const existing = new Set(items.map(c => c.globalRecipeId || `${c.ownerUserId}:${c.id}`));
      const fresh = cards.filter(c => !existing.has(c.globalRecipeId || `${c.ownerUserId}:${c.id}`));
      setItems(prev => [...prev, ...fresh]);
      setHasMore(cards.length >= DISCOVER_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  };

  const renderCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => {
        log('🧭 Discover card opened:', item.title);
        onOpenRecipe(item);
      }}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <LetterPlaceholder title={item.title} size={40} style={styles.cardImage} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardOwner} numberOfLines={1}>@{item.ownerUsername}</Text>
      </View>
    </TouchableOpacity>
  );

  const empty = EMPTY_COPY[activeTab];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
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
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.ownerUserId}:${item.id}`}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.column}
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
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
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  column: {
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    maxWidth: '48.5%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardBody: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardOwner: {
    fontSize: 12,
    color: colors.textTertiary,
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
  footerSpinner: {
    marginVertical: 16,
  },
});

export default DiscoverFeed;

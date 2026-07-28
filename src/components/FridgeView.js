/**
 * FILENAME: src/components/FridgeView.js
 * PURPOSE: Current fridge inventory - computed from cook events minus consumption.
 *
 * STATUS: Basic implementation shows the inventory. Adjustments (spoiled, ate extra)
 * to be added in Chunk 3.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import colors from '../constants/colors';
import { getFridgeInventory, createFridgeAdjustment } from '../services/supabase/kitchen';

const FridgeView = ({ userId, recipes, onOpenRecipe }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const items = await getFridgeInventory(userId, 10);
      setInventory(items);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const findRecipe = (id) => recipes.find(r => r.id === id && !r.deletedAt);

  const handleAdjustment = (entry, adjustmentType) => {
    Alert.prompt?.(
      adjustmentType === 'spoiled' ? 'Mark as spoiled' : 'Adjustment',
      `How many servings? (out of ${entry.remaining} remaining)`,
      async (text) => {
        const servings = parseFloat(text);
        if (!isNaN(servings) && servings > 0) {
          await createFridgeAdjustment(userId, {
            cookEventId: entry.cookEvent.id,
            adjustmentType,
            servings: Math.min(servings, entry.remaining),
          });
          load();
        }
      },
      'plain-text',
      String(entry.remaining)
    ) || Alert.alert('Not Available', 'This action needs Alert.prompt (iOS only). Full adjustment UI coming soon.');
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : inventory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🥡</Text>
          <Text style={styles.emptyTitle}>Fridge is empty</Text>
          <Text style={styles.emptyText}>
            Plan a cook event in the Cook tab. Anything you've cooked in the last 10 days will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          <Text style={styles.header}>
            {inventory.length} item{inventory.length !== 1 ? 's' : ''} in fridge
          </Text>
          {inventory.map(entry => {
            const cook = entry.cookEvent;
            const recipe = cook.is_takeout ? null : findRecipe(cook.recipe_id);
            const daysAgo = entry.daysOld === 0 ? 'today' : entry.daysOld === 1 ? 'yesterday' : `${entry.daysOld} days ago`;
            const isOld = entry.daysOld >= 5;
            const title = cook.is_takeout ? (cook.takeout_name || 'Takeout') : (recipe?.title || '(deleted recipe)');
            return (
              <View key={cook.id} style={[styles.card, isOld && styles.cardOld]}>
                <TouchableOpacity
                  style={styles.cardMain}
                  onPress={() => recipe && onOpenRecipe?.(recipe)}
                  disabled={!recipe}
                >
                  {recipe?.image_url ? (
                    <Image source={{ uri: recipe.image_url }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Text style={{ fontSize: 20 }}>{cook.is_takeout ? '🥡' : '🍽️'}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {title}
                      {cook.is_takeout && <Text style={styles.takeoutBadge}>  takeout</Text>}
                    </Text>
                    <Text style={styles.meta}>
                      {entry.remaining} serving{entry.remaining !== 1 ? 's' : ''} left
                    </Text>
                    <Text style={[styles.meta, isOld && { color: colors.error || '#e74c3c' }]}>
                      {cook.is_takeout ? 'Ordered' : 'Cooked'} {daysAgo} {isOld && '⚠️'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.spoiledButton]}
                    onPress={() => handleAdjustment(entry, 'spoiled')}
                  >
                    <Text style={styles.actionText}>🗑 Spoiled</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.consumeButton]}
                    onPress={() => handleAdjustment(entry, 'consumed')}
                  >
                    <Text style={styles.actionText}>🍴 Ate more</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 12 },
  emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  header: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardOld: { borderColor: colors.error || '#e74c3c', borderWidth: 2 },
  cardMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  thumb: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  thumbPlaceholder: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  takeoutBadge: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
  },
  spoiledButton: { borderColor: colors.error || '#e74c3c' },
  consumeButton: { borderColor: colors.primary },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.text },
});

export default FridgeView;

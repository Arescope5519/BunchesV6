/**
 * FILENAME: src/components/FridgeView.js
 * PURPOSE: Current fridge inventory - computed from cook events minus consumption.
 *
 * Actions per item:
 *   - Trash: pick how many servings to throw out (creates spoiled adjustment)
 *   - Adjust portions: set what's actually left (updates cook_event.servings_produced
 *     so remaining = desired count, works both up and down)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import {
  getFridgeInventory,
  createFridgeAdjustment,
  updateCookEvent,
} from '../services/supabase/kitchen';

const FridgeView = ({ userId, recipes, onOpenRecipe }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  // modal state: { entry, mode: 'trash' | 'adjust', servings }
  const [action, setAction] = useState(null);

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

  const openAction = (entry, mode) => {
    // Default servings:
    // - trash: throw out all remaining
    // - adjust: current remaining
    setAction({ entry, mode, servings: entry.remaining });
  };

  const adjustModalServings = (delta) => {
    setAction(a => {
      if (!a) return a;
      let next;
      if (delta < 0) {
        if (a.servings <= 0.5) next = 0.5;
        else if (a.servings === 1) next = 0.5;
        else next = a.servings - 1;
      } else {
        if (a.servings === 0.5) next = 1;
        else next = a.servings + 1;
      }
      // For adjust mode we allow 0 (fully consumed / trashed already)
      if (a.mode === 'adjust' && next < 0.5) next = 0;
      // For trash, cap at remaining
      if (a.mode === 'trash') next = Math.min(next, a.entry.remaining);
      return { ...a, servings: Math.max(0, next) };
    });
  };

  const confirmAction = async () => {
    if (!action) return;
    const { entry, mode, servings } = action;

    if (mode === 'trash') {
      if (servings <= 0) {
        setAction(null);
        return;
      }
      const ok = await createFridgeAdjustment(userId, {
        cookEventId: entry.cookEvent.id,
        adjustmentType: 'spoiled',
        servings: Math.min(servings, entry.remaining),
      });
      if (!ok) Alert.alert('Error', 'Could not update.');
    } else if (mode === 'adjust') {
      // Update cook_event.servings_produced so that:
      //   new_remaining = desired
      //   new_produced = desired + consumed + adjusted (existing)
      const newProduced = Number(servings) + entry.consumed + entry.adjusted;
      const ok = await updateCookEvent(entry.cookEvent.id, {
        servingsProduced: newProduced,
      });
      if (!ok) Alert.alert('Error', 'Could not update.');
    }

    setAction(null);
    await load();
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : inventory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="fast-food-outline" size={48} color={colors.textLight} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>Fridge is empty</Text>
          <Text style={styles.emptyText}>
            Add a meal in the Cook tab. Anything you've cooked in the last 10 days will show up here.
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
                      <Ionicons name={cook.is_takeout ? 'fast-food' : 'restaurant'} size={20} color={colors.primary} />
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
                      {cook.is_takeout ? 'Ordered' : 'Cooked'} {daysAgo}{isOld ? ' - check freshness' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.trashButton]}
                    onPress={() => openAction(entry, 'trash')}
                  >
                    <Ionicons name="trash-outline" size={13} color={colors.error} style={{ marginRight: 4 }} />
                    <Text style={styles.actionText}>Trash</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.adjustButton]}
                    onPress={() => openAction(entry, 'adjust')}
                  >
                    <Ionicons name="options-outline" size={13} color={colors.text} style={{ marginRight: 4 }} />
                    <Text style={styles.actionText}>Adjust portions</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Action Modal (Trash / Adjust) */}
      <Modal
        visible={!!action}
        animationType="fade"
        transparent
        onRequestClose={() => setAction(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {action?.mode === 'trash' ? 'Throw out' : 'Adjust portions'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {action?.entry
                ? (action.entry.cookEvent.is_takeout
                    ? (action.entry.cookEvent.takeout_name || 'Takeout')
                    : (findRecipe(action.entry.cookEvent.recipe_id)?.title || 'Recipe'))
                : ''}
            </Text>
            <Text style={styles.modalHelp}>
              {action?.mode === 'trash'
                ? `Currently ${action?.entry?.remaining} serving${action?.entry?.remaining !== 1 ? 's' : ''} in the fridge`
                : `Adjust to what's actually left in the fridge`}
            </Text>

            <View style={styles.servingsRow}>
              <TouchableOpacity
                style={[styles.servingsButton, action?.servings <= 0 && { opacity: 0.4 }]}
                onPress={() => adjustModalServings(-1)}
                disabled={action?.servings <= 0}
              >
                <Text style={styles.servingsButtonText}>−</Text>
              </TouchableOpacity>
              <View style={{ alignItems: 'center', marginHorizontal: 24 }}>
                <Text style={styles.servingsCount}>{action?.servings}</Text>
                <Text style={styles.servingsHint}>
                  {action?.mode === 'trash' ? 'trashing' : 'remaining'}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.servingsButton,
                  action?.mode === 'trash' && action?.servings >= action?.entry?.remaining && { opacity: 0.4 },
                ]}
                onPress={() => adjustModalServings(1)}
                disabled={action?.mode === 'trash' && action?.servings >= action?.entry?.remaining}
              >
                <Text style={styles.servingsButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setAction(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmAction}>
                <Text style={styles.modalConfirmText}>
                  {action?.mode === 'trash' ? 'Trash' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  trashButton: { borderColor: colors.error || '#e74c3c' },
  adjustButton: { borderColor: colors.primary },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.text },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  modalHelp: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 12, marginBottom: 8 },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  servingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingsButtonText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  servingsCount: { fontSize: 28, fontWeight: '700', color: colors.text },
  servingsHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  modalConfirm: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default FridgeView;

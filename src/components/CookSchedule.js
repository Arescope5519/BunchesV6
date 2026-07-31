/**
 * FILENAME: src/components/CookSchedule.js
 * PURPOSE: Weekly calendar for planning when to cook what.
 * Each day can have multiple cook events (recipe + servings produced).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import colors from '../constants/colors';
import LetterPlaceholder from './LetterPlaceholder';
import {
  getCookEvents,
  createCookEvent,
  deleteCookEvent,
  getWeekStart,
  getWeekDays,
  formatDayLabel,
} from '../services/supabase/kitchen';

const CookSchedule = ({ userId, recipes = [], onOpenRecipe }) => {
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [cookEvents, setCookEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pickerDate, setPickerDate] = useState(null);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekEnd = weekDays[6];

  const loadCookEvents = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const events = await getCookEvents(userId, weekStart, weekEnd);
      // Hide takeout events - they don't belong on the cook schedule
      setCookEvents(events.filter(e => !e.is_takeout));
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart, weekEnd]);

  useEffect(() => {
    loadCookEvents();
  }, [loadCookEvents]);

  const findRecipe = (id) => recipes.find(r => r.id === id && !r.deletedAt);

  const cookEventsForDate = (date) => cookEvents.filter(e => e.cook_date === date);

  const shiftWeek = (deltaDays) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const handleAdd = async (recipe, servings) => {
    if (!pickerDate || !userId) return;
    const created = await createCookEvent(userId, {
      cookDate: pickerDate,
      recipeId: recipe.id,
      servingsProduced: servings,
    });
    if (created) {
      setCookEvents([...cookEvents, created]);
    }
    setPickerDate(null);
  };

  const handleDelete = (cookEvent) => {
    const recipe = findRecipe(cookEvent.recipe_id);
    Alert.alert(
      'Remove cook event?',
      `${recipe?.title || 'Recipe'} on ${formatDayLabel(cookEvent.cook_date)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteCookEvent(cookEvent.id);
            if (ok) {
              setCookEvents(cookEvents.filter(e => e.id !== cookEvent.id));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Week Navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => shiftWeek(-7)} style={styles.weekNavButton}>
          <Text style={styles.weekNavText}>{'< Prev'}</Text>
        </TouchableOpacity>
        <View style={styles.weekLabel}>
          <Text style={styles.weekLabelText}>Week of {new Date(weekStart).toLocaleDateString()}</Text>
          <TouchableOpacity onPress={() => setWeekStart(getWeekStart())}>
            <Text style={styles.todayLink}>Today</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => shiftWeek(7)} style={styles.weekNavButton}>
          <Text style={styles.weekNavText}>{'Next >'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.grid} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          {weekDays.map(date => {
            const events = cookEventsForDate(date);
            return (
              <View key={date} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{formatDayLabel(date)}</Text>

                {events.map(event => {
                  const recipe = findRecipe(event.recipe_id);
                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={styles.cookEvent}
                      onPress={() => recipe && onOpenRecipe?.(recipe)}
                    >
                      {recipe?.image_url ? (
                        <Image source={{ uri: recipe.image_url }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Text style={{ fontSize: 16 }}>🍳</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cookTitle} numberOfLines={1}>
                          {recipe?.title || '(deleted recipe)'}
                        </Text>
                        <Text style={styles.cookMeta}>
                          {event.servings_produced} serving{event.servings_produced !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(event)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.deleteButtonText}>×</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity style={styles.addButton} onPress={() => setPickerDate(date)}>
                  <Text style={styles.addButtonText}>+ Add a meal</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Recipe Picker */}
      <RecipePicker
        visible={!!pickerDate}
        onClose={() => setPickerDate(null)}
        onPick={handleAdd}
        recipes={recipes}
        dateLabel={pickerDate ? formatDayLabel(pickerDate) : ''}
      />
    </View>
  );
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Extract the recipe's default servings.
 * Falls back to parsing recipe.servings string, then to 1.
 */
const getBaseServings = (recipe) => {
  if (!recipe) return 1;
  if (recipe.base_servings) return Number(recipe.base_servings);
  if (recipe.baseServings) return Number(recipe.baseServings);
  if (recipe.servings) {
    const match = String(recipe.servings).match(/(\d+(?:\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }
  return 1;
};

// -----------------------------------------------------------------------------
// Recipe Picker (folder browsing + servings prompt)
// -----------------------------------------------------------------------------

const RecipePicker = ({ visible, onClose, onPick, recipes = [], dateLabel }) => {
  const [selectedFolder, setSelectedFolder] = useState('All');
  const [search, setSearch] = useState('');
  const [configuring, setConfiguring] = useState(null);

  const activeRecipes = useMemo(
    () => recipes.filter(r => !r.deletedAt),
    [recipes]
  );

  const folders = useMemo(() => {
    const set = new Set(['All']);
    activeRecipes.forEach(r => {
      const rf = r.folders || (r.folder ? [r.folder] : []);
      rf.forEach(f => {
        if (f && f !== 'All Recipes' && f !== 'Recently Deleted') set.add(f);
      });
    });
    return Array.from(set);
  }, [activeRecipes]);

  const filtered = useMemo(() => {
    let list = activeRecipes;
    if (selectedFolder !== 'All') {
      list = list.filter(r => {
        const rf = r.folders || (r.folder ? [r.folder] : []);
        return rf.includes(selectedFolder);
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r => (r.title || '').toLowerCase().includes(q));
    }
    return list;
  }, [activeRecipes, selectedFolder, search]);

  useEffect(() => {
    if (!visible) {
      setSelectedFolder('All');
      setSearch('');
      setConfiguring(null);
    }
  }, [visible]);

  const handleConfirm = () => {
    if (!configuring) return;
    const baseServings = getBaseServings(configuring.recipe);
    const totalServings = baseServings * configuring.multiplier;
    onPick(configuring.recipe, totalServings);
    setConfiguring(null);
  };

  const changeMultiplier = (delta) => {
    setConfiguring(c => {
      if (!c) return c;
      let next;
      // Going down from 1 -> 0.5, from 0.5 stay at 0.5
      if (delta < 0) {
        if (c.multiplier <= 0.5) next = 0.5;
        else if (c.multiplier === 1) next = 0.5;
        else next = c.multiplier - 1;
      } else {
        // Going up from 0.5 -> 1, then integer increments
        if (c.multiplier === 0.5) next = 1;
        else next = c.multiplier + 1;
      }
      return { ...c, multiplier: next };
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerAction}>✕ Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Meal on {dateLabel}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.folderRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {folders.map(folder => {
              const active = folder === selectedFolder;
              return (
                <TouchableOpacity
                  key={folder}
                  style={[styles.folderChip, active && styles.folderChipActive]}
                  onPress={() => setSelectedFolder(folder)}
                >
                  <Text style={[styles.folderChipText, active && styles.folderChipTextActive]}>
                    {folder === 'All' ? 'All Recipes' : folder}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView style={{ flex: 1 }}>
          {filtered.length === 0 ? (
            <Text style={{ padding: 30, textAlign: 'center', color: colors.textSecondary }}>
              {search ? 'No recipes match your search.' : 'No recipes in this cookbook yet.'}
            </Text>
          ) : (
            <View style={styles.pickerGrid}>
              {filtered.map(recipe => (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.pickerCard}
                  onPress={() => setConfiguring({ recipe, multiplier: 1 })}
                >
                  {recipe.image_url ? (
                    <Image source={{ uri: recipe.image_url }} style={styles.pickerCardImage} />
                  ) : (
                    <LetterPlaceholder title={recipe.title} size={32} style={styles.pickerCardImage} />
                  )}
                  <Text style={styles.pickerCardTitle} numberOfLines={2}>{recipe.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>

        {/* Servings config */}
        <Modal
          visible={!!configuring}
          animationType="fade"
          transparent
          onRequestClose={() => setConfiguring(null)}
        >
          <View style={styles.configOverlay}>
            <View style={styles.configCard}>
              <Text style={styles.configTitle}>{configuring?.recipe?.title}</Text>
              {(() => {
                const base = configuring ? getBaseServings(configuring.recipe) : 1;
                const total = configuring ? base * configuring.multiplier : 0;
                return (
                  <>
                    <Text style={styles.configLabel}>Recipe makes {base} serving{base !== 1 ? 's' : ''}</Text>
                    <View style={styles.servingsRow}>
                      <TouchableOpacity
                        style={[styles.servingsButton, configuring?.multiplier <= 0.5 && { opacity: 0.4 }]}
                        onPress={() => changeMultiplier(-1)}
                        disabled={configuring?.multiplier <= 0.5}
                      >
                        <Text style={styles.servingsButtonText}>−</Text>
                      </TouchableOpacity>
                      <View style={{ alignItems: 'center', marginHorizontal: 20 }}>
                        <Text style={styles.servingsCount}>{configuring?.multiplier}x</Text>
                        <Text style={styles.servingsHint}>= {total} serving{total !== 1 ? 's' : ''}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.servingsButton}
                        onPress={() => changeMultiplier(1)}
                      >
                        <Text style={styles.servingsButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.configHint}>
                      Adjust in whole batches. Use "0.5x" for a half batch.
                    </Text>
                  </>
                );
              })()}
              <View style={styles.configActions}>
                <TouchableOpacity style={styles.configCancel} onPress={() => setConfiguring(null)}>
                  <Text style={styles.configCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.configConfirm} onPress={handleConfirm}>
                  <Text style={styles.configConfirmText}>Add Meal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekNavButton: { padding: 8 },
  weekNavText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  weekLabel: { alignItems: 'center' },
  weekLabelText: { fontSize: 15, fontWeight: '600', color: colors.text },
  todayLink: { color: colors.primary, fontSize: 12, marginTop: 2 },
  grid: { flex: 1 },
  dayRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayLabel: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 8 },
  cookEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight || '#e8f5f0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  thumb: { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  thumbPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cookTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  cookMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error || '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: -2 },
  addButton: {
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: { fontSize: 13, color: colors.textSecondary },

  // Picker
  pickerContainer: { flex: 1, backgroundColor: colors.background },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: colors.primary,
  },
  headerAction: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  searchBar: {
    padding: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  folderRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  folderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  folderChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  folderChipText: { fontSize: 13, color: colors.text },
  folderChipTextActive: { color: '#fff', fontWeight: '600' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  pickerCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerCardImage: { width: '100%', height: 120, backgroundColor: colors.border },
  pickerCardImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  pickerCardTitle: { fontSize: 13, fontWeight: '600', color: colors.text, padding: 8 },

  // Config overlay
  configOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  configCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  configTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  configLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
  servingsCount: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  servingsHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  configHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  configActions: { flexDirection: 'row', justifyContent: 'space-between' },
  configCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    alignItems: 'center',
  },
  configCancelText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  configConfirm: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
    marginLeft: 8,
    alignItems: 'center',
  },
  configConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default CookSchedule;

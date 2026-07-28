/**
 * FILENAME: src/components/MealPlanning.js
 * PURPOSE: Weekly meal planning grid. Users assign recipes to breakfast/lunch/dinner
 * slots for each day of a chosen week. Premium feature.
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
  SafeAreaView,
  Image,
  TextInput,
} from 'react-native';
import colors from '../constants/colors';
import { getWeekStart, getMealPlan, saveMealPlan } from '../services/supabase/social';

const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatDayLabel = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`;
};

const getWeekDays = (weekStartStr) => {
  const start = new Date(weekStartStr);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
};

const MealPlanning = ({
  visible,
  onClose,
  userId,
  recipes = [],
  onGenerateGroceryList,
  onOpenRecipe,
}) => {
  const [weekStart, setWeekStart] = useState(getWeekStart());
  // meals: { "YYYY-MM-DD": { breakfast: [{recipeId, servings, isLeftover}], lunch: [...], dinner: [...] } }
  const [meals, setMeals] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null); // { date, slot }
  const [editingAssignment, setEditingAssignment] = useState(null); // { date, slot, index }

  const loadPlan = useCallback(async () => {
    if (!userId || !visible) return;
    setLoading(true);
    try {
      const plan = await getMealPlan(userId, weekStart);
      setMeals(plan?.meals || {});
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart, visible]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const persist = async (newMeals) => {
    if (!userId) return;
    setSaving(true);
    try {
      await saveMealPlan(userId, weekStart, newMeals);
    } finally {
      setSaving(false);
    }
  };

  // Normalize old string[] format to {recipeId, servings, isLeftover}[]
  const normalizeAssignments = (raw) => {
    if (!raw) return [];
    return raw.map(item => {
      if (typeof item === 'string') {
        return { recipeId: item, servings: 1, isLeftover: false };
      }
      return { recipeId: item.recipeId, servings: item.servings || 1, isLeftover: !!item.isLeftover };
    });
  };

  const getMealsForSlot = (date, slot) => {
    return normalizeAssignments(meals[date]?.[slot]);
  };

  const addRecipeToSlot = async (date, slot, recipeId, servings = 1, isLeftover = false) => {
    const newMeals = { ...meals };
    if (!newMeals[date]) newMeals[date] = {};
    const existing = normalizeAssignments(newMeals[date][slot]);
    if (existing.some(a => a.recipeId === recipeId)) return;
    const newAssignment = { recipeId, servings, isLeftover };
    newMeals[date] = { ...newMeals[date], [slot]: [...existing, newAssignment] };
    setMeals(newMeals);
    setPickerSlot(null);
    await persist(newMeals);
  };

  const removeRecipeFromSlot = async (date, slot, recipeId) => {
    const newMeals = { ...meals };
    if (!newMeals[date]?.[slot]) return;
    const existing = normalizeAssignments(newMeals[date][slot]);
    newMeals[date] = {
      ...newMeals[date],
      [slot]: existing.filter(a => a.recipeId !== recipeId),
    };
    setMeals(newMeals);
    await persist(newMeals);
  };

  const updateAssignment = async (date, slot, recipeId, patch) => {
    const newMeals = { ...meals };
    if (!newMeals[date]?.[slot]) return;
    const existing = normalizeAssignments(newMeals[date][slot]);
    newMeals[date] = {
      ...newMeals[date],
      [slot]: existing.map(a => (a.recipeId === recipeId ? { ...a, ...patch } : a)),
    };
    setMeals(newMeals);
    await persist(newMeals);
  };

  const findRecipe = (id) => recipes.find(r => r.id === id && !r.deletedAt);

  const shiftWeek = (deltaDays) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const handleGenerateGroceryList = () => {
    if (!onGenerateGroceryList) return;

    // Collect only cook-fresh assignments (skip leftovers to avoid double-buying).
    // For each recipe, sum servings across all its cook-fresh appearances.
    const servingsByRecipe = {}; // { recipeId: totalServings }
    Object.values(meals).forEach(day => {
      Object.values(day || {}).forEach(slotArr => {
        const assignments = normalizeAssignments(slotArr);
        assignments.forEach(a => {
          if (a.isLeftover) return; // skip leftovers
          servingsByRecipe[a.recipeId] = (servingsByRecipe[a.recipeId] || 0) + (a.servings || 1);
        });
      });
    });

    const recipesToBuy = Object.entries(servingsByRecipe)
      .map(([recipeId, servings]) => {
        const recipe = findRecipe(recipeId);
        return recipe ? { ...recipe, plannedServings: servings } : null;
      })
      .filter(Boolean);

    if (recipesToBuy.length === 0) {
      Alert.alert(
        'Empty Plan',
        'Add cook-fresh meals to your plan before generating a grocery list. (Leftovers reuse ingredients.)'
      );
      return;
    }

    onGenerateGroceryList(recipesToBuy);
  };

  const weekDays = getWeekDays(weekStart);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Meal Plan</Text>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

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
          <ScrollView style={styles.grid}>
            {weekDays.map(date => (
              <View key={date} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{formatDayLabel(date)}</Text>
                {MEAL_SLOTS.map(slot => {
                  const assignments = getMealsForSlot(date, slot);
                  return (
                    <View key={slot} style={styles.slot}>
                      <Text style={styles.slotLabel}>
                        {slot.charAt(0).toUpperCase() + slot.slice(1)}
                      </Text>
                      {assignments.map(a => {
                        const recipe = findRecipe(a.recipeId);
                        return (
                          <TouchableOpacity
                            key={a.recipeId}
                            style={[styles.assignedRecipe, a.isLeftover && styles.assignedRecipeLeftover]}
                            onPress={() => {
                              // Open recipe ON TOP of meal planner so back returns to meal planner
                              if (recipe && onOpenRecipe) {
                                onOpenRecipe(recipe);
                              }
                            }}
                            onLongPress={() => setEditingAssignment({ date, slot, recipeId: a.recipeId })}
                          >
                            {recipe?.image_url ? (
                              <Image source={{ uri: recipe.image_url }} style={styles.assignedThumb} />
                            ) : (
                              <View style={[styles.assignedThumb, styles.assignedThumbPlaceholder]}>
                                <Text style={{ fontSize: 14 }}>🍽️</Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.assignedRecipeText} numberOfLines={1}>
                                {a.isLeftover && '🥡 '}
                                {recipe?.title || '(deleted recipe)'}
                              </Text>
                              <Text style={styles.assignedRecipeMeta}>
                                {a.servings} serving{a.servings !== 1 ? 's' : ''}
                                {a.isLeftover ? ' • leftovers' : ' • cook fresh'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.removeAssignedButton}
                              onPress={() => removeRecipeFromSlot(date, slot, a.recipeId)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.removeAssignedButtonText}>×</Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        style={styles.addSlot}
                        onPress={() => setPickerSlot({ date, slot })}
                      >
                        <Text style={styles.addSlotText}>+ Add</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}

        {/* Bottom Action */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateGroceryList}
          >
            <Text style={styles.generateButtonText}>📋 Generate Grocery List</Text>
          </TouchableOpacity>
        </View>

        {/* Recipe Picker Modal */}
        <RecipePicker
          visible={!!pickerSlot}
          onClose={() => setPickerSlot(null)}
          onPick={(recipeId) => addRecipeToSlot(pickerSlot.date, pickerSlot.slot, recipeId)}
          recipes={recipes}
          slotLabel={pickerSlot ? `${pickerSlot.slot} for ${formatDayLabel(pickerSlot.date)}` : ''}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: colors.primary,
  },
  closeButton: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: colors.surface || '#f7f7f7',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekNavButton: { padding: 8 },
  weekNavText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  weekLabel: { alignItems: 'center' },
  weekLabelText: { fontSize: 15, fontWeight: '600', color: colors.text },
  todayLink: { color: colors.primary, fontSize: 12, marginTop: 2 },
  grid: { flex: 1, padding: 12 },
  dayRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  slot: { marginBottom: 8 },
  slotLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' },
  assignedRecipe: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight || '#e8f5f0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  assignedRecipeText: { flex: 1, fontSize: 13, color: colors.text },
  addSlot: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addSlotText: { fontSize: 12, color: colors.textSecondary },
  footer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  generateButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  generateButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  recipeOption: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeOptionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  recipeOptionFolder: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  // Assigned recipe (row with thumb, title, remove button)
  assignedThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    marginRight: 8,
  },
  assignedThumbPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAssignedButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error || '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeAssignedButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: -2 },
  // Recipe picker (folder + card grid)
  pickerFolderRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerFolderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  pickerFolderChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerFolderChipText: { fontSize: 13, color: colors.text },
  pickerFolderChipTextActive: { color: '#fff', fontWeight: '600' },
  pickerSearchBar: {
    padding: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerSearchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
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
  pickerCardImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.border,
  },
  pickerCardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    padding: 8,
  },
  // Assignment meta (servings, leftover)
  assignedRecipeMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  assignedRecipeLeftover: { backgroundColor: '#fff9e6', borderColor: '#f39c12' },
  // Config overlay
  configOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  configCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
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
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    marginHorizontal: 24,
    minWidth: 40,
    textAlign: 'center',
  },
  leftoverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  leftoverLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  leftoverHint: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  configActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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

// -----------------------------------------------------------------------------
// RecipePicker sub-component (cookbook browser with photo cards)
// -----------------------------------------------------------------------------

const RecipePicker = ({ visible, onClose, onPick, recipes = [], slotLabel }) => {
  const [selectedFolder, setSelectedFolder] = useState('All');
  const [search, setSearch] = useState('');
  const [configuring, setConfiguring] = useState(null); // { recipe, servings, isLeftover }

  // All recipes (filter deleted)
  const activeRecipes = useMemo(
    () => recipes.filter(r => !r.deletedAt),
    [recipes]
  );

  // Get all folders from recipes
  const folders = useMemo(() => {
    const set = new Set(['All']);
    activeRecipes.forEach(r => {
      const rf = r.folders || (r.folder ? [r.folder] : []);
      rf.forEach(f => {
        if (f && f !== 'All Recipes' && f !== 'Recently Deleted') {
          set.add(f);
        }
      });
    });
    return Array.from(set);
  }, [activeRecipes]);

  // Filter recipes by selected folder + search
  const filteredRecipes = useMemo(() => {
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

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setSelectedFolder('All');
      setSearch('');
      setConfiguring(null);
    }
  }, [visible]);

  const handleCardTap = (recipe) => {
    // Default: 1 serving, not leftover
    setConfiguring({ recipe, servings: 1, isLeftover: false });
  };

  const handleConfirm = () => {
    if (!configuring) return;
    onPick(configuring.recipe.id, configuring.servings, configuring.isLeftover);
    setConfiguring(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕ Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            Add to {slotLabel}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Search */}
        <View style={styles.pickerSearchBar}>
          <TextInput
            style={styles.pickerSearchInput}
            placeholder="Search recipes..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Folder chips */}
        <View style={styles.pickerFolderRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {folders.map(folder => {
              const active = folder === selectedFolder;
              return (
                <TouchableOpacity
                  key={folder}
                  style={[styles.pickerFolderChip, active && styles.pickerFolderChipActive]}
                  onPress={() => setSelectedFolder(folder)}
                >
                  <Text style={[styles.pickerFolderChipText, active && styles.pickerFolderChipTextActive]}>
                    {folder === 'All' ? 'All Recipes' : folder}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Recipe grid */}
        <ScrollView style={{ flex: 1 }}>
          {filteredRecipes.length === 0 ? (
            <Text style={{ padding: 30, textAlign: 'center', color: colors.textSecondary }}>
              {search ? 'No recipes match your search.' : 'No recipes in this cookbook yet.'}
            </Text>
          ) : (
            <View style={styles.pickerGrid}>
              {filteredRecipes.map(recipe => (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.pickerCard}
                  onPress={() => handleCardTap(recipe)}
                >
                  {recipe.image_url ? (
                    <Image source={{ uri: recipe.image_url }} style={styles.pickerCardImage} />
                  ) : (
                    <View style={[styles.pickerCardImage, styles.pickerCardImagePlaceholder]}>
                      <Text style={{ fontSize: 32 }}>🍽️</Text>
                    </View>
                  )}
                  <Text style={styles.pickerCardTitle} numberOfLines={2}>
                    {recipe.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>

        {/* Configure servings/leftover */}
        <Modal
          visible={!!configuring}
          animationType="fade"
          transparent
          onRequestClose={() => setConfiguring(null)}
        >
          <View style={styles.configOverlay}>
            <View style={styles.configCard}>
              <Text style={styles.configTitle}>{configuring?.recipe?.title}</Text>

              <Text style={styles.configLabel}>How many servings?</Text>
              <View style={styles.servingsRow}>
                <TouchableOpacity
                  style={styles.servingsButton}
                  onPress={() => setConfiguring(c => ({ ...c, servings: Math.max(1, c.servings - 1) }))}
                >
                  <Text style={styles.servingsButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.servingsCount}>{configuring?.servings || 1}</Text>
                <TouchableOpacity
                  style={styles.servingsButton}
                  onPress={() => setConfiguring(c => ({ ...c, servings: c.servings + 1 }))}
                >
                  <Text style={styles.servingsButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.leftoverToggle}
                onPress={() => setConfiguring(c => ({ ...c, isLeftover: !c.isLeftover }))}
              >
                <View style={[styles.checkbox, configuring?.isLeftover && styles.checkboxChecked]}>
                  {configuring?.isLeftover && <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leftoverLabel}>🥡 This is leftovers</Text>
                  <Text style={styles.leftoverHint}>
                    Won't add ingredients to grocery list (already bought)
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.configActions}>
                <TouchableOpacity
                  style={styles.configCancel}
                  onPress={() => setConfiguring(null)}
                >
                  <Text style={styles.configCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.configConfirm}
                  onPress={handleConfirm}
                >
                  <Text style={styles.configConfirmText}>Add to Plan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

export default MealPlanning;

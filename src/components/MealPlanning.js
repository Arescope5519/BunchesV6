/**
 * FILENAME: src/components/MealPlanning.js
 * PURPOSE: Weekly meal planning grid. Users assign recipes to breakfast/lunch/dinner
 * slots for each day of a chosen week. Premium feature.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
}) => {
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [meals, setMeals] = useState({}); // { "YYYY-MM-DD": { breakfast: [id], lunch: [id], dinner: [id] } }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null); // { date, slot }

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

  const getMealsForSlot = (date, slot) => {
    return meals[date]?.[slot] || [];
  };

  const addRecipeToSlot = async (date, slot, recipeId) => {
    const newMeals = { ...meals };
    if (!newMeals[date]) newMeals[date] = {};
    const existing = newMeals[date][slot] || [];
    if (existing.includes(recipeId)) return;
    newMeals[date] = { ...newMeals[date], [slot]: [...existing, recipeId] };
    setMeals(newMeals);
    setPickerSlot(null);
    await persist(newMeals);
  };

  const removeRecipeFromSlot = async (date, slot, recipeId) => {
    const newMeals = { ...meals };
    if (!newMeals[date]?.[slot]) return;
    newMeals[date] = {
      ...newMeals[date],
      [slot]: newMeals[date][slot].filter(id => id !== recipeId),
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
    // Collect all recipe ids from the plan
    const recipeIds = [];
    Object.values(meals).forEach(day => {
      Object.values(day || {}).forEach(slotArr => {
        (slotArr || []).forEach(id => recipeIds.push(id));
      });
    });

    if (recipeIds.length === 0) {
      Alert.alert('Empty Plan', 'Add recipes to your meal plan before generating a grocery list.');
      return;
    }

    // Deduplicate but keep count for scaling later
    const uniqueRecipeIds = [...new Set(recipeIds)];
    const recipesInPlan = uniqueRecipeIds
      .map(id => findRecipe(id))
      .filter(Boolean);

    onGenerateGroceryList(recipesInPlan);
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
                  const recipeIds = getMealsForSlot(date, slot);
                  return (
                    <View key={slot} style={styles.slot}>
                      <Text style={styles.slotLabel}>
                        {slot.charAt(0).toUpperCase() + slot.slice(1)}
                      </Text>
                      {recipeIds.map(id => {
                        const recipe = findRecipe(id);
                        return (
                          <TouchableOpacity
                            key={id}
                            style={styles.assignedRecipe}
                            onLongPress={() => {
                              Alert.alert(
                                'Remove from plan?',
                                recipe?.title || 'Recipe',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Remove', style: 'destructive', onPress: () => removeRecipeFromSlot(date, slot, id) },
                                ]
                              );
                            }}
                          >
                            <Text style={styles.assignedRecipeText} numberOfLines={1}>
                              {recipe?.title || '(deleted recipe)'}
                            </Text>
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
        <Modal
          visible={!!pickerSlot}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setPickerSlot(null)}
        >
          <SafeAreaView style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setPickerSlot(null)}>
                <Text style={styles.closeButton}>✕ Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>
                {pickerSlot ? `${pickerSlot.slot} for ${formatDayLabel(pickerSlot.date)}` : ''}
              </Text>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView style={{ padding: 12 }}>
              {recipes
                .filter(r => !r.deletedAt)
                .map(recipe => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeOption}
                    onPress={() => addRecipeToSlot(pickerSlot.date, pickerSlot.slot, recipe.id)}
                  >
                    <Text style={styles.recipeOptionTitle}>{recipe.title}</Text>
                    {recipe.folders && recipe.folders.length > 0 && (
                      <Text style={styles.recipeOptionFolder}>
                        {recipe.folders.filter(f => f !== 'All Recipes').join(', ')}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              {recipes.filter(r => !r.deletedAt).length === 0 && (
                <Text style={{ padding: 20, textAlign: 'center', color: colors.textSecondary }}>
                  No recipes yet. Create or save some first.
                </Text>
              )}
              <View style={{ height: 60 }} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
    backgroundColor: colors.primary,
    paddingTop: 20,
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
    backgroundColor: colors.primaryLight || '#e8f5f0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  assignedRecipeText: { fontSize: 13, color: colors.text },
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
});

export default MealPlanning;

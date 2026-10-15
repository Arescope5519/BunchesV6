/**
 * FILENAME: src/components/NutritionStats.js
 * PURPOSE: Eating-habit nutrition analytics for the Kitchen hub.
 *
 * Daily intake and trends summed from meal_events x the recipes'
 * SOURCE-PROVIDED per-serving nutrition (pass-through only - we never
 * compute nutrition from ingredients). Coverage is shown honestly:
 * takeout and recipes without nutrition data count as uncovered meals.
 *
 * STORE COMPLIANCE: this screen is why the Play health declaration is
 * "Nutrition and weight management" - see CLAUDE.md.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { loadAppSettings, saveAppSettings } from '../utils/storage';
import {
  getMealEvents,
  getCookEvents,
  parseLocalDate,
  toDateString,
} from '../services/supabase/kitchen';
import { aggregateNutrition, formatNutrientValue, TRACKED_NUTRIENTS } from '../utils/nutritionMath';

const RANGE_OPTIONS = [
  { key: 7, label: '7 days' },
  { key: 28, label: '28 days' },
];

const MACRO_KEYS = ['proteinContent', 'carbohydrateContent', 'fatContent'];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const NutritionStats = ({ userId, recipes }) => {
  const [rangeDays, setRangeDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mealEvents, setMealEvents] = useState([]);
  const [cookEvents, setCookEvents] = useState([]);
  // Daily calorie goal: an awareness marker, stored in app settings.
  // Covered by the already-declared "Nutrition and weight management"
  // health category - see CLAUDE.md before extending goals further.
  const [calorieGoal, setCalorieGoal] = useState(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');

  const todayStr = toDateString(new Date());

  useEffect(() => {
    loadAppSettings(userId).then(s => {
      if (s.dailyCalorieGoal) setCalorieGoal(s.dailyCalorieGoal);
    });
  }, [userId]);

  const saveGoal = async (value) => {
    const goal = value ? Math.max(0, Math.round(Number(value))) || null : null;
    setCalorieGoal(goal);
    setEditingGoal(false);
    const settings = await loadAppSettings(userId);
    await saveAppSettings({ ...settings, dailyCalorieGoal: goal }, userId);
  };

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 27);
      // Cook events can predate the meals that eat them
      const cookStart = new Date();
      cookStart.setDate(cookStart.getDate() - 60);
      const [meals, cooks] = await Promise.all([
        getMealEvents(userId, toDateString(start), toDateString(end)),
        getCookEvents(userId, toDateString(cookStart), toDateString(end)),
      ]);
      setMealEvents(meals || []);
      setCookEvents(cooks || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const agg = useMemo(() => {
    const cooksById = {};
    cookEvents.forEach(c => { cooksById[c.id] = c; });
    const recipesById = {};
    (recipes || []).forEach(r => { recipesById[r.id] = r; });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (rangeDays - 1));
    const cutoffStr = toDateString(cutoff);
    const inRange = mealEvents.filter(m => m.meal_date >= cutoffStr && m.meal_date <= todayStr);
    return aggregateNutrition(inRange, cooksById, recipesById);
  }, [mealEvents, cookEvents, recipes, rangeDays, todayStr]);

  // Last 7 calendar days for the bars, oldest first, zero-filled
  const barDays = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = toDateString(d);
      const day = agg.byDate[dateStr];
      days.push({
        dateStr,
        letter: DAY_LETTERS[parseLocalDate(dateStr).getDay()],
        calories: day?.totals?.calories || 0,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [agg, todayStr]);

  const today = agg.byDate[todayStr];
  const daysWithData = Object.values(agg.byDate).filter(d => d.mealsCounted > 0).length;
  const avgCalories = daysWithData > 0 ? (agg.totals.calories || 0) / daysWithData : 0;
  const maxBar = Math.max(...barDays.map(d => d.calories), 1);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      {/* Today */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Today</Text>
          <TouchableOpacity
            style={styles.goalEdit}
            onPress={() => {
              setGoalDraft(calorieGoal ? String(calorieGoal) : '');
              setEditingGoal(true);
            }}
          >
            <Ionicons name={calorieGoal ? 'pencil' : 'add-circle-outline'} size={14} color={colors.primary} />
            <Text style={styles.goalEditText}>{calorieGoal ? 'Edit goal' : 'Set goal'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.todayRow}>
          <Text style={styles.todayCalories}>{Math.round(today?.totals?.calories || 0)}</Text>
          <Text style={styles.todayCaloriesUnit}>
            {calorieGoal ? `/ ${calorieGoal} cal` : 'cal'}
          </Text>
        </View>
        {calorieGoal ? (() => {
          const eaten = today?.totals?.calories || 0;
          const pct = Math.min(eaten / calorieGoal, 1);
          const over = eaten > calorieGoal;
          return (
            <View style={styles.goalBlock}>
              <View style={styles.goalTrack}>
                <View
                  style={[
                    styles.goalFill,
                    { width: `${pct * 100}%` },
                    over && styles.goalFillOver,
                  ]}
                />
              </View>
              <Text style={[styles.goalRemaining, over && styles.goalRemainingOver]}>
                {over
                  ? `${Math.round(eaten - calorieGoal)} over goal`
                  : `${Math.round(calorieGoal - eaten)} left`}
              </Text>
            </View>
          );
        })() : null}
        <View style={styles.macroRow}>
          {MACRO_KEYS.map(key => {
            const n = TRACKED_NUTRIENTS.find(t => t.key === key);
            return (
              <View key={key} style={styles.macroChip}>
                <Text style={styles.macroValue}>{formatNutrientValue(today?.totals?.[key] || 0, n.unit)}</Text>
                <Text style={styles.macroLabel}>{n.label}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.coverageText}>
          {today?.mealsTotal
            ? `${today.mealsCounted} of ${today.mealsTotal} logged meal${today.mealsTotal !== 1 ? 's' : ''} had nutrition data`
            : 'No meals logged today'}
        </Text>
      </View>

      {/* 7-day calories */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last 7 Days</Text>
        <View style={styles.chartRow}>
          {barDays.map(d => (
            <View key={d.dateStr} style={styles.barColumn}>
              <Text style={styles.barValue}>{d.calories > 0 ? Math.round(d.calories) : ''}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max((d.calories / maxBar) * 100, d.calories > 0 ? 4 : 0)}%` },
                    d.isToday && styles.barToday,
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, d.isToday && styles.barLabelToday]}>{d.letter}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Range stats */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Averages</Text>
          <View style={styles.rangeToggle}>
            {RANGE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.rangeChip, rangeDays === opt.key && styles.rangeChipActive]}
                onPress={() => setRangeDays(opt.key)}
              >
                <Text style={[styles.rangeChipText, rangeDays === opt.key && styles.rangeChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.avgRow}>
          <View style={styles.avgCell}>
            <Text style={styles.avgValue}>{Math.round(avgCalories)}</Text>
            <Text style={styles.avgLabel}>cal / day</Text>
          </View>
          {MACRO_KEYS.map(key => {
            const n = TRACKED_NUTRIENTS.find(t => t.key === key);
            const avg = daysWithData > 0 ? (agg.totals[key] || 0) / daysWithData : 0;
            return (
              <View key={key} style={styles.avgCell}>
                <Text style={styles.avgValue}>{formatNutrientValue(avg, n.unit)}</Text>
                <Text style={styles.avgLabel}>{n.label.toLowerCase()} / day</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.coverageText}>
          Across {daysWithData} day{daysWithData !== 1 ? 's' : ''} with data · {agg.mealsCounted} of {agg.mealsTotal} meals had nutrition info
        </Text>
      </View>

      {/* Top recipes */}
      {agg.perRecipe.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Biggest Contributors</Text>
          {agg.perRecipe.slice(0, 5).map(r => (
            <View key={r.recipeId} style={styles.topRow}>
              <Text style={styles.topTitle} numberOfLines={1}>{r.title}</Text>
              <Text style={styles.topMeta}>
                {Math.round(r.calories)} cal · {r.servings} serving{r.servings !== 1 ? 's' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Goal editor */}
      <Modal visible={editingGoal} transparent animationType="fade" onRequestClose={() => setEditingGoal(false)}>
        <View style={styles.goalModalOverlay}>
          <View style={styles.goalModalCard}>
            <Text style={styles.goalModalTitle}>Daily Calorie Goal</Text>
            <Text style={styles.goalModalHint}>
              A personal awareness marker, not dietary advice. Leave empty to remove.
            </Text>
            <TextInput
              style={styles.goalInput}
              value={goalDraft}
              onChangeText={setGoalDraft}
              keyboardType="number-pad"
              placeholder="e.g. 2000"
              placeholderTextColor={colors.textLight}
              autoFocus
              maxLength={5}
            />
            <View style={styles.goalModalButtons}>
              <TouchableOpacity style={styles.goalModalCancel} onPress={() => setEditingGoal(false)}>
                <Text style={styles.goalModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.goalModalSave} onPress={() => saveGoal(goalDraft)}>
                <Text style={styles.goalModalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} style={{ marginRight: 5, marginTop: 1 }} />
        <Text style={styles.disclaimerText}>
          Totals use the nutrition each recipe's source published, per serving - nothing is
          calculated from ingredients, and meals without source data aren't counted.
          Estimates only, not medical or dietary advice.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, paddingBottom: 30 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  todayRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  todayCalories: { fontSize: 44, fontWeight: '800', color: colors.primary, lineHeight: 48 },
  todayCaloriesUnit: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginLeft: 6, marginBottom: 6 },
  macroRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  macroChip: {
    flex: 1,
    backgroundColor: colors.lightGray,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  macroValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  macroLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  coverageText: { fontSize: 11, color: colors.textTertiary },
  goalEdit: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 4 },
  goalEditText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  goalBlock: { marginBottom: 10 },
  goalTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.lightGray,
    overflow: 'hidden',
    marginBottom: 4,
  },
  goalFill: { height: '100%', borderRadius: 5, backgroundColor: colors.primary },
  goalFillOver: { backgroundColor: colors.error },
  goalRemaining: { fontSize: 11, color: colors.textSecondary },
  goalRemainingOver: { color: colors.error, fontWeight: '600' },
  goalModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  goalModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
  },
  goalModalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  goalModalHint: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, lineHeight: 16 },
  goalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: 14,
  },
  goalModalButtons: { flexDirection: 'row', gap: 10 },
  goalModalCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.lightGray,
  },
  goalModalCancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  goalModalSave: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  goalModalSaveText: { fontSize: 14, fontWeight: '600', color: colors.onPrimary },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 6 },
  barColumn: { flex: 1, alignItems: 'center', height: '100%' },
  barValue: { fontSize: 9, color: colors.textTertiary, marginBottom: 2 },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 5, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },
  barToday: { backgroundColor: colors.primary },
  barLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  barLabelToday: { color: colors.primary, fontWeight: '700' },
  rangeToggle: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  rangeChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
  },
  rangeChipActive: { backgroundColor: colors.primary },
  rangeChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  rangeChipTextActive: { color: colors.onPrimary },
  avgRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  avgCell: { flex: 1, alignItems: 'center' },
  avgValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  avgLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 1, textAlign: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  topTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, marginRight: 10 },
  topMeta: { fontSize: 12, color: colors.textSecondary },
  disclaimer: { flexDirection: 'row', paddingHorizontal: 4, marginTop: 2 },
  disclaimerText: { flex: 1, fontSize: 11, color: colors.textTertiary, lineHeight: 15 },
});

export default NutritionStats;

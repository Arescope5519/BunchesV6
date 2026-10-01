/**
 * FILENAME: src/components/MealTemplatesModal.js
 * PURPOSE: Week templates for the Kitchen planner, shared by the Cook
 * and Eat tabs. One template snapshots the open week's WHOLE plan:
 * the cook events (incl. takeout plans) AND the planned meals that eat
 * from them, linked by key - so loading a template recreates both
 * sides with the fridge math intact (meals reference the newly created
 * cook events).
 *
 * Template shape (meal_templates.meals jsonb), version 2:
 *   { version: 2,
 *     cooks: [{ key, dayOffset, recipeId, servings, sortOrder,
 *               isTakeout, takeoutName }],
 *     eats:  [{ dayOffset, cookKey, servings, sortOrder }] }
 * dayOffset is relative to the week's Sunday. Version-1 templates (a
 * plain array of cook entries) still load.
 *
 * Meals that eat food from OUTSIDE the week (older leftovers) are not
 * part of a week's shape and are skipped at save time.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import {
  getCookEvents,
  createCookEvent,
  deleteCookEvent,
  getMealEvents,
  createMealEvent,
  deleteMealEvent,
  getMealTemplates,
  saveMealTemplate,
  deleteMealTemplate,
  getWeekDays,
  parseLocalDate,
  toDateString,
} from '../services/supabase/kitchen';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const clampDay = (n) => Math.min(Math.max(Number(n) || 0, 0), 6);

const addDays = (dateStr, n) => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateString(d);
};

const dayOffsetOf = (dateStr, weekStartStr) =>
  Math.round((parseLocalDate(dateStr) - parseLocalDate(weekStartStr)) / 86400000);

// v1 templates were a plain array of cook entries
const normalizeTemplate = (meals) => {
  if (Array.isArray(meals)) {
    return {
      cooks: meals.map((m, i) => ({ key: `c${i}`, isTakeout: false, ...m })),
      eats: [],
    };
  }
  return {
    cooks: Array.isArray(meals?.cooks) ? meals.cooks : [],
    eats: Array.isArray(meals?.eats) ? meals.eats : [],
  };
};

const MealTemplatesModal = ({ visible, onClose, userId, weekStart, recipes = [], onChanged }) => {
  const [templates, setTemplates] = useState([]);
  const [weekCooks, setWeekCooks] = useState([]);
  const [weekMeals, setWeekMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const weekEnd = getWeekDays(weekStart)[6];
  const findRecipe = (id) => recipes.find(r => r.id === id && !r.deletedAt);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getMealTemplates(userId),
      getCookEvents(userId, weekStart, weekEnd),
      getMealEvents(userId, weekStart, weekEnd),
    ])
      .then(([tpls, cooks, meals]) => {
        if (cancelled) return;
        setTemplates(tpls);
        setWeekCooks(cooks);
        setWeekMeals(meals);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, userId, weekStart]);

  const planCount = weekCooks.length + weekMeals.filter(m => weekCooks.some(c => c.id === m.cook_event_id)).length;

  const handleSave = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name Needed', 'Give this template a name first.');
      return;
    }
    if (weekCooks.length === 0) {
      Alert.alert('Empty Week', 'Plan some cooking this week before saving it as a template.');
      return;
    }
    setSaving(true);
    const cooks = weekCooks.map((e, i) => ({
      key: `c${i}`,
      dayOffset: dayOffsetOf(e.cook_date, weekStart),
      recipeId: e.recipe_id || null,
      servings: e.servings_produced,
      sortOrder: e.sort_order || 0,
      isTakeout: !!e.is_takeout,
      takeoutName: e.takeout_name || null,
    }));
    const eats = weekMeals
      .map(m => {
        const idx = weekCooks.findIndex(c => c.id === m.cook_event_id);
        if (idx === -1) return null; // eats older leftovers - not part of this week's shape
        return {
          dayOffset: dayOffsetOf(m.meal_date, weekStart),
          cookKey: `c${idx}`,
          servings: m.servings_consumed,
          sortOrder: m.sort_order || 0,
        };
      })
      .filter(Boolean);

    const created = await saveMealTemplate(userId, name, { version: 2, cooks, eats });
    setSaving(false);
    if (created) {
      setTemplates([created, ...templates]);
      setNewName('');
    } else {
      Alert.alert('Error', 'Could not save the template. Please try again.');
    }
  };

  const runLoad = async (template, { replace }) => {
    setLoadingId(template.id);
    const t = normalizeTemplate(template.meals);
    const todayStr = toDateString(new Date());
    const dateOf = (off) => addDays(weekStart, clampDay(off));

    // Only what's left of the viewed week loads
    const usableCooks = t.cooks.filter(c =>
      dateOf(c.dayOffset) >= todayStr && (c.isTakeout || findRecipe(c.recipeId))
    );
    const usableKeys = new Set(usableCooks.map(c => c.key));

    if (replace) {
      // Meals first - they reference the cook events
      await Promise.all(
        weekMeals.filter(m => m.meal_date >= todayStr).map(m => deleteMealEvent(m.id))
      );
      await Promise.all(
        weekCooks.filter(c => c.cook_date >= todayStr).map(c => deleteCookEvent(c.id))
      );
    }

    // Per-day append counters start from what survives
    const cookDayCounts = {};
    const mealDayCounts = {};
    if (!replace) {
      weekCooks.forEach(c => { cookDayCounts[c.cook_date] = (cookDayCounts[c.cook_date] || 0) + 1; });
      weekMeals.forEach(m => { mealDayCounts[m.meal_date] = (mealDayCounts[m.meal_date] || 0) + 1; });
    }

    // Create cook events, remembering key -> created id for the eats
    const idByKey = {};
    for (const cook of [...usableCooks].sort((a, b) => a.dayOffset - b.dayOffset || (a.sortOrder || 0) - (b.sortOrder || 0))) {
      const cookDate = dateOf(cook.dayOffset);
      const sortOrder = cookDayCounts[cookDate] || 0;
      cookDayCounts[cookDate] = sortOrder + 1;
      const event = await createCookEvent(userId, {
        cookDate,
        recipeId: cook.isTakeout ? null : cook.recipeId,
        servingsProduced: cook.servings,
        sortOrder,
        isTakeout: cook.isTakeout,
        takeoutName: cook.takeoutName,
      });
      if (event) idByKey[cook.key] = event.id;
    }

    // Then the planned meals that eat from them
    const usableEats = t.eats.filter(e => {
      const eatDate = dateOf(e.dayOffset);
      const cook = t.cooks.find(c => c.key === e.cookKey);
      return eatDate >= todayStr &&
        usableKeys.has(e.cookKey) && idByKey[e.cookKey] &&
        cook && eatDate >= dateOf(cook.dayOffset);
    });
    for (const eat of [...usableEats].sort((a, b) => a.dayOffset - b.dayOffset || (a.sortOrder || 0) - (b.sortOrder || 0))) {
      const mealDate = dateOf(eat.dayOffset);
      const sortOrder = mealDayCounts[mealDate] || 0;
      mealDayCounts[mealDate] = sortOrder + 1;
      await createMealEvent(userId, {
        mealDate,
        slot: 'dinner',
        cookEventId: idByKey[eat.cookKey],
        servingsConsumed: eat.servings,
        sortOrder,
      });
    }

    setLoadingId(null);
    onChanged?.();
    onClose();
  };

  const handleLoad = (template) => {
    const t = normalizeTemplate(template.meals);
    const todayStr = toDateString(new Date());
    const dateOf = (off) => addDays(weekStart, clampDay(off));
    const usableCooks = t.cooks.filter(c =>
      dateOf(c.dayOffset) >= todayStr && (c.isTakeout || findRecipe(c.recipeId))
    );
    const pastOrMissing = t.cooks.length - usableCooks.length;
    if (usableCooks.length === 0) {
      Alert.alert(
        'Nothing to Load',
        'This template has nothing that fits the remaining days of this week (recipes may also have been deleted).'
      );
      return;
    }
    const usableKeys = new Set(usableCooks.map(c => c.key));
    const eatCount = t.eats.filter(e =>
      dateOf(e.dayOffset) >= todayStr && usableKeys.has(e.cookKey)
    ).length;

    Alert.alert(
      'Load Template',
      `Load ${usableCooks.length} cook${usableCooks.length !== 1 ? 's' : ''}` +
        (eatCount > 0 ? ` and ${eatCount} planned meal${eatCount !== 1 ? 's' : ''}` : '') +
        ' into the rest of this week?' +
        (pastOrMissing > 0 ? `\n\n${pastOrMissing} entr${pastOrMissing !== 1 ? 'ies' : 'y'} will be skipped (day already passed or recipe deleted).` : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace Week', style: 'destructive', onPress: () => runLoad(template, { replace: true }) },
        { text: 'Add to Week', onPress: () => runLoad(template, { replace: false }) },
      ]
    );
  };

  const handleDeleteTemplate = (template) => {
    Alert.alert(
      'Delete Template',
      `Delete "${template.name}"? This does not touch any planned weeks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteMealTemplate(template.id);
            if (ok) setTemplates(templates.filter(t => t.id !== template.id));
          },
        },
      ]
    );
  };

  const titleOfCook = (cook) =>
    cook.isTakeout ? (cook.takeoutName || 'Takeout') : (findRecipe(cook.recipeId)?.title || '(recipe deleted)');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerAction}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Week Templates</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.saveCard}>
          <Text style={styles.saveLabel}>
            Save this week's plan ({planCount} entr{planCount !== 1 ? 'ies' : 'y'}: cooking and meals together)
          </Text>
          <View style={styles.saveRow}>
            <TextInput
              style={styles.nameInput}
              placeholder="Template name (e.g. Busy Week)"
              placeholderTextColor={colors.textSecondary}
              value={newName}
              onChangeText={setNewName}
              maxLength={40}
            />
            <TouchableOpacity
              style={[styles.saveButton, (saving || weekCooks.length === 0) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving || weekCooks.length === 0}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} />
          ) : templates.length === 0 ? (
            <View style={{ padding: 30, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                No templates yet. Plan a week you like - cooking and meals - then save it here to reuse any time.
              </Text>
            </View>
          ) : (
            templates.map(template => {
              const t = normalizeTemplate(template.meals);
              const expanded = expandedId === template.id;
              const count = t.cooks.length + t.eats.length;
              return (
                <View key={template.id} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => setExpandedId(expanded ? null : template.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{template.name}</Text>
                      <Text style={styles.cardMeta}>
                        {t.cooks.length} cook{t.cooks.length !== 1 ? 's' : ''}
                        {t.eats.length > 0 ? ` · ${t.eats.length} meal${t.eats.length !== 1 ? 's' : ''}` : ''}
                        {' · saved '}{new Date(template.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.detail}>
                      {[...t.cooks]
                        .sort((a, b) => a.dayOffset - b.dayOffset || (a.sortOrder || 0) - (b.sortOrder || 0))
                        .map((cook, i) => (
                          <Text key={`c${i}`} style={styles.detailLine}>
                            {DAY_NAMES[clampDay(cook.dayOffset)]}: Cook {titleOfCook(cook)}
                            {cook.servings ? ` · ${cook.servings} sv` : ''}
                          </Text>
                        ))}
                      {[...t.eats]
                        .sort((a, b) => a.dayOffset - b.dayOffset || (a.sortOrder || 0) - (b.sortOrder || 0))
                        .map((eat, i) => {
                          const cook = t.cooks.find(c => c.key === eat.cookKey);
                          return (
                            <Text key={`e${i}`} style={[styles.detailLine, { color: colors.textSecondary }]}>
                              {DAY_NAMES[clampDay(eat.dayOffset)]}: Eat {cook ? titleOfCook(cook) : '(unknown)'}
                              {eat.servings ? ` · ${eat.servings} sv` : ''}
                            </Text>
                          );
                        })}
                      {count === 0 && <Text style={styles.detailLine}>Empty template</Text>}
                    </View>
                  )}

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.loadButton}
                      onPress={() => handleLoad(template)}
                      disabled={loadingId !== null}
                    >
                      {loadingId === template.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.loadButtonText}>Load into This Week</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteTemplate(template)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
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
  headerAction: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  saveCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  saveLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  saveRow: { flexDirection: 'row', alignItems: 'center' },
  nameInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  detail: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  detailLine: { fontSize: 13, color: colors.text, marginBottom: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingTop: 0 },
  loadButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  loadButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  deleteButton: { padding: 6 },
});

export default MealTemplatesModal;

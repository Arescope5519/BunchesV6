/**
 * FILENAME: src/components/CookSchedule.js
 * PURPOSE: Weekly calendar for planning when to cook what.
 * Each day can have multiple cook events (recipe + servings produced).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import LetterPlaceholder from './LetterPlaceholder';
import {
  getCookEvents,
  createCookEvent,
  updateCookEvent,
  deleteCookEvent,
  getMealTemplates,
  saveMealTemplate,
  deleteMealTemplate,
  getWeekStart,
  getWeekDays,
  formatDayLabel,
  parseLocalDate,
  toDateString,
} from '../services/supabase/kitchen';

// Sunday-first, matching getWeekStart
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const addDays = (dateStr, n) => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return toDateString(d);
};

const dayOffsetOf = (dateStr, weekStartStr) =>
  Math.round((parseLocalDate(dateStr) - parseLocalDate(weekStartStr)) / 86400000);

const CookSchedule = ({ userId, recipes = [], onOpenRecipe, weekStart: weekStartProp, onChangeWeek }) => {
  // Controlled by KitchenScreen when provided, so Cook and Eat share
  // the same viewed week; falls back to local state when standalone
  const [localWeekStart, setLocalWeekStart] = useState(getWeekStart());
  const weekStart = weekStartProp || localWeekStart;
  const setWeekStart = onChangeWeek || setLocalWeekStart;
  const [cookEvents, setCookEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pickerDate, setPickerDate] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // ---- Drag & drop (long-press a meal box, drop on another day) ----
  // Armed by onLongPress; a capture PanResponder on the container then
  // steals the gesture and tracks the finger. Targets (meal boxes and
  // "+ Add" slots) are measured in window coords at drag start.
  const [dragging, setDragging] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);
  const draggingRef = useRef(null);
  const hoverKeyRef = useRef(null);
  const targetsRef = useRef({});
  const rectsRef = useRef([]);
  const containerOriginRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const dragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Edge auto-scroll while dragging: holding a meal near the list's
  // top/bottom edge scrolls it, so drops can land beyond the viewport.
  // Target rects were measured at drag start, so hit-testing offsets
  // them by how far the list has scrolled since.
  const scrollRef = useRef(null);
  const scrollWrapRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const scrollAreaRef = useRef({ y: 0, height: 0 });
  const contentSizeRef = useRef({ h: 0, viewH: 0 });
  const autoScrollDirRef = useRef(0);
  const autoScrollTimerRef = useRef(null);
  const lastFingerRef = useRef({ x: 0, y: 0 });

  const stopAutoScroll = () => {
    autoScrollDirRef.current = 0;
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  };

  useEffect(() => stopAutoScroll, []);

  const computeHover = (x, y) => {
    const dragged = draggingRef.current;
    if (!dragged) return;
    const scrollDelta = scrollOffsetRef.current - dragStartOffsetRef.current;
    const hit = rectsRef.current.find(r =>
      x >= r.x && x <= r.x + r.w &&
      y >= r.y - scrollDelta && y <= r.y - scrollDelta + r.h
    );
    let key = null;
    if (hit) {
      if (hit.type === 'add' && hit.date !== dragged.cook_date) key = hit.key;
      // Any other meal is a target: another day swaps days, the same
      // day swaps cooking order
      if (hit.type === 'event' && hit.event.id !== dragged.id) key = hit.key;
    }
    if (key !== hoverKeyRef.current) {
      hoverKeyRef.current = key;
      setHoverKey(key);
    }
  };

  const setAutoScroll = (dir) => {
    if (dir === autoScrollDirRef.current) return;
    stopAutoScroll();
    autoScrollDirRef.current = dir;
    if (dir === 0) return;
    autoScrollTimerRef.current = setInterval(() => {
      const maxOffset = Math.max(0, contentSizeRef.current.h - contentSizeRef.current.viewH);
      const next = Math.max(0, Math.min(maxOffset, scrollOffsetRef.current + autoScrollDirRef.current * 14));
      if (next === scrollOffsetRef.current) return;
      scrollOffsetRef.current = next;
      scrollRef.current?.scrollTo({ y: next, animated: false });
      // Targets moved under a still finger - re-run the hit test
      computeHover(lastFingerRef.current.x, lastFingerRef.current.y);
    }, 16);
  };

  const registerTarget = (key, info) => (node) => {
    if (node) targetsRef.current[key] = { ...info, node };
    else delete targetsRef.current[key];
  };

  const startDrag = (cookEvent, pageX, pageY) => {
    rectsRef.current = [];
    Object.entries(targetsRef.current).forEach(([key, t]) => {
      if (!t.node?.measureInWindow) return;
      t.node.measureInWindow((x, y, w, h) => {
        rectsRef.current.push({ key, type: t.type, date: t.date, event: t.event, x, y, w, h });
      });
    });
    containerRef.current?.measureInWindow((x, y) => {
      containerOriginRef.current = { x, y };
    });
    scrollWrapRef.current?.measureInWindow((x, y, w, h) => {
      scrollAreaRef.current = { y, height: h };
    });
    dragStartOffsetRef.current = scrollOffsetRef.current;
    draggingRef.current = cookEvent;
    hoverKeyRef.current = null;
    dragPos.setValue({ x: pageX, y: pageY });
    setDragging(cookEvent);
    setHoverKey(null);
  };

  const resetDrag = () => {
    stopAutoScroll();
    draggingRef.current = null;
    hoverKeyRef.current = null;
    setDragging(null);
    setHoverKey(null);
  };

  const commitDrag = async () => {
    const dragged = draggingRef.current;
    const key = hoverKeyRef.current;
    const rect = key ? rectsRef.current.find(r => r.key === key) : null;
    resetDrag();
    if (!dragged || !rect) return;

    if (rect.type === 'add') {
      // Dropped on a day's Add slot: move the meal to the end of that day
      const endOrder = cookEvents.filter(e => e.cook_date === rect.date && e.id !== dragged.id).length;
      const ok = await updateCookEvent(dragged.id, { cookDate: rect.date, sortOrder: endOrder });
      if (ok) {
        setCookEvents(prev => prev.map(e =>
          e.id === dragged.id ? { ...e, cook_date: rect.date, sort_order: endOrder } : e
        ));
      }
    } else if (rect.type === 'event' && rect.event.cook_date === dragged.cook_date) {
      // Same day: swap cooking order. Renumber the whole day from its
      // displayed order so legacy all-zero sort_orders behave too
      const other = rect.event;
      const day = cookEvents.filter(e => e.cook_date === dragged.cook_date).sort(byDayOrder);
      const i = day.findIndex(e => e.id === dragged.id);
      const j = day.findIndex(e => e.id === other.id);
      if (i === -1 || j === -1) return;
      [day[i], day[j]] = [day[j], day[i]];
      const results = await Promise.all(day.map((e, idx) => updateCookEvent(e.id, { sortOrder: idx })));
      if (results.every(Boolean)) {
        setCookEvents(prev => prev.map(e => {
          const idx = day.findIndex(d => d.id === e.id);
          return idx === -1 ? e : { ...e, sort_order: idx };
        }));
      }
    } else if (rect.type === 'event') {
      // Another day's meal: the two swap days (and slots)
      const other = rect.event;
      const [a, b] = await Promise.all([
        updateCookEvent(dragged.id, { cookDate: other.cook_date, sortOrder: other.sort_order || 0 }),
        updateCookEvent(other.id, { cookDate: dragged.cook_date, sortOrder: dragged.sort_order || 0 }),
      ]);
      if (a && b) {
        setCookEvents(prev => prev.map(e => {
          if (e.id === dragged.id) return { ...e, cook_date: other.cook_date, sort_order: other.sort_order || 0 };
          if (e.id === other.id) return { ...e, cook_date: dragged.cook_date, sort_order: dragged.sort_order || 0 };
          return e;
        }));
      }
    }
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: () => !!draggingRef.current,
    onPanResponderMove: (_evt, gesture) => {
      if (!draggingRef.current) return;
      dragPos.setValue({ x: gesture.moveX, y: gesture.moveY });
      lastFingerRef.current = { x: gesture.moveX, y: gesture.moveY };
      computeHover(gesture.moveX, gesture.moveY);

      // Near the list's edges? Keep scrolling while the finger holds
      const EDGE = 90;
      const area = scrollAreaRef.current;
      let dir = 0;
      if (area.height > 0) {
        if (gesture.moveY < area.y + EDGE) dir = -1;
        else if (gesture.moveY > area.y + area.height - EDGE) dir = 1;
      }
      setAutoScroll(dir);
    },
    onPanResponderRelease: () => { commitDrag(); },
    onPanResponderTerminate: () => { resetDrag(); },
  })).current;

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekEnd = weekDays[6];

  // Planning looks forward: the current week starts at today. Weeks
  // navigated back to are history and stay fully visible.
  const todayStr = toDateString(new Date());
  const isCurrentWeek = weekDays.includes(todayStr);
  const visibleDays = isCurrentWeek ? weekDays.filter(d => d >= todayStr) : weekDays;

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

  // Within-day order: sort_order first (drag-arranged), created_at as
  // the tiebreak for legacy rows that are all 0
  const byDayOrder = (a, b) =>
    (a.sort_order || 0) - (b.sort_order || 0) ||
    String(a.created_at || '').localeCompare(String(b.created_at || ''));

  const cookEventsForDate = (date) =>
    cookEvents.filter(e => e.cook_date === date).sort(byDayOrder);

  const shiftWeek = (deltaDays) => {
    setWeekStart(addDays(weekStart, deltaDays));
  };

  const handleAdd = async (recipe, servings) => {
    if (!pickerDate || !userId) return;
    const created = await createCookEvent(userId, {
      cookDate: pickerDate,
      recipeId: recipe.id,
      servingsProduced: servings,
      sortOrder: cookEventsForDate(pickerDate).length,
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

  const draggedRecipe = dragging ? findRecipe(dragging.recipe_id) : null;

  return (
    <View style={styles.container} ref={containerRef} {...panResponder.panHandlers}>
      {/* Week Navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => shiftWeek(-7)} style={styles.weekNavButton}>
          <Text style={styles.weekNavText}>{'< Prev'}</Text>
        </TouchableOpacity>
        <View style={styles.weekLabel}>
          <Text style={styles.weekLabelText}>Week of {parseLocalDate(weekStart).toLocaleDateString()}</Text>
          <TouchableOpacity onPress={() => setWeekStart(getWeekStart())}>
            <Text style={styles.todayLink}>Today</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => shiftWeek(7)} style={styles.weekNavButton}>
          <Text style={styles.weekNavText}>{'Next >'}</Text>
        </TouchableOpacity>
      </View>

      {/* Templates + drag hint bar */}
      <View style={styles.toolBar}>
        <Text style={styles.toolBarHint}>Hold & drag a meal to move it</Text>
        <TouchableOpacity style={styles.templatesButton} onPress={() => setShowTemplates(true)}>
          <Ionicons name="albums-outline" size={15} color={colors.primary} style={{ marginRight: 5 }} />
          <Text style={styles.templatesButtonText}>Templates</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <View ref={scrollWrapRef} collapsable={false} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.grid}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          scrollEnabled={!dragging}
          scrollEventThrottle={16}
          onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          onContentSizeChange={(_w, h) => { contentSizeRef.current.h = h; }}
          onLayout={(e) => { contentSizeRef.current.viewH = e.nativeEvent.layout.height; }}
        >
          {visibleDays.map(date => {
            const events = cookEventsForDate(date);
            return (
              <View key={date} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{formatDayLabel(date)}</Text>

                {events.map(event => {
                  const recipe = findRecipe(event.recipe_id);
                  const isDragSource = dragging?.id === event.id;
                  const isSwapTarget = hoverKey === `ev:${event.id}`;
                  return (
                    // Wrapper View carries the measurement ref -
                    // Touchable refs aren't native views, and Android
                    // needs collapsable={false} to measure
                    <View
                      key={event.id}
                      ref={registerTarget(`ev:${event.id}`, { type: 'event', date, event })}
                      collapsable={false}
                    >
                    <TouchableOpacity
                      style={[
                        styles.cookEvent,
                        isDragSource && styles.cookEventDragging,
                        isSwapTarget && styles.cookEventSwapTarget,
                      ]}
                      onPress={() => recipe && onOpenRecipe?.(recipe)}
                      delayLongPress={150}
                      onLongPress={(e) => startDrag(event, e.nativeEvent.pageX, e.nativeEvent.pageY)}
                    >
                      {recipe?.image_url ? (
                        <Image source={{ uri: recipe.image_url }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Ionicons name="flame" size={16} color={colors.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cookTitle} numberOfLines={1}>
                          {isSwapTarget
                            ? (dragging?.cook_date === event.cook_date ? 'Swap order' : 'Swap days')
                            : (recipe?.title || '(deleted recipe)')}
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
                    </View>
                  );
                })}

                <View
                  ref={registerTarget(`add:${date}`, { type: 'add', date })}
                  collapsable={false}
                >
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    hoverKey === `add:${date}` && styles.addButtonDropTarget,
                  ]}
                  onPress={() => setPickerDate(date)}
                >
                  <Text style={[
                    styles.addButtonText,
                    hoverKey === `add:${date}` && styles.addButtonTextDropTarget,
                  ]}>
                    {hoverKey === `add:${date}` ? 'Move here' : '+ Add a meal'}
                  </Text>
                </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
        </View>
      )}

      {/* Ghost of the dragged meal following the finger */}
      {dragging && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dragGhost,
            {
              transform: [
                { translateX: Animated.subtract(dragPos.x, containerOriginRef.current.x + 110) },
                { translateY: Animated.subtract(dragPos.y, containerOriginRef.current.y + 24) },
              ],
            },
          ]}
        >
          <Ionicons name="flame" size={14} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.dragGhostText} numberOfLines={1}>
            {draggedRecipe?.title || 'Meal'}
          </Text>
        </Animated.View>
      )}

      {/* Recipe Picker */}
      <RecipePicker
        visible={!!pickerDate}
        onClose={() => setPickerDate(null)}
        onPick={handleAdd}
        recipes={recipes}
        dateLabel={pickerDate ? formatDayLabel(pickerDate) : ''}
      />

      {/* Week templates: save the open week, browse, load */}
      <TemplatesModal
        visible={showTemplates}
        onClose={() => setShowTemplates(false)}
        userId={userId}
        weekStart={weekStart}
        cookEvents={cookEvents}
        recipes={recipes}
        findRecipe={findRecipe}
        onLoaded={(created, { replace } = {}) =>
          setCookEvents(prev => {
            if (!replace) return [...prev, ...created];
            // Replace cleared only today-forward; keep past days
            const todayStr = toDateString(new Date());
            return [...prev.filter(e => e.cook_date < todayStr), ...created];
          })
        }
      />
    </View>
  );
};

// -----------------------------------------------------------------------------
// Templates - save the open week's cook plan under a name, browse saved
// templates (expand to see the meals), load one into the open week
// -----------------------------------------------------------------------------

const TemplatesModal = ({ visible, onClose, userId, weekStart, cookEvents, recipes, findRecipe, onLoaded }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!visible || !userId) return;
    setLoading(true);
    getMealTemplates(userId)
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [visible, userId]);

  const handleSave = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name Needed', 'Give this template a name first.');
      return;
    }
    if (cookEvents.length === 0) {
      Alert.alert('Empty Week', 'Add some meals to the week before saving it as a template.');
      return;
    }
    setSaving(true);
    const meals = cookEvents.map(e => ({
      dayOffset: dayOffsetOf(e.cook_date, weekStart),
      recipeId: e.recipe_id,
      servings: e.servings_produced,
    }));
    const created = await saveMealTemplate(userId, name, meals);
    setSaving(false);
    if (created) {
      setTemplates([created, ...templates]);
      setNewName('');
    } else {
      Alert.alert('Error', 'Could not save the template. Please try again.');
    }
  };

  const runLoad = async (template, usable, { replace }) => {
    setLoadingId(template.id);
    const todayStr = toDateString(new Date());

    // Replace: clear the open week's REMAINING planned meals (past
    // days are history - already-cooked events and their fridge math
    // stay; takeout entries aren't in this list and are left alone)
    if (replace) {
      await Promise.all(
        cookEvents.filter(e => e.cook_date >= todayStr).map(e => deleteCookEvent(e.id))
      );
    }

    const created = [];
    // Append after each day's remaining meals, in template order
    const dayCounts = {};
    if (!replace) {
      cookEvents.forEach(e => {
        dayCounts[e.cook_date] = (dayCounts[e.cook_date] || 0) + 1;
      });
    }
    for (const meal of usable) {
      const cookDate = addDays(weekStart, Math.min(Math.max(meal.dayOffset, 0), 6));
      // Only what's left of the week: days already past are skipped
      if (cookDate < todayStr) continue;
      const sortOrder = dayCounts[cookDate] || 0;
      dayCounts[cookDate] = sortOrder + 1;
      const event = await createCookEvent(userId, {
        cookDate,
        recipeId: meal.recipeId,
        servingsProduced: meal.servings,
        sortOrder,
      });
      if (event) created.push(event);
    }
    setLoadingId(null);
    onLoaded(created, { replace });
    onClose();
  };

  const handleLoad = (template) => {
    const meals = Array.isArray(template.meals) ? template.meals : [];
    const todayStr = toDateString(new Date());
    const withRecipes = meals.filter(m => findRecipe(m.recipeId));
    // Only what's left of the viewed week loads - meals landing on
    // days already past are skipped
    const usable = withRecipes.filter(m =>
      addDays(weekStart, Math.min(Math.max(m.dayOffset, 0), 6)) >= todayStr
    );
    const skipped = meals.length - withRecipes.length;
    const pastSkipped = withRecipes.length - usable.length;
    if (usable.length === 0) {
      Alert.alert(
        'Nothing to Load',
        pastSkipped > 0
          ? 'All of this template\'s meals would land on days that have already passed this week.'
          : 'None of this template\'s recipes exist in your cookbook anymore.'
      );
      return;
    }
    Alert.alert(
      'Load Template',
      `Load ${usable.length} meal${usable.length !== 1 ? 's' : ''} into the rest of this week?` +
        (pastSkipped > 0 ? `\n\n${pastSkipped} meal${pastSkipped !== 1 ? 's' : ''} fall on days already passed and will be skipped.` : '') +
        (skipped > 0 ? `\n\n${skipped} meal${skipped !== 1 ? 's' : ''} will be skipped (recipe no longer exists).` : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace Week',
          style: 'destructive',
          onPress: () => runLoad(template, usable, { replace: true }),
        },
        {
          text: 'Add to Week',
          onPress: () => runLoad(template, usable, { replace: false }),
        },
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerAction}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Week Templates</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.templateSaveCard}>
          <Text style={styles.templateSaveLabel}>
            Save this week ({cookEvents.length} meal{cookEvents.length !== 1 ? 's' : ''}) as a template
          </Text>
          <View style={styles.templateSaveRow}>
            <TextInput
              style={styles.templateNameInput}
              placeholder="Template name (e.g. Busy Week)"
              placeholderTextColor={colors.textSecondary}
              value={newName}
              onChangeText={setNewName}
              maxLength={40}
            />
            <TouchableOpacity
              style={[styles.templateSaveButton, (saving || cookEvents.length === 0) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving || cookEvents.length === 0}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.templateSaveButtonText}>Save</Text>
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
                No templates yet. Plan a week you like, then save it here to reuse it any time.
              </Text>
            </View>
          ) : (
            templates.map(template => {
              const meals = Array.isArray(template.meals) ? template.meals : [];
              const expanded = expandedId === template.id;
              return (
                <View key={template.id} style={styles.templateCard}>
                  <TouchableOpacity
                    style={styles.templateCardHeader}
                    onPress={() => setExpandedId(expanded ? null : template.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text style={styles.templateMeta}>
                        {meals.length} meal{meals.length !== 1 ? 's' : ''} · saved {new Date(template.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.templateDetail}>
                      {[...meals]
                        .sort((a, b) => a.dayOffset - b.dayOffset)
                        .map((meal, i) => {
                          const recipe = findRecipe(meal.recipeId);
                          return (
                            <Text key={i} style={[styles.templateDetailLine, !recipe && { color: colors.textTertiary }]}>
                              {DAY_NAMES[Math.min(Math.max(meal.dayOffset, 0), 6)]}: {recipe?.title || '(recipe deleted)'}
                              {meal.servings ? ` · ${meal.servings} serving${meal.servings !== 1 ? 's' : ''}` : ''}
                            </Text>
                          );
                        })}
                    </View>
                  )}

                  <View style={styles.templateActions}>
                    <TouchableOpacity
                      style={styles.templateLoadButton}
                      onPress={() => handleLoad(template)}
                      disabled={loadingId !== null}
                    >
                      {loadingId === template.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.templateLoadButtonText}>Load into This Week</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.templateDeleteButton}
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
            <Text style={styles.headerAction}>Cancel</Text>
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
  addButtonDropTarget: {
    borderColor: colors.primary,
    borderStyle: 'solid',
    backgroundColor: colors.primaryLight,
  },
  addButtonTextDropTarget: { color: colors.primary, fontWeight: '700' },
  cookEventDragging: { opacity: 0.35 },
  cookEventSwapTarget: {
    borderColor: colors.accentDark,
    backgroundColor: colors.accentLight,
  },
  dragGhost: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 220,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  dragGhostText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  toolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolBarHint: { fontSize: 12, color: colors.textTertiary },
  templatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  templatesButtonText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // Templates modal
  templateSaveCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  templateSaveLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  templateSaveRow: { flexDirection: 'row', alignItems: 'center' },
  templateNameInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    marginRight: 8,
  },
  templateSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  templateSaveButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  templateCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  templateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  templateName: { fontSize: 15, fontWeight: '700', color: colors.text },
  templateMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  templateDetail: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },
  templateDetailLine: { fontSize: 13, color: colors.text, marginBottom: 4 },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingTop: 0,
  },
  templateLoadButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  templateLoadButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  templateDeleteButton: { padding: 6 },

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

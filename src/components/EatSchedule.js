/**
 * FILENAME: src/components/EatSchedule.js
 * PURPOSE: Weekly meal calendar. Assign meals from fridge (leftovers) or add takeout.
 *
 * Slots: breakfast, lunch, dinner (per day).
 * Add meal options:
 *   - From Fridge: pick a cooked item, choose servings to eat
 *   - Take Out: enter takeout name + servings ordered/eaten (leftovers → fridge)
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
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import {
  getMealEvents,
  createMealEvent,
  updateMealEvent,
  deleteMealEvent,
  getFridgeInventory,
  createCookEvent,
  getCookEvents,
  getWeekStart,
  getWeekDays,
  formatDayLabel,
  parseLocalDate,
  toDateString,
} from '../services/supabase/kitchen';
import MealTemplatesModal from './MealTemplatesModal';

// Named meal slots (breakfast/lunch/dinner) were dropped from the UI -
// not everyone's day fits them and they ate vertical space. Days hold
// one ordered list instead (drag to arrange). The DB slot column stays
// and new events write 'dinner' to satisfy any legacy constraint;
// display ignores it.
const MEAL_SLOT = 'dinner';

const EatSchedule = ({ userId, recipes = [], onOpenRecipe, weekStart: weekStartProp, onChangeWeek }) => {
  // Controlled by KitchenScreen when provided, so Cook and Eat share
  // the same viewed week; falls back to local state when standalone
  const [localWeekStart, setLocalWeekStart] = useState(getWeekStart());
  const weekStart = weekStartProp || localWeekStart;
  const setWeekStart = onChangeWeek || setLocalWeekStart;
  const [mealEvents, setMealEvents] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [allCookEvents, setAllCookEvents] = useState([]); // For display lookup, includes empty-fridge items
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState(null); // { date, slot }
  const [showTemplates, setShowTemplates] = useState(false);
  // Inventory for the date being planned: the regular fridge PLUS
  // future planned cooks up to that eat date, so Wednesday's meal can
  // be planned against Tuesday's not-yet-cooked plan. Their remaining
  // already nets out pre-planned servings.
  const [pickInventory, setPickInventory] = useState([]);

  useEffect(() => {
    if (!addingTo || !userId) return;
    let cancelled = false;
    setPickInventory(inventory);
    getFridgeInventory(userId, 10, { includePlannedUntil: addingTo.date })
      .then(list => { if (!cancelled) setPickInventory(list); });
    return () => { cancelled = true; };
  }, [addingTo?.date, addingTo?.slot, userId]);
  const [editingMeal, setEditingMeal] = useState(null); // meal_event being edited
  const [editServings, setEditServings] = useState(1);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekEnd = weekDays[6];

  // Planning looks forward: the current week starts at today. Weeks
  // navigated back to are history and stay fully visible.
  const todayStr = toDateString(new Date());
  const isCurrentWeek = weekDays.includes(todayStr);
  const visibleDays = isCurrentWeek ? weekDays.filter(d => d >= todayStr) : weekDays;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Look back further for cook events to make sure we can display meals
      // that reference older (now-depleted) cook events
      const lookbackDate = parseLocalDate(weekStart);
      lookbackDate.setDate(lookbackDate.getDate() - 14);
      const lookbackStr = toDateString(lookbackDate);

      const [meals, fridge, cooks] = await Promise.all([
        getMealEvents(userId, weekStart, weekEnd),
        getFridgeInventory(userId, 10),
        getCookEvents(userId, lookbackStr, weekEnd),
      ]);
      setMealEvents(meals);
      setInventory(fridge);
      setAllCookEvents(cooks);
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart, weekEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const findRecipe = (id) => recipes.find(r => r.id === id && !r.deletedAt);
  const findCookEvent = (id) => inventory.find(i => i.cookEvent.id === id)?.cookEvent;

  // Map of cook_event_id → cook event, so we can display meals whose cook events
  // no longer have any remaining servings (and thus aren't in the fridge).
  const knownCookEvents = useMemo(() => {
    const map = {};
    inventory.forEach(i => { map[i.cookEvent.id] = i.cookEvent; });
    allCookEvents.forEach(c => { map[c.id] = c; });
    return map;
  }, [inventory, allCookEvents]);

  const byDayOrder = (a, b) =>
    (a.sort_order || 0) - (b.sort_order || 0) ||
    String(a.created_at || '').localeCompare(String(b.created_at || ''));

  const mealsForDate = (date) =>
    mealEvents.filter(m => m.meal_date === date).sort(byDayOrder);

  // ---- Drag & drop (same pattern as CookSchedule): long-press a meal,
  // drop on another meal to swap (same day = order, other day = days),
  // drop on a day's Add slot to move it there. A meal can never land
  // before its food's cook date. ----
  const [dragging, setDragging] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);
  const draggingRef = useRef(null);
  const hoverKeyRef = useRef(null);
  const targetsRef = useRef({});
  const rectsRef = useRef([]);
  const containerOriginRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const dragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
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

  const registerTarget = (key, info) => (node) => {
    if (node) targetsRef.current[key] = { ...info, node };
    else delete targetsRef.current[key];
  };

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
      if (hit.type === 'add' && hit.date !== dragged.meal_date) key = hit.key;
      if (hit.type === 'meal' && hit.meal.id !== dragged.id) key = hit.key;
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
      computeHover(lastFingerRef.current.x, lastFingerRef.current.y);
    }, 16);
  };

  const startDrag = (meal, pageX, pageY) => {
    rectsRef.current = [];
    Object.entries(targetsRef.current).forEach(([key, t]) => {
      if (!t.node?.measureInWindow) return;
      t.node.measureInWindow((x, y, w, h) => {
        rectsRef.current.push({ key, type: t.type, date: t.date, meal: t.meal, x, y, w, h });
      });
    });
    containerRef.current?.measureInWindow((x, y) => {
      containerOriginRef.current = { x, y };
    });
    scrollWrapRef.current?.measureInWindow((x, y, w, h) => {
      scrollAreaRef.current = { y, height: h };
    });
    dragStartOffsetRef.current = scrollOffsetRef.current;
    draggingRef.current = meal;
    hoverKeyRef.current = null;
    dragPos.setValue({ x: pageX, y: pageY });
    setDragging(meal);
    setHoverKey(null);
  };

  const resetDrag = () => {
    stopAutoScroll();
    draggingRef.current = null;
    hoverKeyRef.current = null;
    setDragging(null);
    setHoverKey(null);
  };

  // A meal can't be scheduled before the day its food gets cooked
  const cookDateOf = (meal) => knownCookEvents[meal.cook_event_id]?.cook_date || null;
  const violatesCookDate = (meal, newDate) => {
    const cookDate = cookDateOf(meal);
    return cookDate ? newDate < cookDate : false;
  };

  const commitDrag = async () => {
    const dragged = draggingRef.current;
    const key = hoverKeyRef.current;
    const rect = key ? rectsRef.current.find(r => r.key === key) : null;
    resetDrag();
    if (!dragged || !rect) return;

    if (rect.type === 'add') {
      if (violatesCookDate(dragged, rect.date)) {
        Alert.alert('Too Early', 'That meal\'s food isn\'t cooked until after this day.');
        return;
      }
      const endOrder = mealEvents.filter(m => m.meal_date === rect.date && m.id !== dragged.id).length;
      const ok = await updateMealEvent(dragged.id, { mealDate: rect.date, sortOrder: endOrder });
      if (ok) {
        setMealEvents(prev => prev.map(m =>
          m.id === dragged.id ? { ...m, meal_date: rect.date, sort_order: endOrder } : m
        ));
      }
    } else if (rect.type === 'meal' && rect.meal.meal_date === dragged.meal_date) {
      // Same day: swap eating order, renumbering from displayed order
      const other = rect.meal;
      const day = mealEvents.filter(m => m.meal_date === dragged.meal_date).sort(byDayOrder);
      const i = day.findIndex(m => m.id === dragged.id);
      const j = day.findIndex(m => m.id === other.id);
      if (i === -1 || j === -1) return;
      [day[i], day[j]] = [day[j], day[i]];
      const results = await Promise.all(day.map((m, idx) => updateMealEvent(m.id, { sortOrder: idx })));
      if (results.every(Boolean)) {
        setMealEvents(prev => prev.map(m => {
          const idx = day.findIndex(d => d.id === m.id);
          return idx === -1 ? m : { ...m, sort_order: idx };
        }));
      }
    } else if (rect.type === 'meal') {
      // Another day: the two meals swap days (and slots)
      const other = rect.meal;
      if (violatesCookDate(dragged, other.meal_date) || violatesCookDate(other, dragged.meal_date)) {
        Alert.alert('Too Early', 'One of these meals would land before its food is cooked.');
        return;
      }
      const [a, b] = await Promise.all([
        updateMealEvent(dragged.id, { mealDate: other.meal_date, sortOrder: other.sort_order || 0 }),
        updateMealEvent(other.id, { mealDate: dragged.meal_date, sortOrder: dragged.sort_order || 0 }),
      ]);
      if (a && b) {
        setMealEvents(prev => prev.map(m => {
          if (m.id === dragged.id) return { ...m, meal_date: other.meal_date, sort_order: other.sort_order || 0 };
          if (m.id === other.id) return { ...m, meal_date: dragged.meal_date, sort_order: dragged.sort_order || 0 };
          return m;
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

  const shiftWeek = (deltaDays) => {
    const d = parseLocalDate(weekStart);
    d.setDate(d.getDate() + deltaDays);
    setWeekStart(toDateString(d));
  };

  const handleAddFromFridge = async (entry, servingsToEat) => {
    const created = await createMealEvent(userId, {
      mealDate: addingTo.date,
      slot: addingTo.slot,
      cookEventId: entry.cookEvent.id,
      servingsConsumed: servingsToEat,
      sortOrder: mealsForDate(addingTo.date).length,
    });
    if (created) {
      setMealEvents([...mealEvents, created]);
      // Reload inventory to update remaining counts
      const fresh = await getFridgeInventory(userId, 10);
      setInventory(fresh);
    }
    setAddingTo(null);
  };

  /**
   * Cook option from the eat page:
   * - Already cooked: cook_event lands on the EAT date
   * - Not cooked yet: cook_event lands on the chosen cookDate
   * Either way a meal_event is created for the eat slot referencing it.
   */
  const handleAddCook = async ({ recipe, cookDate, servingsProduced, servingsEaten }) => {
    if (!addingTo) return;
    const cook = await createCookEvent(userId, {
      cookDate,
      recipeId: recipe.id,
      servingsProduced,
    });
    if (!cook) {
      Alert.alert('Error', 'Could not create the cook event.');
      return;
    }
    const meal = await createMealEvent(userId, {
      mealDate: addingTo.date,
      slot: addingTo.slot,
      cookEventId: cook.id,
      servingsConsumed: servingsEaten,
      sortOrder: mealsForDate(addingTo.date).length,
    });
    if (!meal) {
      Alert.alert('Error', 'Could not add the meal.');
    }
    setAddingTo(null);
    await load();
  };

  const handleAddTakeout = async ({ name, servingsOrdered, servingsEaten }) => {
    if (!addingTo) return;
    // Create a cook event marked as takeout for the SAME date
    const cook = await createCookEvent(userId, {
      cookDate: addingTo.date,
      isTakeout: true,
      takeoutName: name,
      servingsProduced: servingsOrdered,
    });
    if (!cook) return;
    // Then create the meal event referencing it
    const meal = await createMealEvent(userId, {
      mealDate: addingTo.date,
      slot: addingTo.slot,
      cookEventId: cook.id,
      servingsConsumed: servingsEaten,
      sortOrder: mealsForDate(addingTo.date).length,
    });
    if (meal) {
      setMealEvents([...mealEvents, meal]);
    }
    // Refresh inventory (leftovers may have appeared)
    const fresh = await getFridgeInventory(userId, 10);
    setInventory(fresh);
    setAddingTo(null);
  };

  const adjustEditServings = (delta) => {
    setEditServings(current => {
      if (delta < 0) {
        if (current <= 0.5) return 0.5;
        if (current === 1) return 0.5;
        return current - 1;
      }
      if (current === 0.5) return 1;
      return current + 1;
    });
  };

  const saveEdit = async () => {
    if (!editingMeal) return;
    const ok = await updateMealEvent(editingMeal.id, { servingsConsumed: editServings });
    if (ok) {
      setMealEvents(mealEvents.map(m =>
        m.id === editingMeal.id ? { ...m, servings_consumed: editServings } : m
      ));
      // Refresh fridge counts
      const fresh = await getFridgeInventory(userId, 10);
      setInventory(fresh);
    } else {
      Alert.alert('Error', 'Could not save changes.');
    }
    setEditingMeal(null);
  };

  const handleDeleteMeal = (mealEvent) => {
    Alert.alert(
      'Remove meal?',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteMealEvent(mealEvent.id);
            if (ok) {
              setMealEvents(mealEvents.filter(m => m.id !== mealEvent.id));
              const fresh = await getFridgeInventory(userId, 10);
              setInventory(fresh);
            }
          },
        },
      ]
    );
  };

  const renderMealItem = (m) => {
    const cook = knownCookEvents[m.cook_event_id];
    let title = 'Meal';
    let subtitle = `${m.servings_consumed} serving${m.servings_consumed !== 1 ? 's' : ''}`;
    let icon = 'restaurant';
    let recipe = null;

    if (cook) {
      if (cook.is_takeout) {
        title = cook.takeout_name || 'Takeout';
        subtitle += ' • takeout';
        icon = 'fast-food';
      } else if (cook.recipe_id) {
        recipe = findRecipe(cook.recipe_id);
        title = recipe?.title || '(deleted recipe)';
        // Days-since-cook
        const daysSince = Math.max(0, Math.floor((new Date(m.meal_date) - new Date(cook.cook_date)) / (1000 * 60 * 60 * 24)));
        subtitle += daysSince === 0 ? ' • cooked today' : daysSince === 1 ? ' • cooked yesterday' : ` • cooked ${daysSince}d ago`;
      }
    }

    const isDragSource = dragging?.id === m.id;
    const isSwapTarget = hoverKey === `mv:${m.id}`;
    const swapLabel = dragging?.meal_date === m.meal_date ? 'Swap order' : 'Swap days';

    return (
      // Wrapper carries the drop-target ref (Touchable refs aren't
      // native views; Android needs collapsable={false} to measure)
      <View key={m.id} ref={registerTarget(`mv:${m.id}`, { type: 'meal', meal: m })} collapsable={false}>
      <TouchableOpacity
        style={[
          styles.mealItem,
          isDragSource && { opacity: 0.35 },
          isSwapTarget && { borderColor: colors.accentDark, backgroundColor: colors.accentLight, borderWidth: 1 },
        ]}
        onPress={() => {
          setEditingMeal(m);
          setEditServings(Number(m.servings_consumed) || 1);
        }}
        onLongPress={(e) => startDrag(m, e.nativeEvent.pageX, e.nativeEvent.pageY)}
        delayLongPress={150}
      >
        <TouchableOpacity
          onPress={() => recipe && onOpenRecipe?.(recipe)}
          disabled={!recipe}
        >
          {recipe?.image_url ? (
            <Image source={{ uri: recipe.image_url }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name={icon} size={18} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.mealTitle} numberOfLines={1}>{isSwapTarget ? swapLabel : title}</Text>
          <Text style={styles.mealSubtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleDeleteMeal(m)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
      </View>
    );
  };

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
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          scrollEnabled={!dragging}
          scrollEventThrottle={16}
          onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
          onContentSizeChange={(_w, h) => { contentSizeRef.current.h = h; }}
          onLayout={(e) => { contentSizeRef.current.viewH = e.nativeEvent.layout.height; }}
        >
          {visibleDays.map(date => (
            <View key={date} style={styles.dayCard}>
              <Text style={styles.dayLabel}>{formatDayLabel(date)}</Text>
              {mealsForDate(date).map(renderMealItem)}
              <View ref={registerTarget(`add:${date}`, { type: 'add', date })} collapsable={false}>
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    hoverKey === `add:${date}` && { borderColor: colors.primary, borderStyle: 'solid', backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => setAddingTo({ date, slot: MEAL_SLOT })}
                >
                  <Text style={[styles.addButtonText, hoverKey === `add:${date}` && { color: colors.primary, fontWeight: '700' }]}>
                    {hoverKey === `add:${date}` ? 'Move here' : '+ Add a meal'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
          <Ionicons name="restaurant" size={14} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.dragGhostText} numberOfLines={1}>
            {(() => {
              const cook = knownCookEvents[dragging.cook_event_id];
              if (cook?.is_takeout) return cook.takeout_name || 'Takeout';
              return findRecipe(cook?.recipe_id)?.title || 'Meal';
            })()}
          </Text>
        </Animated.View>
      )}

      {/* Add Meal Picker */}
      <AddMealModal
        visible={!!addingTo}
        onClose={() => setAddingTo(null)}
        slotLabel={addingTo ? `Meal on ${formatDayLabel(addingTo.date)}` : ''}
        inventory={addingTo ? pickInventory : inventory}
        recipes={recipes}
        eatDate={addingTo?.date}
        onPickFromFridge={handleAddFromFridge}
        onAddTakeout={handleAddTakeout}
        onAddCook={handleAddCook}
      />

      {/* Week templates (shared with the Cook tab) */}
      <MealTemplatesModal
        visible={showTemplates}
        onClose={() => setShowTemplates(false)}
        userId={userId}
        weekStart={weekStart}
        recipes={recipes}
        onChanged={load}
      />

      {/* Edit Meal Modal */}
      <Modal
        visible={!!editingMeal}
        animationType="fade"
        transparent
        onRequestClose={() => setEditingMeal(null)}
      >
        <View style={styles.editOverlay}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Edit meal</Text>
            {(() => {
              const cook = editingMeal ? knownCookEvents[editingMeal.cook_event_id] : null;
              let title = 'Meal';
              if (cook) {
                if (cook.is_takeout) title = cook.takeout_name || 'Takeout';
                else if (cook.recipe_id) title = findRecipe(cook.recipe_id)?.title || 'Recipe';
              }
              return <Text style={styles.editSubtitle}>{title}</Text>;
            })()}
            <Text style={styles.editLabel}>Servings eaten</Text>
            <View style={styles.servingsRow}>
              <TouchableOpacity
                style={[styles.servingsButton, editServings <= 0.5 && { opacity: 0.4 }]}
                onPress={() => adjustEditServings(-1)}
                disabled={editServings <= 0.5}
              >
                <Text style={styles.servingsButtonText}>−</Text>
              </TouchableOpacity>
              <View style={{ alignItems: 'center', marginHorizontal: 24 }}>
                <Text style={styles.servingsCount}>{editServings}</Text>
                <Text style={styles.servingsHint}>serving{editServings !== 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity
                style={styles.servingsButton}
                onPress={() => adjustEditServings(1)}
              >
                <Text style={styles.servingsButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editDelete}
                onPress={() => {
                  const meal = editingMeal;
                  setEditingMeal(null);
                  handleDeleteMeal(meal);
                }}
              >
                <Text style={styles.editDeleteText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editCancel}
                onPress={() => setEditingMeal(null)}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSave}
                onPress={saveEdit}
              >
                <Text style={styles.editSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// -----------------------------------------------------------------------------
// Add Meal Modal - choose source (fridge, takeout, cook fresh)
// -----------------------------------------------------------------------------

/**
 * Extract the recipe's default servings (mirrors CookSchedule logic).
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

/**
 * Candidate cook days for a planned cook: today through the eat date
 * (or the week leading up to the eat date if it's already past).
 */
const buildCookDayOptions = (eatDateStr) => {
  if (!eatDateStr) return [];
  const eat = parseLocalDate(eatDateStr);
  eat.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today <= eat ? today : new Date(eat.getTime() - 6 * 86400000);
  const days = [];
  let d = new Date(start);
  while (d <= eat && days.length < 14) {
    days.push(toDateString(d));
    d = new Date(d.getTime() + 86400000);
  }
  if (days.length === 0) days.push(eatDateStr);
  return days;
};

const AddMealModal = ({ visible, onClose, slotLabel, inventory, recipes, eatDate, onPickFromFridge, onAddTakeout, onAddCook }) => {
  const [mode, setMode] = useState('choose'); // 'choose', 'fridge', 'takeout', 'cook'
  const [pickedFridgeItem, setPickedFridgeItem] = useState(null);
  const [servingsToEat, setServingsToEat] = useState(1); // numeric, using +/- buttons
  // Takeout state
  const [takeoutName, setTakeoutName] = useState('');
  const [takeoutOrdered, setTakeoutOrdered] = useState(1);
  const [takeoutEaten, setTakeoutEaten] = useState(1);
  // Cook state
  const [cookRecipe, setCookRecipe] = useState(null);
  const [cookSearch, setCookSearch] = useState('');
  const [alreadyCooked, setAlreadyCooked] = useState(null); // null = unanswered
  const [cookMultiplier, setCookMultiplier] = useState(1);
  const [cookEatServings, setCookEatServings] = useState(1);
  const [cookDay, setCookDay] = useState(null);

  useEffect(() => {
    if (!visible) {
      setMode('choose');
      setPickedFridgeItem(null);
      setServingsToEat(1);
      setTakeoutName('');
      setTakeoutOrdered(1);
      setTakeoutEaten(1);
      setCookRecipe(null);
      setCookSearch('');
      setAlreadyCooked(null);
      setCookMultiplier(1);
      setCookEatServings(1);
      setCookDay(null);
    }
  }, [visible]);

  const findRecipe = (id) => recipes.find(r => r.id === id && !r.deletedAt);

  const confirmFridge = () => {
    if (servingsToEat <= 0) return;
    const cap = pickedFridgeItem.remaining;
    if (servingsToEat > cap) {
      Alert.alert('Too many', `Only ${cap} serving(s) left.`);
      return;
    }
    onPickFromFridge(pickedFridgeItem, servingsToEat);
  };

  const confirmTakeout = () => {
    if (!takeoutName.trim()) {
      Alert.alert('Missing name', 'Enter a name for the takeout (e.g., "Pizza Hut").');
      return;
    }
    if (takeoutOrdered <= 0) {
      Alert.alert('Invalid', 'Ordered servings must be greater than zero.');
      return;
    }
    if (takeoutEaten <= 0) {
      Alert.alert('Invalid', 'Eaten servings must be greater than zero.');
      return;
    }
    if (takeoutEaten > takeoutOrdered) {
      Alert.alert('Invalid', 'Servings eaten cannot exceed servings ordered.');
      return;
    }
    onAddTakeout({ name: takeoutName.trim(), servingsOrdered: takeoutOrdered, servingsEaten: takeoutEaten });
  };

  const adjustMultiplier = (delta) => {
    setCookMultiplier(current => {
      if (delta < 0) {
        if (current <= 0.5) return 0.5;
        if (current === 1) return 0.5;
        return current - 1;
      }
      if (current === 0.5) return 1;
      return current + 1;
    });
  };

  const confirmCook = () => {
    if (!cookRecipe) return;
    const base = getBaseServings(cookRecipe);
    const produced = base * cookMultiplier;
    if (cookEatServings > produced) {
      Alert.alert('Too many', `You're only making ${produced} serving${produced !== 1 ? 's' : ''}.`);
      return;
    }
    const cookDate = alreadyCooked ? eatDate : (cookDay || eatDate);
    onAddCook({
      recipe: cookRecipe,
      cookDate,
      servingsProduced: produced,
      servingsEaten: cookEatServings,
    });
  };

  const adjustServings = (setter, current, delta, min = 0.5) => {
    let next;
    if (delta < 0) {
      if (current <= 0.5) next = 0.5;
      else if (current === 1) next = 0.5;
      else next = current - 1;
    } else {
      if (current === 0.5) next = 1;
      else next = current + 1;
    }
    setter(Math.max(min, next));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerAction}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{slotLabel}</Text>
          <View style={{ width: 60 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {mode === 'choose' && !pickedFridgeItem && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* What's (or will be) in the fridge that day comes first -
                  it's the most likely pick and saves a tap */}
              <Text style={styles.chooseHelp}>In the fridge that day:</Text>
              {inventory.length === 0 ? (
                <Text style={{ padding: 20, color: colors.textSecondary, textAlign: 'center' }}>
                  Nothing will be in the fridge that day.
                </Text>
              ) : (
                inventory.map(entry => {
                  const cook = entry.cookEvent;
                  const recipe = !cook.is_takeout ? findRecipe(cook.recipe_id) : null;
                  const title = cook.is_takeout ? (cook.takeout_name || 'Takeout') : (recipe?.title || 'Unknown');
                  return (
                    <TouchableOpacity
                      key={cook.id}
                      style={styles.fridgeItem}
                      onPress={() => {
                        setPickedFridgeItem(entry);
                        setServingsToEat('1');
                      }}
                    >
                      {recipe?.image_url ? (
                        <Image source={{ uri: recipe.image_url }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Ionicons name={cook.is_takeout ? 'fast-food' : 'restaurant'} size={18} color={colors.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealTitle}>{title}</Text>
                        {(() => {
                          // Age AS OF the date being planned, not today -
                          // eating Wednesday what was cooked Monday is 2d old
                          const ageAtEat = eatDate
                            ? Math.round((parseLocalDate(eatDate) - parseLocalDate(cook.cook_date)) / 86400000)
                            : entry.daysOld;
                          const ageText = ageAtEat <= 0
                            ? 'cooked that day'
                            : `will be ${ageAtEat}d old`;
                          return (
                            <Text style={[styles.mealSubtitle, entry.isPlanned && { color: colors.primary, fontWeight: '600' }]}>
                              {entry.remaining} serving{entry.remaining !== 1 ? 's' : ''} {entry.isPlanned ? 'planned' : 'left'} • {entry.isPlanned
                                ? `cooking ${formatDayLabel(cook.cook_date)}${ageAtEat > 0 ? ` (${ageAtEat}d old by then)` : ''}`
                                : ageText}
                            </Text>
                          );
                        })()}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              <Text style={[styles.chooseHelp, { marginTop: 20 }]}>Or something new:</Text>

              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => setMode('cook')}
              >
                <Ionicons name="flame" size={22} color={colors.primary} style={styles.optionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Cook a Recipe</Text>
                  <Text style={styles.optionSubtitle}>
                    Already made, or schedule it on the cook plan
                  </Text>
                </View>
                <Text style={styles.optionArrow}>{'>'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => setMode('takeout')}
              >
                <Ionicons name="fast-food" size={22} color={colors.primary} style={styles.optionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Take Out</Text>
                  <Text style={styles.optionSubtitle}>
                    Add a takeout meal; leftovers go to fridge
                  </Text>
                </View>
                <Text style={styles.optionArrow}>{'>'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {mode === 'cook' && !cookRecipe && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TouchableOpacity onPress={() => setMode('choose')}>
                <Text style={styles.backLink}>{'< Back'}</Text>
              </TouchableOpacity>
              <Text style={styles.chooseHelp}>Pick a recipe to cook:</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Search recipes..."
                placeholderTextColor={colors.textSecondary}
                value={cookSearch}
                onChangeText={setCookSearch}
              />
              <View style={{ marginTop: 12 }}>
                {recipes
                  .filter(r => !r.deletedAt)
                  .filter(r => !cookSearch.trim() || (r.title || '').toLowerCase().includes(cookSearch.trim().toLowerCase()))
                  .map(recipe => (
                    <TouchableOpacity
                      key={recipe.id}
                      style={styles.fridgeItem}
                      onPress={() => {
                        setCookRecipe(recipe);
                        setCookMultiplier(1);
                        setCookEatServings(1);
                        setCookDay(eatDate);
                        setAlreadyCooked(null);
                      }}
                    >
                      {recipe.image_url ? (
                        <Image source={{ uri: recipe.image_url }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Ionicons name="restaurant" size={18} color={colors.primary} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealTitle} numberOfLines={1}>{recipe.title}</Text>
                        <Text style={styles.mealSubtitle}>
                          Makes {getBaseServings(recipe)} serving{getBaseServings(recipe) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
          )}

          {mode === 'cook' && cookRecipe && alreadyCooked === null && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TouchableOpacity onPress={() => setCookRecipe(null)}>
                <Text style={styles.backLink}>{'< Back'}</Text>
              </TouchableOpacity>
              <Text style={styles.chooseHelp}>{cookRecipe.title}</Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>
                Is this already cooked?
              </Text>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => setAlreadyCooked(true)}
              >
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={styles.optionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Yes, it's made</Text>
                  <Text style={styles.optionSubtitle}>
                    Logs the cook on this day; leftovers go to the fridge
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => setAlreadyCooked(false)}
              >
                <Ionicons name="calendar" size={22} color={colors.primary} style={styles.optionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>Not yet - schedule it</Text>
                  <Text style={styles.optionSubtitle}>
                    Pick a day and it's added to your Cook plan
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          )}

          {mode === 'cook' && cookRecipe && alreadyCooked !== null && (() => {
            const base = getBaseServings(cookRecipe);
            const produced = base * cookMultiplier;
            const dayOptions = buildCookDayOptions(eatDate);
            return (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <TouchableOpacity onPress={() => setAlreadyCooked(null)}>
                  <Text style={styles.backLink}>{'< Back'}</Text>
                </TouchableOpacity>
                <Text style={styles.chooseHelp}>{cookRecipe.title}</Text>

                {!alreadyCooked && (
                  <>
                    <Text style={styles.inputLabel}>Cook on which day?</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                      {dayOptions.map(day => {
                        const active = day === (cookDay || eatDate);
                        return (
                          <TouchableOpacity
                            key={day}
                            style={[styles.dayChip, active && styles.dayChipActive]}
                            onPress={() => setCookDay(day)}
                          >
                            <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                              {formatDayLabel(day)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                )}

                <Text style={styles.inputLabel}>
                  Batch size (recipe makes {base} serving{base !== 1 ? 's' : ''})
                </Text>
                <View style={styles.servingsRow}>
                  <TouchableOpacity
                    style={[styles.servingsButton, cookMultiplier <= 0.5 && { opacity: 0.4 }]}
                    onPress={() => adjustMultiplier(-1)}
                    disabled={cookMultiplier <= 0.5}
                  >
                    <Text style={styles.servingsButtonText}>−</Text>
                  </TouchableOpacity>
                  <View style={{ alignItems: 'center', marginHorizontal: 24 }}>
                    <Text style={styles.servingsCount}>{cookMultiplier}x</Text>
                    <Text style={styles.servingsHint}>= {produced} serving{produced !== 1 ? 's' : ''}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.servingsButton}
                    onPress={() => adjustMultiplier(1)}
                  >
                    <Text style={styles.servingsButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Servings to eat at this meal</Text>
                <View style={styles.servingsRow}>
                  <TouchableOpacity
                    style={[styles.servingsButton, cookEatServings <= 0.5 && { opacity: 0.4 }]}
                    onPress={() => adjustServings(setCookEatServings, cookEatServings, -1)}
                    disabled={cookEatServings <= 0.5}
                  >
                    <Text style={styles.servingsButtonText}>−</Text>
                  </TouchableOpacity>
                  <View style={{ alignItems: 'center', marginHorizontal: 24 }}>
                    <Text style={styles.servingsCount}>{cookEatServings}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.servingsButton, cookEatServings >= produced && { opacity: 0.4 }]}
                    onPress={() => adjustServings(setCookEatServings, cookEatServings, 1)}
                    disabled={cookEatServings >= produced}
                  >
                    <Text style={styles.servingsButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.helper}>
                  {alreadyCooked
                    ? `Cook is logged for this day. ${produced - cookEatServings} serving${produced - cookEatServings !== 1 ? 's' : ''} will be in the fridge.`
                    : `Added to the Cook plan on ${cookDay ? formatDayLabel(cookDay) : formatDayLabel(eatDate)}. Leftovers go to the fridge after cooking.`}
                </Text>

                <TouchableOpacity style={styles.primaryButton} onPress={confirmCook}>
                  <Text style={styles.primaryButtonText}>Add to Plan</Text>
                </TouchableOpacity>
              </ScrollView>
            );
          })()}

          {pickedFridgeItem && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TouchableOpacity onPress={() => setPickedFridgeItem(null)}>
                <Text style={styles.backLink}>{'< Back'}</Text>
              </TouchableOpacity>
              <Text style={styles.chooseHelp}>How many servings will you eat?</Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 16, textAlign: 'center' }}>
                {pickedFridgeItem.remaining} serving{pickedFridgeItem.remaining !== 1 ? 's' : ''} available
              </Text>
              <View style={styles.servingsRow}>
                <TouchableOpacity
                  style={[styles.servingsButton, servingsToEat <= 0.5 && { opacity: 0.4 }]}
                  onPress={() => adjustServings(setServingsToEat, servingsToEat, -1)}
                  disabled={servingsToEat <= 0.5}
                >
                  <Text style={styles.servingsButtonText}>−</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center', marginHorizontal: 24 }}>
                  <Text style={styles.servingsCount}>{servingsToEat}</Text>
                  <Text style={styles.servingsHint}>serving{servingsToEat !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.servingsButton, servingsToEat >= pickedFridgeItem.remaining && { opacity: 0.4 }]}
                  onPress={() => adjustServings(setServingsToEat, servingsToEat, 1)}
                  disabled={servingsToEat >= pickedFridgeItem.remaining}
                >
                  <Text style={styles.servingsButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={confirmFridge}>
                <Text style={styles.primaryButtonText}>Add Meal</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {mode === 'takeout' && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TouchableOpacity onPress={() => setMode('choose')}>
                <Text style={styles.backLink}>{'< Back'}</Text>
              </TouchableOpacity>
              <Text style={styles.chooseHelp}>Add takeout meal</Text>

              <Text style={styles.inputLabel}>Name (e.g., "Pizza Hut", "Sushi Bar")</Text>
              <TextInput
                style={styles.textInput}
                value={takeoutName}
                onChangeText={setTakeoutName}
                placeholder="Takeout name"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.inputLabel}>Servings ordered</Text>
              <View style={styles.servingsRow}>
                <TouchableOpacity
                  style={[styles.servingsButton, takeoutOrdered <= 0.5 && { opacity: 0.4 }]}
                  onPress={() => adjustServings(setTakeoutOrdered, takeoutOrdered, -1)}
                  disabled={takeoutOrdered <= 0.5}
                >
                  <Text style={styles.servingsButtonText}>−</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center', marginHorizontal: 24 }}>
                  <Text style={styles.servingsCount}>{takeoutOrdered}</Text>
                </View>
                <TouchableOpacity
                  style={styles.servingsButton}
                  onPress={() => adjustServings(setTakeoutOrdered, takeoutOrdered, 1)}
                >
                  <Text style={styles.servingsButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Servings eaten now</Text>
              <View style={styles.servingsRow}>
                <TouchableOpacity
                  style={[styles.servingsButton, takeoutEaten <= 0.5 && { opacity: 0.4 }]}
                  onPress={() => adjustServings(setTakeoutEaten, takeoutEaten, -1)}
                  disabled={takeoutEaten <= 0.5}
                >
                  <Text style={styles.servingsButtonText}>−</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center', marginHorizontal: 24 }}>
                  <Text style={styles.servingsCount}>{takeoutEaten}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.servingsButton, takeoutEaten >= takeoutOrdered && { opacity: 0.4 }]}
                  onPress={() => adjustServings(setTakeoutEaten, takeoutEaten, 1)}
                  disabled={takeoutEaten >= takeoutOrdered}
                >
                  <Text style={styles.servingsButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helper}>
                Any leftovers ({takeoutOrdered - takeoutEaten} serving{takeoutOrdered - takeoutEaten !== 1 ? 's' : ''}) will appear in your fridge as takeout.
              </Text>

              <TouchableOpacity style={styles.primaryButton} onPress={confirmTakeout}>
                <Text style={styles.primaryButtonText}>Add Takeout Meal</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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

  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayLabel: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 12 },
  slot: { marginBottom: 12 },
  slotHeader: { marginBottom: 6 },
  slotLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotLabel: { fontSize: 13, fontWeight: '600', color: colors.text },

  mealItem: {
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
  thumbPlaceholder: { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  mealTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  mealSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error || '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: -2 },

  addButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addButtonText: { fontSize: 12, color: colors.textSecondary },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: colors.primary,
  },
  headerAction: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  chooseHelp: { fontSize: 14, color: colors.text, marginBottom: 12, marginTop: 8, fontWeight: '600' },
  backLink: { fontSize: 14, color: colors.primary, marginBottom: 12, fontWeight: '600' },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: { marginRight: 10 },
  optionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  optionSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  optionArrow: { fontSize: 20, color: colors.textSecondary },

  fridgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  numberInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    width: 100,
  },
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
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayChipText: { fontSize: 13, color: colors.text },
  dayChipTextActive: { color: '#fff', fontWeight: '600' },

  // Edit meal modal
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  editCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  editTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  editSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  editLabel: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
  editActions: { flexDirection: 'row', gap: 8 },
  editDelete: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error || '#e74c3c',
    alignItems: 'center',
  },
  editDeleteText: { color: colors.error || '#e74c3c', fontSize: 14, fontWeight: '600' },
  editCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  editCancelText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  editSave: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  editSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  helper: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default EatSchedule;

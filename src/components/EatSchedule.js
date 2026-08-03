/**
 * FILENAME: src/components/EatSchedule.js
 * PURPOSE: Weekly meal calendar. Assign meals from fridge (leftovers) or add takeout.
 *
 * Slots: breakfast, lunch, dinner (per day).
 * Add meal options:
 *   - From Fridge: pick a cooked item, choose servings to eat
 *   - Take Out: enter takeout name + servings ordered/eaten (leftovers → fridge)
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
  KeyboardAvoidingView,
  Platform,
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
} from '../services/supabase/kitchen';

const SLOTS = [
  { key: 'breakfast', label: 'Breakfast', icon: 'egg-outline' },
  { key: 'lunch',     label: 'Lunch',     icon: 'fast-food-outline' },
  { key: 'dinner',    label: 'Dinner',    icon: 'restaurant-outline' },
];

const EatSchedule = ({ userId, recipes = [], onOpenRecipe }) => {
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [mealEvents, setMealEvents] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [allCookEvents, setAllCookEvents] = useState([]); // For display lookup, includes empty-fridge items
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState(null); // { date, slot }
  const [editingMeal, setEditingMeal] = useState(null); // meal_event being edited
  const [editServings, setEditServings] = useState(1);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekEnd = weekDays[6];

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Look back further for cook events to make sure we can display meals
      // that reference older (now-depleted) cook events
      const lookbackDate = new Date(weekStart);
      lookbackDate.setDate(lookbackDate.getDate() - 14);
      const lookbackStr = lookbackDate.toISOString().split('T')[0];

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

  const mealsForSlot = (date, slot) =>
    mealEvents.filter(m => m.meal_date === date && m.slot === slot);

  const shiftWeek = (deltaDays) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const handleAddFromFridge = async (entry, servingsToEat) => {
    const created = await createMealEvent(userId, {
      mealDate: addingTo.date,
      slot: addingTo.slot,
      cookEventId: entry.cookEvent.id,
      servingsConsumed: servingsToEat,
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

    return (
      <TouchableOpacity
        key={m.id}
        style={styles.mealItem}
        onPress={() => recipe && onOpenRecipe?.(recipe)}
        onLongPress={() => {
          setEditingMeal(m);
          setEditServings(Number(m.servings_consumed) || 1);
        }}
        delayLongPress={400}
      >
        {recipe?.image_url ? (
          <Image source={{ uri: recipe.image_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.mealTitle} numberOfLines={1}>{title}</Text>
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
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          {weekDays.map(date => (
            <View key={date} style={styles.dayCard}>
              <Text style={styles.dayLabel}>{formatDayLabel(date)}</Text>
              {SLOTS.map(slot => (
                <View key={slot.key} style={styles.slot}>
                  <View style={styles.slotHeader}>
                    <View style={styles.slotLabelRow}>
                <Ionicons name={slot.icon} size={15} color={colors.text} style={{ marginRight: 5 }} />
                <Text style={styles.slotLabel}>{slot.label}</Text>
              </View>
                  </View>
                  {mealsForSlot(date, slot.key).map(renderMealItem)}
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setAddingTo({ date, slot: slot.key })}
                  >
                    <Text style={styles.addButtonText}>+ Add meal</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Meal Picker */}
      <AddMealModal
        visible={!!addingTo}
        onClose={() => setAddingTo(null)}
        slotLabel={addingTo ? `${SLOTS.find(s => s.key === addingTo.slot)?.label} on ${formatDayLabel(addingTo.date)}` : ''}
        inventory={inventory}
        recipes={recipes}
        eatDate={addingTo?.date}
        onPickFromFridge={handleAddFromFridge}
        onAddTakeout={handleAddTakeout}
        onAddCook={handleAddCook}
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
  const eat = new Date(eatDateStr);
  eat.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today <= eat ? today : new Date(eat.getTime() - 6 * 86400000);
  const days = [];
  let d = new Date(start);
  while (d <= eat && days.length < 14) {
    days.push(d.toISOString().split('T')[0]);
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
          {mode === 'choose' && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.chooseHelp}>How are you eating this meal?</Text>

              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => setMode('fridge')}
              >
                <Ionicons name="fast-food" size={22} color={colors.primary} style={styles.optionIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>From Fridge</Text>
                  <Text style={styles.optionSubtitle}>
                    {inventory.length === 0 ? 'Nothing cooked yet' : `${inventory.length} item${inventory.length !== 1 ? 's' : ''} available`}
                  </Text>
                </View>
                <Text style={styles.optionArrow}>{'>'}</Text>
              </TouchableOpacity>

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

          {mode === 'fridge' && !pickedFridgeItem && (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TouchableOpacity onPress={() => setMode('choose')}>
                <Text style={styles.backLink}>{'< Back'}</Text>
              </TouchableOpacity>
              <Text style={styles.chooseHelp}>Pick from fridge:</Text>
              {inventory.length === 0 ? (
                <Text style={{ padding: 20, color: colors.textSecondary, textAlign: 'center' }}>
                  Nothing in the fridge yet. Cook something first.
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
                        <Text style={styles.mealSubtitle}>
                          {entry.remaining} serving{entry.remaining !== 1 ? 's' : ''} left • cooked {entry.daysOld === 0 ? 'today' : entry.daysOld === 1 ? 'yesterday' : `${entry.daysOld}d ago`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          {mode === 'fridge' && pickedFridgeItem && (
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

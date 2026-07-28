/**
 * FILENAME: src/services/supabase/kitchen.js
 * PURPOSE: Cook events, meal events, and fridge inventory management.
 *
 * Data model:
 *   cook_events: when + what the user cooks (with servings_produced)
 *   meal_events: when + what the user eats (references a cook_event, servings_consumed)
 *   fridge_adjustments: manual overrides (spoiled, gave away, snacked)
 *
 * Fridge inventory is computed:
 *   remaining = servings_produced
 *             - SUM(meal_events.servings_consumed)
 *             - SUM(fridge_adjustments.servings)
 */

import { supabase } from './config';

// -----------------------------------------------------------------------------
// Cook Events
// -----------------------------------------------------------------------------

export const getCookEvents = async (userId, startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('cook_events')
      .select('*')
      .eq('user_id', userId)
      .gte('cook_date', startDate)
      .lte('cook_date', endDate)
      .order('cook_date', { ascending: true });

    if (error) {
      console.error('❌ getCookEvents error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('❌ getCookEvents error:', err);
    return [];
  }
};

export const createCookEvent = async (userId, { cookDate, recipeId, servingsProduced, notes }) => {
  try {
    const { data, error } = await supabase
      .from('cook_events')
      .insert({
        user_id: userId,
        cook_date: cookDate,
        recipe_id: recipeId,
        servings_produced: servingsProduced || 1,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ createCookEvent error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('❌ createCookEvent error:', err);
    return null;
  }
};

export const updateCookEvent = async (cookEventId, patch) => {
  try {
    const dbPatch = {};
    if (patch.cookDate !== undefined) dbPatch.cook_date = patch.cookDate;
    if (patch.servingsProduced !== undefined) dbPatch.servings_produced = patch.servingsProduced;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;

    const { error } = await supabase
      .from('cook_events')
      .update(dbPatch)
      .eq('id', cookEventId);

    if (error) {
      console.error('❌ updateCookEvent error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ updateCookEvent error:', err);
    return false;
  }
};

export const deleteCookEvent = async (cookEventId) => {
  try {
    const { error } = await supabase
      .from('cook_events')
      .delete()
      .eq('id', cookEventId);

    if (error) {
      console.error('❌ deleteCookEvent error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ deleteCookEvent error:', err);
    return false;
  }
};

// -----------------------------------------------------------------------------
// Meal Events
// -----------------------------------------------------------------------------

export const getMealEvents = async (userId, startDate, endDate) => {
  try {
    const { data, error } = await supabase
      .from('meal_events')
      .select('*')
      .eq('user_id', userId)
      .gte('meal_date', startDate)
      .lte('meal_date', endDate)
      .order('meal_date', { ascending: true });

    if (error) {
      console.error('❌ getMealEvents error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('❌ getMealEvents error:', err);
    return [];
  }
};

export const createMealEvent = async (userId, { mealDate, slot, cookEventId, servingsConsumed }) => {
  try {
    const { data, error } = await supabase
      .from('meal_events')
      .insert({
        user_id: userId,
        meal_date: mealDate,
        slot,
        cook_event_id: cookEventId,
        servings_consumed: servingsConsumed || 1,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ createMealEvent error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('❌ createMealEvent error:', err);
    return null;
  }
};

export const deleteMealEvent = async (mealEventId) => {
  try {
    const { error } = await supabase
      .from('meal_events')
      .delete()
      .eq('id', mealEventId);
    if (error) {
      console.error('❌ deleteMealEvent error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ deleteMealEvent error:', err);
    return false;
  }
};

// -----------------------------------------------------------------------------
// Fridge Adjustments
// -----------------------------------------------------------------------------

export const createFridgeAdjustment = async (userId, { cookEventId, adjustmentType, servings, note }) => {
  try {
    const { error } = await supabase
      .from('fridge_adjustments')
      .insert({
        user_id: userId,
        cook_event_id: cookEventId,
        adjustment_type: adjustmentType,
        servings,
        note: note || null,
      });

    if (error) {
      console.error('❌ createFridgeAdjustment error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ createFridgeAdjustment error:', err);
    return false;
  }
};

// -----------------------------------------------------------------------------
// Fridge Inventory (computed)
// -----------------------------------------------------------------------------

/**
 * Get the current fridge inventory - all cook events with servings remaining.
 * Returns array of: {cookEvent, remaining, daysOld, mealEventsCount}
 */
export const getFridgeInventory = async (userId, lookbackDays = 10) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Fetch all cook events in window
    const { data: cookEvents, error: cookErr } = await supabase
      .from('cook_events')
      .select('*')
      .eq('user_id', userId)
      .gte('cook_date', startDateStr)
      .order('cook_date', { ascending: false });

    if (cookErr || !cookEvents) return [];
    if (cookEvents.length === 0) return [];

    const cookEventIds = cookEvents.map(c => c.id);

    // Fetch meal events referencing these cook events
    const { data: mealEvents } = await supabase
      .from('meal_events')
      .select('cook_event_id, servings_consumed')
      .in('cook_event_id', cookEventIds);

    // Fetch fridge adjustments referencing these cook events
    const { data: adjustments } = await supabase
      .from('fridge_adjustments')
      .select('cook_event_id, servings')
      .in('cook_event_id', cookEventIds);

    // Group by cook_event_id
    const consumedByCook = {};
    (mealEvents || []).forEach(m => {
      consumedByCook[m.cook_event_id] = (consumedByCook[m.cook_event_id] || 0) + Number(m.servings_consumed);
    });
    const adjustedByCook = {};
    (adjustments || []).forEach(a => {
      adjustedByCook[a.cook_event_id] = (adjustedByCook[a.cook_event_id] || 0) + Number(a.servings);
    });

    const now = new Date();
    return cookEvents
      .map(cook => {
        const produced = Number(cook.servings_produced);
        const consumed = consumedByCook[cook.id] || 0;
        const adjusted = adjustedByCook[cook.id] || 0;
        const remaining = produced - consumed - adjusted;
        const cookDate = new Date(cook.cook_date);
        const daysOld = Math.floor((now - cookDate) / (1000 * 60 * 60 * 24));
        return {
          cookEvent: cook,
          remaining,
          consumed,
          adjusted,
          daysOld,
        };
      })
      .filter(entry => entry.remaining > 0);
  } catch (err) {
    console.error('❌ getFridgeInventory error:', err);
    return [];
  }
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Get the Monday of the week containing the given date (ISO format)
 */
export const getWeekStart = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

/**
 * Get an array of 7 date strings for a given week start
 */
export const getWeekDays = (weekStartStr) => {
  const start = new Date(weekStartStr);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
};

export const formatDayLabel = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`;
};

export default {
  getCookEvents,
  createCookEvent,
  updateCookEvent,
  deleteCookEvent,
  getMealEvents,
  createMealEvent,
  deleteMealEvent,
  createFridgeAdjustment,
  getFridgeInventory,
  getWeekStart,
  getWeekDays,
  formatDayLabel,
};

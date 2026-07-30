/**
 * FILENAME: src/services/supabase/dietary.js
 * PURPOSE: Load/save the user's dietary preferences on user_profiles.
 *
 * Shape stored in user_profiles.dietary_preferences (jsonb):
 *   { diets: ['vegetarian', ...], avoid: ['dairy', 'tree_nuts', ...] }
 * Keys come from DIETS / ALLERGENS in src/utils/dietaryAnalysis.js.
 */

import { supabase } from './config';

const EMPTY_PREFS = { diets: [], avoid: [] };

export const loadDietaryPreferences = async (userId) => {
  if (!userId) return EMPTY_PREFS;
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('dietary_preferences')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const prefs = data?.dietary_preferences || {};
    return {
      diets: Array.isArray(prefs.diets) ? prefs.diets : [],
      avoid: Array.isArray(prefs.avoid) ? prefs.avoid : [],
    };
  } catch (error) {
    console.error('❌ Error loading dietary preferences:', error);
    return EMPTY_PREFS;
  }
};

export const saveDietaryPreferences = async (userId, prefs) => {
  if (!userId) return false;
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        dietary_preferences: {
          diets: prefs?.diets || [],
          avoid: prefs?.avoid || [],
        },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw error;

    console.log('✅ Saved dietary preferences');
    return true;
  } catch (error) {
    console.error('❌ Error saving dietary preferences:', error);
    return false;
  }
};

export default { loadDietaryPreferences, saveDietaryPreferences };

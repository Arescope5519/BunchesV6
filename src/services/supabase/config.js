/**
 * Supabase Configuration
 *
 * To get your credentials:
 * 1. Go to https://supabase.com and create a project
 * 2. Go to Project Settings > API
 * 3. Copy the Project URL and anon/public key
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace with your Supabase project credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Create Supabase client with AsyncStorage for session persistence
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

console.log('🔷 [SUPABASE] Client initialized');

export { SUPABASE_URL, SUPABASE_ANON_KEY };

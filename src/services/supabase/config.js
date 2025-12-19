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

// Supabase credentials
const SUPABASE_URL = 'https://azdhiunzwslogbaiwtgi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9bZ28FxZyT0G5T6_nM8GCg_qyyFVsEc';

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

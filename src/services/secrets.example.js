/**
 * FILENAME: src/services/secrets.example.js
 * PURPOSE: Template for local secrets (currently unused - kept for future use)
 *
 * As of the Edge Function migration, API keys for Sightengine and OpenAI
 * live in Supabase env vars, NOT in this file. See EDGE_FUNCTIONS_SETUP.md.
 *
 * This file remains as a template in case you add future keys that must
 * live client-side.
 *
 * SETUP:
 *   1. Copy this file to src/services/secrets.js
 *   2. Fill in any client-side-only keys (rare - most keys should be in Supabase)
 *   3. secrets.js is gitignored so it will not be committed
 */

export const SECRETS = {
  // No client-side keys needed at the moment.
  // Sightengine + OpenAI keys are now stored in Supabase env vars
  // and accessed via Edge Functions.
};

export default SECRETS;

/**
 * FILENAME: src/services/secrets.example.js
 * PURPOSE: Template for API keys - copy to secrets.js (which is gitignored)
 *
 * SETUP:
 *   1. Copy this file to src/services/secrets.js
 *   2. Fill in your actual API keys in secrets.js
 *   3. secrets.js is gitignored so you'll never commit it
 *
 * NEVER put real API keys in this file - only the template.
 */

export const SECRETS = {
  // OpenAI - https://platform.openai.com/api-keys
  OPENAI_API_KEY: '',

  // Sightengine - https://dashboard.sightengine.com/api-credentials
  SIGHTENGINE_API_USER: '',
  SIGHTENGINE_API_SECRET: '',
};

export default SECRETS;

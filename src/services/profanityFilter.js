/**
 * FILENAME: src/services/profanityFilter.js
 * PURPOSE: Text profanity filtering for recipe titles, usernames, cookbook names, etc.
 *
 * Uses a curated wordlist. Add to CUSTOM_ADDITIONS to block more words,
 * or add to ALLOWED_EXCEPTIONS to whitelist food-related words that
 * would otherwise get flagged.
 */

// Base list of profanity/slurs/inappropriate words
const BASE_WORDS = [
  // Sexual/explicit
  'anal', 'anus', 'ass', 'asshole', 'blowjob', 'boob', 'boobs', 'clit',
  'cock', 'cocksucker', 'cum', 'cunt', 'dick', 'dildo', 'dyke',
  'ejaculate', 'erection', 'fag', 'faggot', 'fisting', 'fuck', 'fucker',
  'fucking', 'handjob', 'hentai', 'horny', 'jerkoff', 'jizz', 'labia',
  'masturbate', 'milf', 'motherfucker', 'nigga', 'nigger', 'nude',
  'orgasm', 'orgy', 'pedo', 'pedophile', 'penis', 'porn', 'porno',
  'pornography', 'pussy', 'queef', 'rape', 'rapist', 'retard', 'retarded',
  'rimjob', 'scrotum', 'semen', 'sex', 'sexy', 'slut', 'sperm', 'suck',
  'testicle', 'tit', 'tits', 'twat', 'vagina', 'whore',
  // Profanity
  'bastard', 'bitch', 'bullshit', 'crap', 'damn', 'douche', 'douchebag',
  'fag', 'goddamn', 'jackass', 'piss', 'shit', 'shithead', 'shitty',
  'sonofabitch',
  // Slurs (partial - keep list conservative)
  'chink', 'gook', 'kike', 'kyke', 'spic', 'tranny', 'wetback',
];

// Custom additions - add app-specific blocked words here
const CUSTOM_ADDITIONS = [
  // e.g., 'brandname', 'inappropriate_term'
];

// Exceptions - words that would trigger but should be allowed
// (e.g., cooking terms that overlap with profanity)
const ALLOWED_EXCEPTIONS = [
  'assam',       // Assam tea/curry
  'assortment',
  'assorted',
  'bass',        // Fish
  'passage',
  'assistant',
  'grass',
  'brass',
  'class',
  'glass',
  'pass',
  'mass',
  'crass',
];

// Multi-word phrases to block (matched as substrings, case-insensitive)
// These catch things like "kill yourself" that OpenAI might miss due to context
const BLOCKED_PHRASES = [
  'kill yourself',
  'kill your self',
  'kys',
  'kill myself',
  'kill me',
  'commit suicide',
  'commit su1c1de',
  'end my life',
  'end your life',
  'off yourself',
  'off myself',
  'hang yourself',
  'hang myself',
  'shoot yourself',
  'shoot up',
  'die in a fire',
  'kill children',
  'kill kids',
  'child porn',
  'child p0rn',
  'kill people',
  'murder',
];

// Build final word set
const BLOCKED_WORDS = new Set(
  [...BASE_WORDS, ...CUSTOM_ADDITIONS].map(w => w.toLowerCase())
);
const EXCEPTIONS = new Set(ALLOWED_EXCEPTIONS.map(w => w.toLowerCase()));

// Precompile phrase regex for efficiency
const PHRASE_REGEX = BLOCKED_PHRASES.length > 0
  ? new RegExp(
      BLOCKED_PHRASES
        .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
        .join('|'),
      'i'
    )
  : null;

/**
 * Check for blocked phrases (multi-word patterns)
 */
const containsBlockedPhrase = (text) => {
  if (!text || !PHRASE_REGEX) return false;
  return PHRASE_REGEX.test(String(text));
};

/**
 * Normalize a token - strip punctuation, convert leet-speak
 */
const normalizeToken = (token) => {
  let t = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Simple leet-speak substitutions
  t = t
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
  return t;
};

/**
 * Split text into individual word tokens
 */
const tokenize = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text.split(/[\s\-_.,;:!?()"'/\\|]+/).filter(Boolean);
};

/**
 * Check if a single normalized token is blocked
 */
const isTokenBlocked = (token) => {
  if (!token || token.length < 3) return false;
  if (EXCEPTIONS.has(token)) return false;
  return BLOCKED_WORDS.has(token);
};

/**
 * Check if text contains profanity
 * @param {string} text
 * @returns {boolean}
 */
export const containsProfanity = (text) => {
  if (!text) return false;

  // Check multi-word phrases first
  if (containsBlockedPhrase(text)) return true;

  const tokens = tokenize(String(text));
  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (isTokenBlocked(normalized)) {
      return true;
    }
    // Also check without leet-speak substitution (some words have letters
    // that would get subbed away, e.g. testing raw form)
    const rawLower = token.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (rawLower !== normalized && isTokenBlocked(rawLower)) {
      return true;
    }
  }
  return false;
};

/**
 * Find the first offending word in text (for user feedback)
 * @param {string} text
 * @returns {string|null}
 */
export const findProfanity = (text) => {
  if (!text) return null;

  // Check multi-word phrases first
  if (containsBlockedPhrase(text)) {
    const match = String(text).match(PHRASE_REGEX);
    return match ? match[0] : 'inappropriate phrase';
  }

  const tokens = tokenize(String(text));
  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (isTokenBlocked(normalized)) return token;
    const rawLower = token.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (rawLower !== normalized && isTokenBlocked(rawLower)) return token;
  }
  return null;
};

/**
 * Terms severe enough to block even when buried inside a longer string.
 *
 * Usernames have no spaces, so tokenising cannot pull a word out of
 * "shitcook" - it is one token, and the wordlist check is exact-match.
 * Substring matching fixes that, but it is dangerous by default (the
 * Scunthorpe problem), so this list is deliberately short: only terms
 * that are severe AND rarely appear inside innocent words.
 *
 * Deliberately NOT here, because a recipe app would trip over them:
 * ass (assam, assorted), cock (cocktail), tit (title), rape (grape),
 * spic (spicy), rapist (therapist).
 */
const IDENTIFIER_SUBSTRINGS = [
  'fuck', 'bitch', 'cunt', 'whore', 'slut', 'porn',
  'penis', 'vagina', 'dildo', 'blowjob', 'handjob', 'rimjob',
  'nigger', 'nigga', 'faggot', 'kike', 'gook', 'wetback', 'tranny',
  'molest', 'pedo', 'paedo', 'shit',
];

/**
 * Innocent words that contain one of the above. Removed before the
 * substring scan so a real place or ingredient name is not blocked.
 */
const IDENTIFIER_ALLOWED = ['scunthorpe', 'penistone'];

/**
 * Profanity check for identifiers - usernames and anything else with no
 * separators to tokenise on. Returns the matched term, or null.
 */
export const findIdentifierProfanity = (text) => {
  if (!text) return null;
  let t = normalizeToken(String(text));
  for (const allowed of IDENTIFIER_ALLOWED) {
    t = t.split(allowed).join('');
  }
  for (const bad of IDENTIFIER_SUBSTRINGS) {
    if (t.includes(bad)) return bad;
  }
  return null;
};

/**
 * Full username check: the substring pass above, then the normal
 * two-stage wordlist + OpenAI check.
 * @param {string} username
 * @returns {Promise<{safe: boolean, reason: string|null}>}
 */
export const checkUsernameAsync = async (username) => {
  const hit = findIdentifierProfanity(username);
  if (hit) return { safe: false, reason: `local:identifier:${hit}` };
  return containsProfanityAsync(username);
};

/**
 * Censor profanity in text (replace with asterisks)
 * @param {string} text
 * @returns {string}
 */
export const censorProfanity = (text) => {
  if (!text) return text;
  const str = String(text);

  return str.replace(/\S+/g, (word) => {
    const normalized = normalizeToken(word);
    const rawLower = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (isTokenBlocked(normalized) || isTokenBlocked(rawLower)) {
      return '*'.repeat(word.length);
    }
    return word;
  });
};

/**
 * Check multiple fields at once - returns first field with profanity
 * @param {Object} fields - { fieldName: value }
 * @returns {{ field: string, word: string }|null}
 */
export const checkFields = (fields) => {
  for (const [field, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const word = findProfanity(item);
        if (word) return { field, word };
      }
    } else if (value && typeof value === 'object') {
      // Handle ingredient sections {main: [...], sauce: [...]}
      for (const items of Object.values(value)) {
        if (Array.isArray(items)) {
          for (const item of items) {
            const word = findProfanity(item);
            if (word) return { field, word };
          }
        }
      }
    } else {
      const word = findProfanity(value);
      if (word) return { field, word };
    }
  }
  return null;
};

/**
 * Two-stage check: wordlist first (instant, offline), then OpenAI (comprehensive)
 * OpenAI only called if wordlist passes AND API key is configured.
 * @param {string} text
 * @returns {Promise<{safe: boolean, reason: string|null}>}
 */
export const containsProfanityAsync = async (text) => {
  // Stage 1: local wordlist (fast, offline, no API cost)
  const localHit = findProfanity(text);
  if (localHit) {
    return { safe: false, reason: 'local:wordlist' };
  }

  // Stage 2: OpenAI Moderation (comprehensive, catches nuanced stuff)
  try {
    const { checkTextWithOpenAI } = require('./openaiModeration');
    const openai = await checkTextWithOpenAI(text);
    if (!openai.safe) {
      return { safe: false, reason: `openai:${openai.reason}` };
    }
  } catch (err) {
    console.warn('OpenAI moderation unavailable:', err?.message);
  }

  return { safe: true, reason: null };
};

/**
 * Two-stage field check: wordlist first, then OpenAI if wordlist passes.
 * @param {Object} fields
 * @returns {Promise<{safe: boolean, field: string|null, reason: string|null}>}
 */
export const checkFieldsAsync = async (fields) => {
  // Stage 1: local wordlist
  const localHit = checkFields(fields);
  if (localHit) {
    return { safe: false, field: localHit.field, reason: `local:wordlist:${localHit.word}` };
  }

  // Stage 2: OpenAI Moderation (one batched call for all fields)
  try {
    const { checkFieldsWithOpenAI } = require('./openaiModeration');
    const openai = await checkFieldsWithOpenAI(fields);
    if (!openai.safe) {
      return { safe: false, field: openai.field, reason: `openai:${openai.reason}` };
    }
  } catch (err) {
    console.warn('OpenAI moderation unavailable:', err?.message);
  }

  return { safe: true, field: null, reason: null };
};

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

// Build final word set
const BLOCKED_WORDS = new Set(
  [...BASE_WORDS, ...CUSTOM_ADDITIONS].map(w => w.toLowerCase())
);
const EXCEPTIONS = new Set(ALLOWED_EXCEPTIONS.map(w => w.toLowerCase()));

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

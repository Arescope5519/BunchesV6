/**
 * FILENAME: src/utils/debugLog.js
 * PURPOSE: On-device debug log for release builds.
 *
 * Release APKs have no Metro console, so diagnosing device-specific
 * failures (the Android image-loading saga) needs the phone to keep
 * its own log. dbg() appends to a ring buffer that the Debug Log
 * viewer in Settings displays and copies. Unlike utils/log.js this is
 * NOT silenced in release - that is its entire purpose - so keep it
 * for targeted diagnostics, not chatty narration.
 */

const MAX_LINES = 400;
let buffer = [];

const fmt = (p) => {
  if (typeof p === 'string') return p;
  if (p instanceof Error) return p.message;
  try {
    return JSON.stringify(p);
  } catch {
    return String(p);
  }
};

export const dbg = (tag, ...parts) => {
  const ts = new Date().toISOString().slice(11, 23);
  const line = `${ts} [${tag}] ${parts.map(fmt).join(' ')}`;
  buffer.push(line);
  if (buffer.length > MAX_LINES) buffer = buffer.slice(-MAX_LINES);
  if (__DEV__) console.log(line);
};

export const getDebugLog = () =>
  buffer.length ? buffer.join('\n') : '(debug log is empty)';

export const clearDebugLog = () => {
  buffer = [];
};

export default dbg;

/**
 * FILENAME: src/utils/log.js
 * PURPOSE: Development-only logging.
 *
 * Release builds should be quiet: chatty logs cost time on every call
 * (string interpolation happens whether or not anyone reads it) and
 * leak internals into logcat. Errors still go through console.error so
 * real failures remain visible in production.
 *
 * Usage: import { log } from '../utils/log';  log('message', value);
 */

export const log = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export default log;

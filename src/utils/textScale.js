/**
 * FILENAME: src/utils/textScale.js
 * PURPOSE: App-wide text size control.
 *
 * Two modes:
 * - 'system' (default): text follows the phone's text-size setting,
 *   capped at 1.2x so accessibility scaling stays meaningful without
 *   breaking fixed-row layouts (the cap App.js always applied).
 * - A number (0.9 / 1 / 1.1 / 1.25): manual in-app size. System
 *   scaling is turned off and every <Text>'s fontSize/lineHeight is
 *   multiplied at render time via a Text.render wrap - the standard
 *   RN technique for a global text scale, since static StyleSheets
 *   can't be re-themed per setting.
 *
 * applyTextSize() takes effect immediately on the next render; the
 * saved setting is applied at startup by HomeScreen's settings load.
 */

import { Text, TextInput, StyleSheet } from 'react-native';

export const TEXT_SIZE_OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 0.9, label: 'S' },
  { key: 1, label: 'M' },
  { key: 1.1, label: 'L' },
  { key: 1.25, label: 'XL' },
];

let manualScale = null; // null = follow system
let patched = false;

const patchTextRender = () => {
  if (patched) return;
  const orig = Text.render;
  if (typeof orig !== 'function') return; // new-architecture fallback: manual sizes act as 100%
  patched = true;
  Text.render = function (props, ref) {
    if (manualScale == null || manualScale === 1) return orig.call(this, props, ref);
    const flat = StyleSheet.flatten(props.style) || {};
    const fontSize = (flat.fontSize || 14) * manualScale;
    const lineHeight = flat.lineHeight ? flat.lineHeight * manualScale : undefined;
    return orig.call(this, {
      ...props,
      style: [props.style, { fontSize, ...(lineHeight ? { lineHeight } : {}) }],
    }, ref);
  };
};

export const applyTextSize = (mode) => {
  if (Text.defaultProps == null) Text.defaultProps = {};
  if (TextInput.defaultProps == null) TextInput.defaultProps = {};

  if (mode == null || mode === 'system') {
    manualScale = null;
    Text.defaultProps.allowFontScaling = true;
    TextInput.defaultProps.allowFontScaling = true;
    Text.defaultProps.maxFontSizeMultiplier = 1.2;
    TextInput.defaultProps.maxFontSizeMultiplier = 1.2;
    return;
  }

  manualScale = Number(mode) || 1;
  // Manual mode: the phone's text-size setting no longer applies
  Text.defaultProps.allowFontScaling = false;
  TextInput.defaultProps.allowFontScaling = false;
  patchTextRender();
};

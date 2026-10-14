/**
 * FILENAME: src/utils/textScale.js
 * PURPOSE: App-wide text size control.
 *
 * Two modes:
 * - 'system' (default): text follows the phone's text-size setting,
 *   capped at 1.2x so accessibility scaling stays meaningful without
 *   breaking fixed-row layouts.
 * - A number (0.9 / 1 / 1.1 / 1.25): manual in-app size - system
 *   scaling is turned off and every Text's fontSize/lineHeight is
 *   multiplied.
 *
 * WHY THIS SHAPE: on RN 0.81 / React 19, Text is a plain function
 * component - Text.defaultProps is IGNORED (the old App.js 1.2x cap
 * had silently died with SDK 54) and Text.render does not exist. The
 * only global interception point left is element creation, so this
 * wraps the JSX runtime (and createElement) and injects props ONLY
 * when the element type is RN's Text or TextInput. Installed once at
 * startup; applyTextSize() changes take effect on the next render.
 */

import { Text, TextInput, StyleSheet } from 'react-native';

export const TEXT_SIZE_OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 0.9, label: 'S' },
  { key: 1, label: 'M' },
  { key: 1.1, label: 'L' },
  { key: 1.25, label: 'XL' },
];

const SYSTEM_CAP = 1.2;
let manualScale = null; // null = follow system (capped)
let installed = false;

const adjustProps = (type, props) => {
  if ((type !== Text && type !== TextInput) || !props) return props;

  if (manualScale == null) {
    // System mode: just enforce the accessibility cap (what the dead
    // defaultProps in App.js used to do), never overriding an explicit
    // per-component value
    if (props.maxFontSizeMultiplier == null) {
      return { ...props, maxFontSizeMultiplier: SYSTEM_CAP };
    }
    return props;
  }

  // Manual mode: system scaling off, sizes multiplied
  const flat = StyleSheet.flatten(props.style) || {};
  const fontSize = (flat.fontSize || 14) * manualScale;
  const lineHeight = flat.lineHeight ? flat.lineHeight * manualScale : undefined;
  return {
    ...props,
    allowFontScaling: false,
    style: [props.style, { fontSize, ...(lineHeight ? { lineHeight } : {}) }],
  };
};

const wrap = (orig) => {
  if (typeof orig !== 'function') return orig;
  const wrapped = function (type, props, ...rest) {
    return orig.call(this, type, adjustProps(type, props), ...rest);
  };
  wrapped.__textScaleWrapped = true;
  return wrapped;
};

const installOnce = () => {
  if (installed) return;
  installed = true;
  try {
    const rt = require('react/jsx-runtime');
    if (!rt.jsx?.__textScaleWrapped) rt.jsx = wrap(rt.jsx);
    if (!rt.jsxs?.__textScaleWrapped) rt.jsxs = wrap(rt.jsxs);
  } catch {}
  try {
    const rtd = require('react/jsx-dev-runtime');
    if (!rtd.jsxDEV?.__textScaleWrapped) rtd.jsxDEV = wrap(rtd.jsxDEV);
  } catch {}
  try {
    const React = require('react');
    if (!React.createElement?.__textScaleWrapped) React.createElement = wrap(React.createElement);
  } catch {}
};

export const applyTextSize = (mode) => {
  installOnce();
  manualScale = (mode == null || mode === 'system') ? null : (Number(mode) || 1);
};

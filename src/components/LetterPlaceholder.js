/**
 * FILENAME: src/components/LetterPlaceholder.js
 * PURPOSE: Image placeholder showing the first letter of a recipe title -
 * a white letter with a green outline on a soft green tile - instead of
 * the old "No Image" text.
 *
 * RN has no text-stroke, so the outline is faked by stacking offset
 * copies of the letter in the outline color behind the white one.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

const OUTLINE_OFFSETS = [
  [-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

export const LetterPlaceholder = ({ title, size = 36, style }) => {
  const match = String(title || '').match(/[a-zA-Z0-9]/);
  const letter = (match ? match[0] : '?').toUpperCase();

  const letterStyle = { fontSize: size, lineHeight: size * 1.2 };

  return (
    // container styles come last so the tile keeps its soft green look
    // even when the passed-in image style sets its own backgroundColor
    <View style={[style, styles.container]}>
      <View>
        {OUTLINE_OFFSETS.map(([x, y], i) => (
          <Text
            key={i}
            style={[styles.letter, styles.outline, letterStyle, { left: x, top: y }]}
            allowFontScaling={false}
          >
            {letter}
          </Text>
        ))}
        <Text style={[styles.letter, letterStyle]} allowFontScaling={false}>
          {letter}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  letter: {
    fontWeight: '800',
    color: '#fff',
  },
  outline: {
    position: 'absolute',
    color: colors.primary,
  },
});

export default LetterPlaceholder;

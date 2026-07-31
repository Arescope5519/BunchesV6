/**
 * FILENAME: src/components/LetterPlaceholder.js
 * PURPOSE: Image placeholder for recipes without a photo - a solid
 * forest-green tile with the first letter of the recipe title in white.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

export const LetterPlaceholder = ({ title, size = 36, style }) => {
  const match = String(title || '').match(/[a-zA-Z0-9]/);
  const letter = (match ? match[0] : '?').toUpperCase();

  return (
    // container styles come last so the tile stays solid green even when
    // the passed-in image style sets its own backgroundColor
    <View style={[style, styles.container]}>
      <Text
        style={[styles.letter, { fontSize: size, lineHeight: size * 1.2 }]}
        allowFontScaling={false}
      >
        {letter}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  letter: {
    fontWeight: '800',
    color: '#fff',
  },
});

export default LetterPlaceholder;

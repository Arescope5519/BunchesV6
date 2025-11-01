/**
 * FILENAME: src/components/RecipeDetail/ScalingControls.js
 * PURPOSE: Controls for scaling recipes and unit conversion
 * USED BY: src/components/RecipeDetail.js
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../constants/colors';

const ScalingControls = ({ scaleFactor, useMetric, onScaleChange, onMetricToggle }) => {
  const scaleOptions = [0.5, 1, 2, 3];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>🍴 Scale Recipe</Text>
      <View style={styles.scaleRow}>
        {scaleOptions.map(scale => (
          <TouchableOpacity
            key={scale}
            style={[
              styles.scaleButton,
              scaleFactor === scale && styles.scaleButtonActive
            ]}
            onPress={() => onScaleChange(scale)}
          >
            <Text style={[
              styles.scaleButtonText,
              scaleFactor === scale && styles.scaleButtonTextActive
            ]}>
              {scale < 1 ? '½×' : `${scale}×`}
            </Text>
          </TouchableOpacity>
        ))}
        
        <TouchableOpacity
          style={[styles.unitToggle, useMetric && styles.unitToggleActive]}
          onPress={onMetricToggle}
        >
          <Text style={[
            styles.unitToggleText,
            useMetric && styles.unitToggleTextActive
          ]}>
            {useMetric ? '📏 Metric' : '📏 Imperial'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.text,
  },
  scaleRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  scaleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scaleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scaleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  scaleButtonTextActive: {
    color: colors.white,
  },
  unitToggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  unitToggleTextActive: {
    color: colors.white,
  },
});

export default ScalingControls;

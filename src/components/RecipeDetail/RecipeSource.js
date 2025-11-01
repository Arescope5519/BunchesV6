/**
 * FILENAME: src/components/RecipeDetail/RecipeSource.js
 * PURPOSE: Display recipe source URL
 * USED BY: src/components/RecipeDetail.js
 */

import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import colors from '../../constants/colors';

const RecipeSource = ({ sourceUrl }) => {
  const handleOpenUrl = () => {
    if (sourceUrl) {
      Linking.openURL(sourceUrl).catch(err => 
        console.error("Failed to open URL:", err)
      );
    }
  };

  if (!sourceUrl) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Source:</Text>
      <TouchableOpacity onPress={handleOpenUrl}>
        <Text style={styles.url} numberOfLines={1}>
          {sourceUrl}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  url: {
    fontSize: 12,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});

export default RecipeSource;

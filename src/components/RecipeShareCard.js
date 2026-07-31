/**
 * FILENAME: src/components/RecipeShareCard.js
 * PURPOSE: Branded, story-sized recipe card rendered offscreen and
 * captured as an image for sharing (Instagram stories, messages, etc).
 *
 * Laid out at 360x640 logical points (9:16) and captured at 1080x1920
 * by the caller, so it fills an Instagram story cleanly.
 *
 * Calls onReady once the hero image has loaded (or immediately when
 * there is none) so the caller knows it is safe to capture.
 */

import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import { APP_NAME } from '../constants/app';
import { getIngredientLines } from '../utils/dietaryAnalysis';
import { formatDuration, formatServings } from '../utils/recipeFormat';

export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 640;

const MAX_INGREDIENTS = 8;

export const RecipeShareCard = ({ recipe, onReady }) => {
  const imageUrl = recipe?.image_url || recipe?.imageUrl || null;

  // No image to wait for - ready as soon as we mount
  useEffect(() => {
    if (!imageUrl && onReady) onReady();
  }, [imageUrl]);

  const lines = getIngredientLines(recipe?.ingredients);
  const shownLines = lines.slice(0, MAX_INGREDIENTS);
  const hiddenCount = lines.length - shownLines.length;

  const letterMatch = String(recipe?.title || '').match(/[a-zA-Z0-9]/);
  const letter = (letterMatch ? letterMatch[0] : '?').toUpperCase();

  const metaParts = [];
  const totalTime = recipe?.total_time || recipe?.totalTime;
  const prepTime = recipe?.prep_time || recipe?.prepTime;
  const cookTime = recipe?.cook_time || recipe?.cookTime;
  if (totalTime) {
    metaParts.push(`⏱ ${formatDuration(totalTime)}`);
  } else {
    if (prepTime) metaParts.push(`Prep ${formatDuration(prepTime)}`);
    if (cookTime) metaParts.push(`Cook ${formatDuration(cookTime)}`);
  }
  if (recipe?.servings) metaParts.push(`Serves ${formatServings(recipe.servings)}`);

  return (
    <View style={styles.card}>
      {/* Hero */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.hero}
          resizeMode="cover"
          onLoadEnd={() => onReady && onReady()}
          onError={() => onReady && onReady()}
        />
      ) : (
        <View style={[styles.hero, styles.heroPlaceholder]}>
          <Text style={styles.heroLetter} allowFontScaling={false}>{letter}</Text>
        </View>
      )}

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} allowFontScaling={false}>
          {recipe?.title || 'Untitled Recipe'}
        </Text>

        {metaParts.length > 0 && (
          <Text style={styles.meta} allowFontScaling={false}>
            {metaParts.join('   ·   ')}
          </Text>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel} allowFontScaling={false}>INGREDIENTS</Text>
        {shownLines.map((line, i) => (
          <Text key={i} style={styles.ingredient} numberOfLines={1} allowFontScaling={false}>
            •  {line}
          </Text>
        ))}
        {hiddenCount > 0 && (
          <Text style={styles.moreIngredients} allowFontScaling={false}>
            + {hiddenCount} more ingredient{hiddenCount > 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Ionicons name="restaurant" size={16} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.footerText} allowFontScaling={false}>
          Saved with {APP_NAME}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  hero: {
    width: SHARE_CARD_WIDTH,
    height: 270,
    backgroundColor: colors.primaryLight,
  },
  heroPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLetter: {
    fontSize: 120,
    lineHeight: 140,
    fontWeight: '800',
    color: '#fff',
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    fontWeight: '600',
  },
  divider: {
    height: 3,
    width: 48,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  ingredient: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.text,
  },
  moreIngredients: {
    fontSize: 13,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
  },
  footerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default RecipeShareCard;

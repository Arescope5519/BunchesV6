/**
 * UserAvatar Component
 * Circular avatar: the user's chosen food icon on their chosen color
 * (user_profiles.avatar_icon), falling back to the first letter of the
 * username on a hash-picked color.
 *
 * Icon-only avatars are deliberate: bundled Ionicons glyphs (MIT
 * licensed) mean nothing user-uploaded to moderate and no copyright
 * exposure. No alcohol glyphs - the target audience is 13+.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';

// The catalog the picker offers. Names are Ionicons glyphs bundled with
// the app; an unknown stored name falls back to the letter avatar, so
// removing one later is safe.
export const AVATAR_ICONS = [
  'pizza',
  'fast-food',
  'ice-cream',
  'cafe',
  'fish',
  'egg',
  'nutrition',
  'restaurant',
  'leaf',
  'flame',
];

// Circle colors sized to keep a white glyph readable (Honey + Forest
// theme plus warm/cool companions)
export const AVATAR_COLORS = [
  '#2D6A4F', // forest (colors.primary)
  '#C9962F', // honey dark (colors.accentDark - readable under white)
  '#C3593C', // terracotta
  '#8E5A8E', // plum
  '#3C7F8E', // teal
  '#4A6FA5', // slate blue
  '#B5484D', // berry
  '#6B4F35', // cocoa
];

const isValidIcon = (icon) =>
  icon && typeof icon === 'object' && AVATAR_ICONS.includes(icon.name);

// Generate a consistent color based on username
const getAvatarColor = (username) => {
  if (!username) return colors.primary;

  const colorOptions = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F', // Gold
    '#BB8FCE', // Purple
    '#85C1E9', // Light Blue
  ];

  // Use first character code to select color
  const charCode = username.charCodeAt(0) || 0;
  return colorOptions[charCode % colorOptions.length];
};

export const UserAvatar = ({
  username,
  icon = null, // { name, color } from user_profiles.avatar_icon
  size = 40,
  style = {},
  textStyle = {},
}) => {
  if (isValidIcon(icon)) {
    const background = AVATAR_COLORS.includes(icon.color) ? icon.color : colors.primary;
    return (
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: background,
          },
          style
        ]}
      >
        <Ionicons name={icon.name} size={size * 0.55} color="#fff" />
      </View>
    );
  }

  const letter = username ? username.charAt(0).toUpperCase() : '?';
  const backgroundColor = getAvatarColor(username);
  const fontSize = size * 0.45;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
        style
      ]}
    >
      <Text style={[styles.letter, { fontSize }, textStyle]}>
        {letter}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  letter: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default UserAvatar;

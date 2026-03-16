/**
 * UserAvatar Component
 * Displays a circular avatar with the first letter of a user's username
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

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
  size = 40,
  style = {},
  textStyle = {},
}) => {
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

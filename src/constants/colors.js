/**
 * FILENAME: src/constants/colors.js
 * PURPOSE: Centralized color definitions
 * CHANGES: Added highlightYellow for editing mode
 * USED BY: All components and screens
 */

export const colors = {
  // Primary
  primary: '#007AFF',
  primaryDark: '#0066CC',
  primaryLight: '#E6F2FF',

  // Background
  background: '#f5f5f5',
  white: '#fff',

  // Text
  text: '#333',
  textSecondary: '#666',
  textTertiary: '#999',
  textLight: '#bbb',

  // Borders
  border: '#ddd',
  borderLight: '#eee',
  borderVeryLight: '#f0f0f0',

  // Status
  success: '#34C759',
  warning: '#FF9500',
  error: '#ff3b30',
  destructive: '#ff3b30',

  // Special
  favorite: '#FFD700',
  shadow: '#000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  highlightYellow: '#FFF9C4', // For swap mode highlighting

  // Accent
  purple: '#5856D6',
  lightBlue: '#f0f8ff',
  lightGray: '#f9f9f9',
  darkGray: '#fafafa',
};

export default colors;
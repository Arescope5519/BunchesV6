/**
 * Predefined recipe tags with colors
 * Users can also create custom tags
 */

// Predefined tags organized by category
export const PREDEFINED_TAGS = [
  // Diet types
  { name: 'Vegetarian', color: '#4CAF50' },
  { name: 'Vegan', color: '#8BC34A' },
  { name: 'Gluten-Free', color: '#FF9800' },
  { name: 'Dairy-Free', color: '#03A9F4' },
  { name: 'Keto', color: '#9C27B0' },
  { name: 'Low-Carb', color: '#E91E63' },

  // Meal types
  { name: 'Breakfast', color: '#FFC107' },
  { name: 'Lunch', color: '#00BCD4' },
  { name: 'Dinner', color: '#3F51B5' },
  { name: 'Dessert', color: '#F06292' },
  { name: 'Snack', color: '#FFAB40' },
  { name: 'Appetizer', color: '#7E57C2' },

  // Recipe types
  { name: 'Soup', color: '#FF7043' },
  { name: 'Salad', color: '#66BB6A' },
  { name: 'Pasta', color: '#FFCA28' },
  { name: 'Seafood', color: '#29B6F6' },
  { name: 'Chicken', color: '#FFA726' },
  { name: 'Beef', color: '#8D6E63' },
  { name: 'Pork', color: '#EC407A' },

  // Convenience
  { name: 'Quick', color: '#26A69A' },
  { name: 'Easy', color: '#42A5F5' },
  { name: 'Meal Prep', color: '#5C6BC0' },
  { name: 'One-Pot', color: '#AB47BC' },
  { name: 'Slow Cooker', color: '#EF5350' },
  { name: 'Instant Pot', color: '#7CB342' },

  // Occasions
  { name: 'Holiday', color: '#D32F2F' },
  { name: 'Party', color: '#FF4081' },
  { name: 'Comfort Food', color: '#795548' },
  { name: 'Healthy', color: '#00C853' },
  { name: 'Kid-Friendly', color: '#FFEB3B' },
];

// Get color for a tag (predefined or generate one for custom)
export const getTagColor = (tagName) => {
  const predefined = PREDEFINED_TAGS.find(
    t => t.name.toLowerCase() === tagName.toLowerCase()
  );

  if (predefined) {
    return predefined.color;
  }

  // Generate a consistent color for custom tags based on the name
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#607D8B', '#78909C', '#90A4AE', '#546E7A',
    '#455A64', '#37474F', '#263238', '#B0BEC5',
  ];

  return colors[Math.abs(hash) % colors.length];
};

// Get predefined tag names for autocomplete
export const getPredefinedTagNames = () => {
  return PREDEFINED_TAGS.map(t => t.name);
};

export default {
  PREDEFINED_TAGS,
  getTagColor,
  getPredefinedTagNames,
};

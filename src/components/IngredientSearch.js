/**
 * IngredientSearch Component
 * Search recipes by selecting ingredients
 * Shows results sorted by ingredient match count
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import colors from '../constants/colors';

export const IngredientSearch = ({ visible, onClose, recipes, onSelectRecipe }) => {
  const [searchText, setSearchText] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Extract all unique ingredients from all recipes
  const allIngredients = useMemo(() => {
    const ingredientSet = new Set();

    recipes.forEach(recipe => {
      if (!recipe.deletedAt && recipe.ingredients) {
        Object.values(recipe.ingredients).forEach(section => {
          section.forEach(ingredient => {
            // Clean up ingredient text (remove amounts, common words)
            let cleaned = ingredient
              .toLowerCase()
              .replace(/^\d+[\s\/\d.-]*/, '') // Remove leading numbers/fractions
              .replace(/\b(cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|lb|lbs|g|kg|ml|l|pinch|dash|can|cans|jar|package)\b/gi, '')
              .replace(/\b(of|and|or|to|a|an|the|fresh|dried|frozen|chopped|diced|sliced|minced)\b/gi, '')
              .replace(/[,()]/g, '')
              .trim();

            // Also add individual words from multi-word ingredients
            const words = cleaned.split(/\s+/);
            words.forEach(word => {
              if (word.length > 2) {
                ingredientSet.add(word);
              }
            });

            // Add the full cleaned ingredient too
            if (cleaned.length > 2) {
              ingredientSet.add(cleaned);
            }
          });
        });
      }
    });

    const sortedIngredients = Array.from(ingredientSet).sort();
    console.log(`📊 Extracted ${sortedIngredients.length} unique ingredients from ${recipes.length} recipes`);
    return sortedIngredients;
  }, [recipes]);

  // Filter suggestions based on search text
  const suggestions = useMemo(() => {
    if (!searchText.trim() || searchText.trim().length < 2) return [];

    const search = searchText.toLowerCase().trim();

    // Prioritize ingredients that start with the search term
    const startsWith = [];
    const contains = [];

    allIngredients.forEach(ing => {
      if (selectedIngredients.includes(ing)) return;

      if (ing.startsWith(search)) {
        startsWith.push(ing);
      } else if (ing.includes(search)) {
        contains.push(ing);
      }
    });

    // Combine results: startsWith first, then contains
    return [...startsWith, ...contains].slice(0, 15); // Limit to 15 suggestions
  }, [searchText, allIngredients, selectedIngredients]);

  // Add ingredient to selected list
  const addIngredient = (ingredient) => {
    if (!selectedIngredients.includes(ingredient)) {
      console.log('Adding ingredient:', ingredient);
      setSelectedIngredients([...selectedIngredients, ingredient]);
      setSearchText('');
      setShowSuggestions(false);
    }
  };

  // Remove ingredient from selected list
  const removeIngredient = (ingredient) => {
    setSelectedIngredients(selectedIngredients.filter(i => i !== ingredient));
  };

  // Find matching recipes and calculate match scores
  const matchingRecipes = useMemo(() => {
    if (selectedIngredients.length === 0) return [];

    const results = [];

    recipes.forEach(recipe => {
      if (recipe.deletedAt) return;
      if (!recipe.ingredients) return;

      let matchCount = 0;
      const recipeIngredients = Object.values(recipe.ingredients)
        .flat()
        .map(ing => ing.toLowerCase());

      selectedIngredients.forEach(selected => {
        const matched = recipeIngredients.some(recipeIng =>
          recipeIng.includes(selected)
        );
        if (matched) matchCount++;
      });

      if (matchCount > 0) {
        results.push({
          recipe,
          matchCount,
          matchPercentage: (matchCount / selectedIngredients.length) * 100
        });
      }
    });

    // Sort by match count (highest first)
    return results.sort((a, b) => b.matchCount - a.matchCount);
  }, [selectedIngredients, recipes]);

  const handleClose = () => {
    setSearchText('');
    setSelectedIngredients([]);
    setShowSuggestions(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <StatusBar style="light" hidden={true} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeButton}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search by Ingredients</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Search Input */}
        <View style={styles.searchSection}>
          <Text style={styles.label}>Type ingredients you have:</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="e.g., chicken, garlic, tomato..."
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text);
              setShowSuggestions(text.trim().length >= 2);
            }}
            onFocus={() => setShowSuggestions(searchText.trim().length >= 2)}
            onBlur={() => {
              // Delay hiding to allow tapping suggestions
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          {/* Autocomplete Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsHeader}>
                Tap to add ingredient:
              </Text>
              <ScrollView
                style={styles.suggestionsList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {suggestions.map((ingredient, index) => (
                  <TouchableOpacity
                    key={`${ingredient}-${index}`}
                    style={styles.suggestionItem}
                    onPress={() => addIngredient(ingredient)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionText}>🔍 {ingredient}</Text>
                    <Text style={styles.suggestionAdd}>+</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* No suggestions message */}
          {showSuggestions && searchText.trim().length >= 2 && suggestions.length === 0 && (
            <View style={styles.noSuggestionsContainer}>
              <Text style={styles.noSuggestionsText}>
                No ingredient suggestions found. Try typing differently or add it manually.
              </Text>
            </View>
          )}

          {/* Selected Ingredients */}
          {selectedIngredients.length > 0 && (
            <View style={styles.selectedSection}>
              <Text style={styles.selectedLabel}>
                Selected ingredients ({selectedIngredients.length}) - Tap to remove:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.ingredientChips}>
                  {selectedIngredients.map((ingredient, index) => (
                    <TouchableOpacity
                      key={`${ingredient}-${index}`}
                      style={styles.chip}
                      onPress={() => removeIngredient(ingredient)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipText}>{ingredient}</Text>
                      <Text style={styles.chipRemove}> ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        {/* Results */}
        <View style={styles.resultsSection}>
          {selectedIngredients.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🔍</Text>
              <Text style={styles.emptyStateText}>
                Select ingredients to find matching recipes
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Type in the search box and tap suggestions
              </Text>
            </View>
          ) : matchingRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>😕</Text>
              <Text style={styles.emptyStateText}>No recipes found</Text>
              <Text style={styles.emptyStateSubtext}>
                Try different ingredients
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultsHeader}>
                Found {matchingRecipes.length} recipe{matchingRecipes.length > 1 ? 's' : ''}
              </Text>
              <FlatList
                data={matchingRecipes}
                keyExtractor={(item) => item.recipe.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.recipeCard}
                    onPress={() => {
                      onSelectRecipe(item.recipe);
                      handleClose();
                    }}
                  >
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeTitle}>{item.recipe.title}</Text>
                      <Text style={styles.recipeMeta}>
                        {item.recipe.folder} • {Object.values(item.recipe.ingredients || {}).flat().length} ingredients
                      </Text>
                    </View>
                    <View style={styles.matchBadge}>
                      <Text style={styles.matchText}>
                        {item.matchCount}/{selectedIngredients.length}
                      </Text>
                      <Text style={styles.matchLabel}>match</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  closeButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 60,
  },
  searchSection: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 1001,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
  },
  suggestionsContainer: {
    marginTop: 8,
    maxHeight: 250,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  suggestionsHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: colors.background,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    backgroundColor: '#fff',
  },
  suggestionText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  suggestionAdd: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 8,
  },
  noSuggestionsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noSuggestionsText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  selectedSection: {
    marginTop: 12,
  },
  selectedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  ingredientChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  chipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  chipRemove: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  resultsSection: {
    flex: 1,
    padding: 15,
  },
  resultsHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  recipeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeInfo: {
    flex: 1,
    marginRight: 12,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  recipeMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  matchBadge: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  matchText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  matchLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default IngredientSearch;

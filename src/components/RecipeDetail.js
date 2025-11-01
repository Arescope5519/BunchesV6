/**
 * FILENAME: src/components/RecipeDetail.js
 * PURPOSE: Display and edit recipe details (REFACTORED - Main Component)
 * NEW: Modularized into smaller components for better maintainability
 * DEPENDENCIES: React, React Native components, sub-components
 * USED BY: src/screens/HomeScreen.js
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import colors from '../constants/colors';

// Import modular components
import RecipeHeader from './RecipeDetail/RecipeHeader';
import ScalingControls from './RecipeDetail/ScalingControls';
import IngredientsSection from './RecipeDetail/IngredientsSection';
import InstructionsSection from './RecipeDetail/InstructionsSection';
import RecipeSource from './RecipeDetail/RecipeSource';

// Import utilities
import {
  parseRecipeIngredients,
  scaleRecipeIngredients,
  scaleRecipeInstructions,
  convertRecipeIngredients
} from '../utils/IngredientParser';

const RecipeDetail = ({ recipe, onUpdate }) => {
  // Local editable copy of recipe
  const [localRecipe, setLocalRecipe] = useState(recipe);

  // Scaling and conversion state
  const [scaleFactor, setScaleFactor] = useState(1);
  const [useMetric, setUseMetric] = useState(false);
  const [parsedIngredients, setParsedIngredients] = useState(null);
  const [displayedIngredients, setDisplayedIngredients] = useState(null);
  const [displayedInstructions, setDisplayedInstructions] = useState(null);

  // Section editing state
  const [editingSection, setEditingSection] = useState(null);
  const [sectionActionMode, setSectionActionMode] = useState(null); // { type: 'move', sectionKey: 'Sauce' }

  // Update local recipe when prop changes
  useEffect(() => {
    setLocalRecipe(recipe);
    const parsed = parseRecipeIngredients(recipe.ingredients);
    setParsedIngredients(parsed);
  }, [recipe]);

  // Scale ingredients and instructions
  useEffect(() => {
    if (!parsedIngredients) return;

    let ingredients = scaleRecipeIngredients(parsedIngredients, scaleFactor);

    if (useMetric) {
      ingredients = convertRecipeIngredients(parsedIngredients, true);
      const parsedConverted = {};
      for (const [section, items] of Object.entries(ingredients)) {
        parsedConverted[section] = items.map(item => {
          if (typeof item === 'string') {
            const { parseIngredient } = require('../utils/IngredientParser');
            return parseIngredient(item);
          }
          return item;
        });
      }
      ingredients = scaleRecipeIngredients(parsedConverted, scaleFactor);
    }

    setDisplayedIngredients(ingredients);
    const scaledInstructions = scaleRecipeInstructions(localRecipe.instructions, scaleFactor);
    setDisplayedInstructions(scaledInstructions);
  }, [parsedIngredients, scaleFactor, useMetric, localRecipe.instructions]);

  // Update handlers
  const handleRecipeUpdate = (updatedRecipe) => {
    setLocalRecipe(updatedRecipe);
    onUpdate(updatedRecipe);
  };

  return (
    <ScrollView style={styles.container}>
      <RecipeHeader 
        recipe={localRecipe}
        onUpdate={handleRecipeUpdate}
      />

      <ScalingControls
        scaleFactor={scaleFactor}
        useMetric={useMetric}
        onScaleChange={setScaleFactor}
        onMetricToggle={() => setUseMetric(!useMetric)}
      />

      <IngredientsSection
        ingredients={localRecipe.ingredients}
        displayedIngredients={displayedIngredients}
        editingSection={editingSection}
        sectionActionMode={sectionActionMode}
        onEditSection={setEditingSection}
        onSectionAction={setSectionActionMode}
        onUpdate={(updatedIngredients) => {
          const updated = {
            ...localRecipe,
            ingredients: updatedIngredients
          };
          handleRecipeUpdate(updated);
        }}
      />

      <InstructionsSection
        instructions={localRecipe.instructions}
        displayedInstructions={displayedInstructions}
        onUpdate={(updatedInstructions) => {
          const updated = {
            ...localRecipe,
            instructions: updatedInstructions
          };
          handleRecipeUpdate(updated);
        }}
      />

      {localRecipe.sourceUrl && (
        <RecipeSource sourceUrl={localRecipe.sourceUrl} />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.white,
  },
});

export default RecipeDetail;

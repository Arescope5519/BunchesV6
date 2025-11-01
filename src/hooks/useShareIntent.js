/**
 * HomeScreen.js - Share Intent Fix
 * This is just the relevant parts that need to be updated in your HomeScreen.js
 * Copy these sections into your existing HomeScreen.js
 */

// In your HomeScreen component, update these parts:

// 1. UPDATE THE EXTRACTION CALLBACK:
const { loading, extractRecipe } = useRecipeExtraction(async (recipe, isAutoSave) => {
  console.log('📥 Recipe extraction callback:', recipe.title, 'Auto-save:', isAutoSave);

  // Ensure we have a valid recipe
  if (!recipe || !recipe.title) {
    console.error('❌ Invalid recipe data');
    Alert.alert('Error', 'Invalid recipe data received');
    return;
  }

  // Save the recipe
  const saved = await saveRecipe(recipe);

  if (saved) {
    console.log('✅ Recipe saved successfully:', recipe.title);

    // Clear the URL input
    setUrl('');

    // Set the recipe as selected to display it
    // Use a timeout to ensure state updates properly
    setTimeout(() => {
      setSelectedRecipe(recipe);
      setCurrentView('recipes'); // Make sure we're on recipes view
    }, 100);

    // Show brief success message for auto-save
    if (isAutoSave) {
      Alert.alert('Recipe Saved!', `"${recipe.title}" has been extracted and saved.`);
    }
  } else {
    console.error('❌ Failed to save recipe');
    Alert.alert('Error', 'Failed to save recipe. Please try again.');
  }
});

// 2. UPDATE THE SHARE INTENT HANDLER:
useShareIntent((sharedUrl) => {
  console.log('🔗 Received shared URL:', sharedUrl);

  if (sharedUrl && sharedUrl.trim()) {
    // Set the URL in the input field (visual feedback)
    setUrl(sharedUrl);

    // Auto-extract the recipe immediately
    console.log('🚀 Auto-extracting recipe from shared URL');

    // Small delay to ensure UI updates
    setTimeout(() => {
      extractRecipe(sharedUrl, true); // true = auto-save
    }, 100);
  } else {
    console.error('❌ Invalid shared URL received');
  }
});

// 3. ALSO UPDATE THE MANUAL EXTRACT BUTTON HANDLER:
// In your URL input section, make sure the extract button works:
<TouchableOpacity
  onPress={() => {
    if (url && url.trim()) {
      extractRecipe(url.trim(), false); // false = manual, ask user
    } else {
      Alert.alert('Error', 'Please enter a recipe URL');
    }
  }}
  style={styles.extractButton}
  disabled={loading || !url}
>
  {loading ? (
    <ActivityIndicator size="small" color="#fff" />
  ) : (
    <Text style={styles.extractButtonText}>Extract</Text>
  )}
</TouchableOpacity>

// 4. ENSURE YOUR saveRecipe FUNCTION IN useRecipes RETURNS THE SAVED RECIPE:
// In your useRecipes hook, make sure saveRecipe returns the recipe object:
const saveRecipe = async (recipe) => {
  // Wait for recipes to load if they haven't yet
  while (loadingRecipes) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Ensure recipe has an ID
  if (!recipe.id) {
    recipe.id = Date.now().toString();
  }

  const updatedRecipes = [recipe, ...recipes];
  const success = await saveRecipesToStorage(updatedRecipes);

  if (success) {
    setRecipes(updatedRecipes);
    console.log('✅ Recipe saved! Total recipes:', updatedRecipes.length);
    return recipe; // Return the saved recipe with ID
  }
  return null;
};

// 5. ADD ERROR HANDLING FOR SHARE INTENT:
// Wrap the share intent in a try-catch:
useShareIntent((sharedUrl) => {
  try {
    console.log('🔗 Received shared URL:', sharedUrl);

    if (sharedUrl && sharedUrl.trim()) {
      // Clear any existing URL first
      setUrl('');

      // Set the new URL
      const cleanUrl = sharedUrl.trim();
      setUrl(cleanUrl);

      // Make sure we're on the recipes view
      setCurrentView('recipes');

      // Auto-extract with a slight delay for UI to update
      setTimeout(() => {
        console.log('🚀 Starting auto-extraction for:', cleanUrl);
        extractRecipe(cleanUrl, true);
      }, 200);
    } else {
      console.error('❌ Empty or invalid shared URL');
    }
  } catch (error) {
    console.error('💥 Error handling shared URL:', error);
    Alert.alert('Error', 'Failed to process shared URL');
  }
});
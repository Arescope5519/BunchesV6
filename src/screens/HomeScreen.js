/**
 * FILENAME: src/screens/HomeScreen.js
 * PURPOSE: Main application screen
 * CHANGES: Added updateRecipe prop to RecipeDetail component
 * DEPENDENCIES: All hooks, RecipeDetail component, colors
 * USED BY: App.js
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
  BackHandler,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Share,
  Clipboard,
  Animated,
  PanResponder,
  Image,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';

// Hooks
import { useRecipes } from '../hooks/useRecipes';
import { useFolders } from '../hooks/useFolders';
import { useShareIntent } from '../hooks/useShareIntent';
import { useRecipeExtraction } from '../hooks/useRecipeExtraction';
import { useGroceryList } from '../hooks/useGroceryList';
import { useGlobalUndo } from '../hooks/useGlobalUndo';
import { useSocial } from '../hooks/useSocial';

// Components
import RecipeDetail from '../components/RecipeDetail';
import { GroceryList } from '../components/GroceryList';
import { IngredientSearch } from '../components/IngredientSearch';
import { DashboardScreen } from './DashboardScreen';
import { CreateRecipeScreen } from './CreateRecipeScreen';
import { SettingsScreen } from './SettingsScreen';
import { SaveRecipeScreen } from './SaveRecipeScreen';
import { UsernameSetupModal } from '../components/UsernameSetupModal';
import { SocialModal } from '../components/SocialModal';
import { ShareToFriendsModal } from '../components/ShareToFriendsModal';
import NotificationPopup from '../components/NotificationPopup';

// Constants
import colors from '../constants/colors';

// Supabase auth
import { signOut as supabaseSignOut, signInWithGoogle as supabaseSignIn } from '../services/supabase/auth';
import { saveRecipeToDatabase, syncRecipes as syncRecipesWithSupabase } from '../services/supabase/database';

// iOS Share Extension pending recipes
import { getPendingRecipes, clearPendingRecipes } from '../services/pendingRecipes';

// Storage utilities for manual sync
import { saveRecipes as saveRecipesToStorage } from '../utils/storage';

// Recipe extractor for parsing shared URLs (consistent with Android)
import RecipeExtractor from '../../RecipeExtractor';

export const HomeScreen = ({ user }) => {
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState('recipes'); // recipes, social, settings, grocery

  // Local state
  const [url, setUrl] = useState('');
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [showGroceryList, setShowGroceryList] = useState(false);
  const [showRenameFolder, setShowRenameFolder] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importTargetFolder, setImportTargetFolder] = useState('All Recipes');
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [extractedRecipe, setExtractedRecipe] = useState(null);

  // Sorting/filtering state
  const [sortBy, setSortBy] = useState('dateAdded'); // dateAdded, dateModified, alphabetical
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // View mode state
  const [viewMode, setViewMode] = useState('photo'); // 'list' or 'photo'

  // Multiselect state
  const [multiselectMode, setMultiselectMode] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState(new Set());

  // Social state
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [showShareToFriends, setShowShareToFriends] = useState(false);
  const [shareItem, setShareItem] = useState(null); // { type, data, name }

  // Notification popup state
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [notificationRequest, setNotificationRequest] = useState(null);
  const prevFriendRequestsRef = useRef([]);

  // Hooks - Pass user to useRecipes for Supabase sync
  const {
    recipes,
    loadingRecipes,
    selectedRecipe,
    setSelectedRecipe,
    saveRecipe,
    saveRecipesBatch,
    updateRecipe,
    deleteRecipe,
    restoreRecipe,
    permanentlyDeleteRecipe,
    emptyRecentlyDeleted,
    toggleFavorite,
    moveToFolder: moveRecipeToFolder,
    moveManyToFolder,
    getFilteredRecipes,
    refreshRecipes,
    reloadFromStorage,
  } = useRecipes(user);

  const {
    folders,
    currentFolder,
    setCurrentFolder,
    addFolder: addFolderBase,
    renameFolder: renameFolderBase,
    deleteFolder: deleteFolderBase,
    getCustomFolders,
  } = useFolders(user);

  const {
    groceryList,
    loading: groceryListLoading,
    addItems: addItemsToGroceryList,
    removeItem: removeGroceryItem,
    toggleItemChecked,
    clearCheckedItems,
    clearAllItems,
    getUncheckedCount,
    restoreList: restoreGroceryList,
  } = useGroceryList(user);

  // Global undo system
  const {
    addUndoAction,
    performUndo,
    clearUndoStack,
    showUndoButton,
    canUndo,
    lastActionDescription,
    undoCount,
  } = useGlobalUndo();

  // Social features
  const {
    profile,
    needsUsername,
    friends,
    friendRequests,
    sharedItems,
    notificationCounts,
    setupUsername,
    checkUsernameAvailable,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    shareWithFriends,
    importSharedItem,
    declineSharedItem,
    updatePrivacySettings,
    changeUsername,
    refreshSocialData,
  } = useSocial(user);

  // Swipeable undo button
  const undoButtonPosition = useRef(new Animated.ValueXY()).current;
  const [undoButtonDismissed, setUndoButtonDismissed] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only start pan if swiping (not just tapping)
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Allow swiping in any direction
        undoButtonPosition.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped far enough in any direction, dismiss
        const threshold = 80;
        if (Math.abs(gestureState.dx) > threshold || Math.abs(gestureState.dy) > threshold) {
          // Animate out
          Animated.timing(undoButtonPosition, {
            toValue: {
              x: gestureState.dx > 0 ? 400 : -400,
              y: gestureState.dy
            },
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            setUndoButtonDismissed(true);
            undoButtonPosition.setValue({ x: 0, y: 0 });
          });
        } else {
          // Snap back
          Animated.spring(undoButtonPosition, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // Reset dismissed state when a new undo action is available
  useEffect(() => {
    if (showUndoButton && canUndo) {
      setUndoButtonDismissed(false);
    }
  }, [undoCount]); // Reset whenever undo stack count changes (new action added)

  // Detect new friend requests and show notification popup
  useEffect(() => {
    if (!user || !friendRequests || friendRequests.length === 0) {
      prevFriendRequestsRef.current = friendRequests || [];
      return;
    }

    // Check if there's a new friend request
    const prevRequests = prevFriendRequestsRef.current;
    if (prevRequests.length < friendRequests.length) {
      // New request detected - show the most recent one
      const newRequest = friendRequests[friendRequests.length - 1];
      setNotificationRequest(newRequest);
      setShowNotificationPopup(true);
    }

    // Update ref
    prevFriendRequestsRef.current = friendRequests;
  }, [friendRequests, user]);

  // Hide Android system navigation bar on mount
  useEffect(() => {
    const hideNavigationBar = async () => {
      if (Platform.OS === 'android') {
        try {
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBehaviorAsync('overlay-swipe');
        } catch (error) {
          console.log('Failed to hide navigation bar:', error);
        }
      }
    };

    hideNavigationBar();
  }, []);

  // Check for pending recipes from iOS Share Extension
  useEffect(() => {
    const extractor = new RecipeExtractor();

    const checkPendingRecipes = async () => {
      console.log('[HomeScreen] checkPendingRecipes called, Platform:', Platform.OS);

      if (Platform.OS !== 'ios') {
        console.log('[HomeScreen] Not iOS, skipping pending recipes check');
        return;
      }

      try {
        console.log('[HomeScreen] Fetching pending recipes...');
        const pending = await getPendingRecipes();
        console.log('[HomeScreen] Pending recipes result:', JSON.stringify(pending, null, 2));

        if (pending && pending.length > 0) {
          console.log(`[HomeScreen] Found ${pending.length} pending recipe(s) from Share Extension - auto-importing...`);

          // Auto-import without prompt (user already confirmed in Share Extension)
          let imported = 0;
          let failed = 0;

          for (const item of pending) {
            try {
              let recipeData;

              // Check if this needs parsing (new format with URL only)
              if (item.needs_parsing && item.url) {
                console.log(`Parsing URL with RecipeExtractor: ${item.url}`);
                const result = await extractor.extract(item.url);

                if (result.success && result.data) {
                  // Convert RecipeExtractor format to app format
                  const extracted = result.data;

                  // Handle ingredients - can be object with sections or string
                  let ingredientsStr = '';
                  if (typeof extracted.ingredients === 'object') {
                    // Convert sectioned ingredients to string
                    ingredientsStr = Object.entries(extracted.ingredients)
                      .map(([section, items]) => {
                        if (section === 'main') return items.join('\n');
                        return `${section}:\n${items.join('\n')}`;
                      })
                      .join('\n\n');
                  } else if (typeof extracted.ingredients === 'string') {
                    ingredientsStr = extracted.ingredients;
                  }

                  // Handle instructions - convert array to numbered string
                  let instructionsStr = '';
                  if (Array.isArray(extracted.instructions)) {
                    instructionsStr = extracted.instructions
                      .map((step, i) => `${i + 1}. ${step}`)
                      .join('\n');
                  } else if (typeof extracted.instructions === 'string') {
                    instructionsStr = extracted.instructions;
                  }

                  recipeData = {
                    title: extracted.title || item.preview_title || 'Untitled Recipe',
                    ingredients: ingredientsStr,
                    instructions: instructionsStr,
                    prep_time: extracted.prep_time || '',
                    cook_time: extracted.cook_time || '',
                    servings: extracted.servings || '',
                    image_url: extracted.image || item.preview_image || null,
                    source_url: item.url,
                    folder: 'All Recipes',
                  };
                } else {
                  console.warn(`Failed to extract recipe from ${item.url}: ${result.error}`);
                  failed++;
                  continue;
                }
              } else {
                // Legacy format - recipe data already parsed by share extension
                recipeData = {
                  title: item.title || 'Untitled Recipe',
                  ingredients: item.ingredients || '',
                  instructions: item.instructions || '',
                  prep_time: item.prep_time || '',
                  cook_time: item.cook_time || '',
                  servings: item.servings || '',
                  image_url: item.image_url || null,
                  source_url: item.source_url || item.url || '',
                  folder: 'All Recipes',
                };
              }

              await saveRecipe(recipeData);
              imported++;
            } catch (err) {
              console.error('Failed to import recipe:', err);
              failed++;
            }
          }

          await clearPendingRecipes();

          // Show brief success notification
          if (imported > 0) {
            const titles = pending
              .slice(0, 3)
              .map(p => p.preview_title || p.title || 'Recipe')
              .join(', ');
            const moreText = pending.length > 3 ? ` +${pending.length - 3} more` : '';
            Alert.alert(
              '✅ Imported',
              `${titles}${moreText}${failed > 0 ? `\n(${failed} failed)` : ''}`
            );
          } else if (failed > 0) {
            Alert.alert('Import Failed', `Could not import ${failed} recipe${failed !== 1 ? 's' : ''}`);
          }
        } else {
          console.log('[HomeScreen] No pending recipes found');
        }
      } catch (error) {
        console.error('[HomeScreen] Error checking pending recipes:', error);
      }
    };

    // Check on mount
    console.log('[HomeScreen] Mounting, will check pending recipes...');
    checkPendingRecipes();

    // Check when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPendingRecipes();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [saveRecipe]);

  const { loading, extractRecipe } = useRecipeExtraction((recipe) => {
    // Navigate to save recipe screen with extracted recipe
    setExtractedRecipe(recipe);
    setCurrentScreen('saveRecipe');
  });

  // Handle save from SaveRecipeScreen
  const handleSaveExtractedRecipe = async (selectedFolder, modifiedRecipe) => {
    if (!modifiedRecipe) return;

    const recipeWithFolder = {
      ...modifiedRecipe,
      folder: selectedFolder === 'Favorites' || selectedFolder === 'Recently Deleted'
        ? 'All Recipes'
        : selectedFolder,
    };

    const saved = await saveRecipe(recipeWithFolder);

    if (saved) {
      setSelectedRecipe(recipeWithFolder);
      setCurrentScreen('recipes');
      Alert.alert('✅ Saved', `Recipe saved to ${recipeWithFolder.folder}!`);
    } else {
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    }

    // Clean up
    setExtractedRecipe(null);
    setUrl('');
  };

  // Handle cancel save from SaveRecipeScreen
  const handleCancelSave = () => {
    setExtractedRecipe(null);
    setUrl('');
    setCurrentScreen('recipes');
  };

  // Navigation handler - all tabs now render inline
  const handleNavigation = (screen) => {

    if (screen === 'recipes' || screen === 'social' || screen === 'settings' || screen === 'grocery') {
      setCurrentScreen(screen);
      // Close modals when switching to main tabs
      setShowSocialModal(false);
      setShowGroceryList(false);
    } else if (screen === 'create') {
      setCurrentScreen('create');
    } else if (screen === 'import') {
      setShowImport(true);
    } else if (screen === 'search') {
      setShowIngredientSearch(true);
    }
  };

  // Render navigation bar
  const renderNavigationBar = () => {
    return (
      <View style={styles.navigationBar}>
        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'social' && styles.navButtonActive]}
          onPress={() => handleNavigation('social')}
        >
          <Text style={styles.navButtonIcon}>👥</Text>
          {notificationCounts.total > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{notificationCounts.total}</Text>
            </View>
          )}
          <Text style={[styles.navButtonText, currentScreen === 'social' && styles.navButtonTextActive]}>
            Social
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'recipes' && styles.navButtonActive]}
          onPress={() => handleNavigation('recipes')}
        >
          <Text style={styles.navButtonIcon}>📖</Text>
          <Text style={[styles.navButtonText, currentScreen === 'recipes' && styles.navButtonTextActive]}>
            Recipes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'grocery' && styles.navButtonActive]}
          onPress={() => handleNavigation('grocery')}
        >
          <Text style={styles.navButtonIcon}>🛒</Text>
          {getUncheckedCount() > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{getUncheckedCount()}</Text>
            </View>
          )}
          <Text style={[styles.navButtonText, currentScreen === 'grocery' && styles.navButtonTextActive]}>
            Shopping
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'settings' && styles.navButtonActive]}
          onPress={() => handleNavigation('settings')}
        >
          <Text style={styles.navButtonIcon}>⚙️</Text>
          <Text style={[styles.navButtonText, currentScreen === 'settings' && styles.navButtonTextActive]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Handle recipe creation
  const handleCreateRecipe = async (recipe) => {
    const saved = await saveRecipe(recipe);
    if (saved) {
      Alert.alert('✅ Success', `Recipe "${recipe.title}" created!`);
      setCurrentScreen('recipes');
      setSelectedRecipe(recipe);
    } else {
      Alert.alert('Error', 'Failed to create recipe. Please try again.');
    }
  };

  // Handle clear all data
  const handleClearAllData = async () => {
    try {
      const { saveRecipes } = require('../utils/storage');
      await saveRecipes([], user?.uid || null);
      await refreshRecipes();
      setCurrentScreen('recipes');
      Alert.alert('✅ Success', 'All data has been cleared');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear data');
    }
  };

  // Handle restore from backup
  const handleRestoreBackup = async (backupData) => {
    try {
      const FileSystem = require('expo-file-system');
      const recipesToRestore = backupData.recipes || [];

      // Helper to save base64 image to local file
      const saveBase64Image = async (base64Data, recipeId) => {
        if (!base64Data) return null;

        // If it's already a URL (not base64), return as-is
        if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
          return base64Data;
        }

        // If it's a base64 data URI
        if (base64Data.startsWith('data:image/')) {
          try {
            // Extract mime type and base64 content
            const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!matches) return null;

            const ext = matches[1] === 'png' ? 'png' : 'jpg';
            const base64Content = matches[2];

            // Create directory if needed
            const imageDir = `${FileSystem.documentDirectory}recipe_images/`;
            const dirInfo = await FileSystem.getInfoAsync(imageDir);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(imageDir, { intermediates: true });
            }

            // Save the image
            const fileName = `${recipeId}.${ext}`;
            const filePath = `${imageDir}${fileName}`;

            await FileSystem.writeAsStringAsync(filePath, base64Content, {
              encoding: FileSystem.EncodingType.Base64,
            });

            return filePath;
          } catch (error) {
            console.log('Failed to save image:', error);
            return null;
          }
        }

        // If it's already a local file path, return as-is
        return base64Data;
      };

      // Process each recipe
      for (let index = 0; index < recipesToRestore.length; index++) {
        const recipeData = recipesToRestore[index];
        const recipeId = `restored_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;

        // Save image if it's base64
        const imageUrl = await saveBase64Image(recipeData.image_url, recipeId);

        const newRecipe = {
          id: recipeId,
          title: recipeData.title || 'Untitled Recipe',
          folder: recipeData.folder || 'All Recipes',
          ingredients: recipeData.ingredients || {},
          instructions: recipeData.instructions || [],
          prep_time: recipeData.prep_time || '',
          cook_time: recipeData.cook_time || '',
          servings: recipeData.servings || '',
          notes: recipeData.notes || '',
          image_url: imageUrl,
          source_url: recipeData.source_url || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveRecipe(newRecipe);
      }

      // Also restore any new folders that don't exist
      if (backupData.folders && Array.isArray(backupData.folders)) {
        const existingFolderNames = folders.map(f => f.toLowerCase());
        const newFolders = backupData.folders.filter(
          f => f !== 'All Recipes' && !existingFolderNames.includes(f.toLowerCase())
        );
        for (const folderName of newFolders) {
          await addFolder(folderName);
        }
      }

      await refreshRecipes();
    } catch (error) {
      console.error('Restore backup error:', error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await supabaseSignOut();
      Alert.alert('Signed Out', 'You have been successfully signed out');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleSyncNow = async () => {
    if (!user) return;

    try {
      console.log('🔄 Manual sync started...');
      // Sync local recipes with Supabase
      const mergedRecipes = await syncRecipesWithSupabase(user.uid, recipes);
      // Save merged result to local storage
      await saveRecipesToStorage(mergedRecipes, user.uid);
      // Reload UI from storage
      await reloadFromStorage();
      console.log('✅ Manual sync complete');
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  };

  const handleSignIn = async () => {
    try {
      const userData = await supabaseSignIn();
      Alert.alert('Signed In', 'Welcome ' + (userData.displayName || userData.email) + '!');
    } catch (error) {
      console.error('Sign in error:', error);

      // Ultra-simple error handling - no optional chaining
      let errorCode = 'unknown';
      let errorMessage = 'Sign-in failed';

      try {
        if (error && error.code) {
          errorCode = String(error.code);
        }
      } catch (e) {
        // Ignore
      }

      try {
        if (error && error.message) {
          errorMessage = String(error.message);
        }
      } catch (e) {
        // Ignore
      }

      console.error('Error code:', errorCode);
      console.error('Error message:', errorMessage);

      // Check if user cancelled
      if (errorCode === 'auth/popup-closed-by-user' ||
          errorCode === 'sign_in_cancelled' ||
          errorCode === 'cancelled' ||
          errorMessage === 'Sign-in was cancelled') {
        // User cancelled, no need to show error
        return;
      }

      // Show error and continue in local mode
      Alert.alert(
        'Sign-In Failed',
        'Error: ' + errorMessage + '\n\nError Code: ' + errorCode + '\n\nContinuing in Local Mode (no cloud sync)',
        [{ text: 'OK' }]
      );

      // Don't throw - stay in local mode
    }
  };

  // Notification popup handlers
  const handleAcceptFriendRequestFromPopup = async () => {
    if (notificationRequest) {
      await acceptFriendRequest(notificationRequest.id);
      setShowNotificationPopup(false);
      setNotificationRequest(null);
    }
  };

  const handleDeclineFriendRequestFromPopup = async () => {
    if (notificationRequest) {
      await declineFriendRequest(notificationRequest.id);
      setShowNotificationPopup(false);
      setNotificationRequest(null);
    }
  };

  const handleDismissNotificationPopup = () => {
    setShowNotificationPopup(false);
    setNotificationRequest(null);
  };

  // iOS auto-save: Extract a single recipe (returns recipe object or null)
  const extractRecipeData = async (recipeUrl) => {
    try {
      const RecipeExtractor = require('../../RecipeExtractor').default;
      const extractor = new RecipeExtractor();
      const result = await extractor.extract(recipeUrl);

      if (result.success) {
        const recipe = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          url: recipeUrl,
          ...result.data,
          extractedAt: new Date().toISOString(),
          source: result.source,
          folder: 'All Recipes',
          isFavorite: false,
        };
        console.log('🍎 [iOS] Extracted recipe:', recipe.name);
        return { success: true, recipe };
      }
      console.log('🍎 [iOS] Extraction failed for:', recipeUrl);
      return { success: false, url: recipeUrl };
    } catch (error) {
      console.error('🍎 [iOS] Extraction error:', error);
      return { success: false, url: recipeUrl };
    }
  };

  // iOS batch auto-save: Extract all recipes first, then save all at once
  const extractAndAutoSaveBatch = async (urls) => {
    console.log(`🍎 [iOS] Processing batch of ${urls.length} recipes...`);

    // Step 1: Extract all recipes first (no saving yet)
    const extractedRecipes = [];
    const failedUrls = [];

    for (const url of urls) {
      const result = await extractRecipeData(url);
      if (result.success) {
        extractedRecipes.push(result.recipe);
      } else {
        failedUrls.push(url);
      }
      // Small delay between extractions
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Step 2: Save all extracted recipes at once using batch save
    let savedNames = [];
    if (extractedRecipes.length > 0) {
      const saved = await saveRecipesBatch(extractedRecipes);
      if (saved) {
        savedNames = extractedRecipes.map(r => r.name).filter(Boolean);
        console.log(`🍎 [iOS] Batch saved ${extractedRecipes.length} recipes`);
      } else {
        // If batch save failed, count all as failed
        failedUrls.push(...extractedRecipes.map(r => r.url));
        extractedRecipes.length = 0;
      }
    }

    const succeeded = extractedRecipes.length;
    const failed = failedUrls.length;

    // Step 3: Show one summary alert
    if (succeeded > 0 && failed === 0) {
      Alert.alert(
        `✅ ${succeeded} Recipe${succeeded > 1 ? 's' : ''} Saved`,
        savedNames.length > 0 ? savedNames.join('\n') : 'All recipes saved successfully!'
      );
    } else if (succeeded > 0 && failed > 0) {
      Alert.alert(
        `⚠️ Partially Saved`,
        `${succeeded} saved, ${failed} failed\n\n${savedNames.length > 0 ? 'Saved: ' + savedNames.join(', ') : ''}`
      );
    } else if (failed > 0) {
      Alert.alert(
        `❌ Import Failed`,
        `Could not extract ${failed} recipe${failed > 1 ? 's' : ''}`
      );
    }
  };

  // Share intent handler - iOS auto-saves, Android shows save screen
  useShareIntent((sharedUrlOrUrls, isBatch = false) => {
    if (Platform.OS === 'ios') {
      // iOS: Auto-save (Share Extension already showed preview)
      if (isBatch && Array.isArray(sharedUrlOrUrls)) {
        // Batch of URLs from App Groups
        extractAndAutoSaveBatch(sharedUrlOrUrls);
      } else {
        // Single URL (from URL scheme)
        extractAndAutoSaveBatch([sharedUrlOrUrls]);
      }
    } else {
      // Android: Show save screen for confirmation
      const url = Array.isArray(sharedUrlOrUrls) ? sharedUrlOrUrls[0] : sharedUrlOrUrls;
      setUrl(url);
      extractRecipe(url);
    }
  });

  // Grocery list handlers with undo support
  const handleAddToGroceryList = async (selectedItems) => {
    if (!selectedRecipe || selectedItems.length === 0) return;

    // Save state for undo
    const previousList = JSON.parse(JSON.stringify(groceryList));
    addUndoAction({
      type: 'grocery_add',
      description: `Add ${selectedItems.length} Items`,
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    // Add all selected items to grocery list
    const ingredientTexts = selectedItems.map(item => item.text);
    await addItemsToGroceryList(ingredientTexts, selectedRecipe, selectedItems[0]?.section || 'main');
  };

  const handleToggleGroceryItem = async (itemId) => {
    const previousList = JSON.parse(JSON.stringify(groceryList));
    const item = groceryList.find(i => i.id === itemId);
    if (!item) return;

    addUndoAction({
      type: 'grocery_toggle',
      description: item.checked ? 'Uncheck Item' : 'Check Item',
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    await toggleItemChecked(itemId);
  };

  const handleRemoveGroceryItem = async (itemId) => {
    const previousList = JSON.parse(JSON.stringify(groceryList));
    const item = groceryList.find(i => i.id === itemId);
    if (!item) return;

    addUndoAction({
      type: 'grocery_remove',
      description: 'Remove Item',
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    await removeGroceryItem(itemId);
  };

  const handleClearCheckedItems = async () => {
    const checkedItems = groceryList.filter(item => item.checked);
    if (checkedItems.length === 0) return;

    const previousList = JSON.parse(JSON.stringify(groceryList));
    addUndoAction({
      type: 'grocery_clear_checked',
      description: `Clear ${checkedItems.length} Items`,
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    await clearCheckedItems();
  };

  const handleClearAllItems = async () => {
    const itemCount = groceryList.length;
    if (itemCount === 0) return;

    const previousList = JSON.parse(JSON.stringify(groceryList));
    addUndoAction({
      type: 'grocery_clear_all',
      description: `Clear All (${itemCount} items)`,
      undo: async () => {
        await restoreGroceryList(previousList);
      }
    });

    await clearAllItems();
  };

  // Multiselect handlers
  const enterMultiselectMode = (recipeId) => {
    setMultiselectMode(true);
    setSelectedRecipes(new Set([recipeId]));
  };

  const exitMultiselectMode = () => {
    setMultiselectMode(false);
    setSelectedRecipes(new Set());
  };

  const toggleRecipeSelection = (recipeId) => {
    setSelectedRecipes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recipeId)) {
        newSet.delete(recipeId);
      } else {
        newSet.add(recipeId);
      }
      return newSet;
    });
  };

  const deleteSelectedRecipes = async () => {
    if (selectedRecipes.size === 0) return;

    const recipeCount = selectedRecipes.size;
    const recipeIds = Array.from(selectedRecipes);

    // Check if we're in Recently Deleted - if so, permanently delete
    const isPermanentDelete = currentFolder === 'Recently Deleted';

    Alert.alert(
      isPermanentDelete ? 'Permanently Delete Recipes' : 'Delete Recipes',
      isPermanentDelete
        ? `Permanently delete ${recipeCount} recipe${recipeCount > 1 ? 's' : ''}? This cannot be undone.`
        : `Delete ${recipeCount} recipe${recipeCount > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isPermanentDelete ? 'Delete Forever' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Exit multiselect mode FIRST to update UI immediately
            exitMultiselectMode();

            const { saveRecipes, loadRecipes } = require('../utils/storage');
            const userId = user?.uid || null;

            // Load fresh from storage to avoid stale closure issues (user-specific)
            const currentRecipes = await loadRecipes(userId);

            if (isPermanentDelete) {
              // Permanently delete: remove from array entirely
              const updatedRecipes = currentRecipes.filter(r => !recipeIds.includes(r.id));
              await saveRecipes(updatedRecipes, userId);

              // Reload UI from storage
              await reloadFromStorage();

              // Delete from Supabase in background if user is signed in
              if (user) {
                recipeIds.forEach(recipeId => {
                  saveRecipeToDatabase(user.uid, { id: recipeId, deletedAt: Date.now() }).catch(console.error);
                });
                console.log(`✅ Permanently deleted ${recipeCount} recipes`);
              }
            } else {
              // Soft delete: mark all selected recipes with deletedAt timestamp
              const now = Date.now();
              const updatedRecipes = currentRecipes.map(r =>
                recipeIds.includes(r.id) ? { ...r, deletedAt: now, updatedAt: now } : r
              );
              await saveRecipes(updatedRecipes, userId);

              // Reload UI from storage
              await reloadFromStorage();

              // Sync to Supabase in background if user is signed in
              if (user) {
                recipeIds.forEach(recipeId => {
                  const deletedRecipe = updatedRecipes.find(r => r.id === recipeId);
                  if (deletedRecipe) {
                    saveRecipeToDatabase(user.uid, deletedRecipe).catch(console.error);
                  }
                });
                console.log(`✅ Synced ${recipeCount} soft-deleted recipes`);
              }
            }
          }
        }
      ]
    );
  };

  const moveSelectedRecipesToFolder = () => {
    if (selectedRecipes.size === 0) return;
    setShowMoveToFolder(true);
  };

  const handleMoveSelectedToFolder = async (targetFolder) => {
    if (selectedRecipes.size === 0) return;

    const recipeCount = selectedRecipes.size;
    const recipeIds = Array.from(selectedRecipes);

    // Move all selected recipes to the target folder in one batch operation
    const success = await moveManyToFolder(recipeIds, targetFolder);

    setShowMoveToFolder(false);
    exitMultiselectMode();

    if (success) {
      Alert.alert('✅ Success', `Moved ${recipeCount} recipe${recipeCount > 1 ? 's' : ''} to ${targetFolder}`);
    } else {
      Alert.alert('Error', 'Failed to move recipes');
    }
  };

  // Base64 encode helper (handles Unicode properly)
  const encodeBase64 = (str) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // Convert Unicode string to UTF-8 bytes
    const utf8 = unescape(encodeURIComponent(str));
    let result = '';

    for (let i = 0; i < utf8.length; i += 3) {
      const byte1 = utf8.charCodeAt(i);
      const byte2 = i + 1 < utf8.length ? utf8.charCodeAt(i + 1) : 0;
      const byte3 = i + 2 < utf8.length ? utf8.charCodeAt(i + 2) : 0;

      const encoded1 = byte1 >> 2;
      const encoded2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
      const encoded3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
      const encoded4 = byte3 & 0x3f;

      result += chars[encoded1];
      result += chars[encoded2];
      result += i + 1 < utf8.length ? chars[encoded3] : '=';
      result += i + 2 < utf8.length ? chars[encoded4] : '=';
    }

    return result;
  };

  // Base64 decode helper (handles Unicode properly)
  const decodeBase64 = (encoded) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // Remove any whitespace and padding
    encoded = encoded.replace(/[\s=]+$/, '');
    let result = '';

    for (let i = 0; i < encoded.length; i += 4) {
      const enc1 = chars.indexOf(encoded[i]);
      const enc2 = chars.indexOf(encoded[i + 1]);
      const enc3 = i + 2 < encoded.length ? chars.indexOf(encoded[i + 2]) : -1;
      const enc4 = i + 3 < encoded.length ? chars.indexOf(encoded[i + 3]) : -1;

      if (enc1 === -1 || enc2 === -1) {
        throw new Error('Invalid Base64 character');
      }

      const byte1 = (enc1 << 2) | (enc2 >> 4);
      result += String.fromCharCode(byte1);

      if (enc3 !== -1) {
        const byte2 = ((enc2 & 0x0f) << 4) | (enc3 >> 2);
        result += String.fromCharCode(byte2);
      }

      if (enc4 !== -1) {
        const byte3 = ((enc3 & 0x03) << 6) | enc4;
        result += String.fromCharCode(byte3);
      }
    }

    // Convert UTF-8 bytes back to Unicode string
    try {
      return decodeURIComponent(escape(result));
    } catch (e) {
      console.error('UTF-8 decode error:', e);
      return result;
    }
  };

  // Copy to clipboard and show share dialog
  const copyToClipboard = async (text, title) => {
    try {
      await Clipboard.setString(text);
      Alert.alert(
        '✅ Copied!',
        `${title}\n\nThe code has been copied to your clipboard. You can now:\n\n1. Share it via any app\n2. Or paste it directly in Import (📥) to test`,
        [
          { text: 'OK' },
          {
            text: 'Share',
            onPress: () => Share.share({ message: text, title })
          }
        ]
      );
    } catch (error) {
      console.error('Clipboard error:', error);
      // Fallback to share dialog
      await Share.share({ message: text, title });
    }
  };

  // Share recipe handler
  const shareRecipe = async (recipe) => {
    // If user is logged in and has friends, offer both options
    if (user && profile && friends.length > 0) {
      Alert.alert(
        'Share Recipe',
        `How do you want to share "${recipe.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share to Friends',
            onPress: () => {
              // Clean recipe data for sharing
              // Clean recipe for sharing - remove undefined fields and system fields
              const { deletedAt, id, ...cleanRecipe } = recipe;
              setShareItem({
                type: 'recipe',
                data: cleanRecipe,
                name: recipe.title,
              });
              setShowShareToFriends(true);
            }
          },
          {
            text: 'Copy Code',
            onPress: async () => {
              try {
                const recipeData = {
                  version: '1.0',
                  type: 'recipe',
                  data: {
                    ...recipe,
                    deletedAt: undefined,
                  }
                };
                const jsonString = JSON.stringify(recipeData);
                const encoded = encodeBase64(jsonString);
                const shareCode = `BUNCHES_RECIPE:${encoded}`;
                await copyToClipboard(shareCode, `Recipe: ${recipe.title}`);
              } catch (error) {
                console.error('Error sharing recipe:', error);
                Alert.alert('Error', 'Failed to share recipe');
              }
            }
          }
        ]
      );
    } else {
      // Fallback to clipboard sharing
      try {
        const recipeData = {
          version: '1.0',
          type: 'recipe',
          data: {
            ...recipe,
            deletedAt: undefined,
          }
        };
        const jsonString = JSON.stringify(recipeData);
        const encoded = encodeBase64(jsonString);
        const shareCode = `BUNCHES_RECIPE:${encoded}`;
        await copyToClipboard(shareCode, `Recipe: ${recipe.title}`);
      } catch (error) {
        console.error('Error sharing recipe:', error);
        Alert.alert('Error', 'Failed to share recipe');
      }
    }
  };

  // Share entire cookbook handler
  const shareCookbook = async (cookbookName) => {
    const recipesInCookbook = getFilteredRecipes(cookbookName).filter(r => !r.deletedAt);

    if (recipesInCookbook.length === 0) {
      Alert.alert('Empty Cookbook', 'This cookbook has no recipes to share');
      return;
    }

    // If user is logged in and has friends, offer both options
    if (user && profile && friends.length > 0) {
      Alert.alert(
        'Share Cookbook',
        `How do you want to share "${cookbookName}" (${recipesInCookbook.length} recipes)?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share to Friends',
            onPress: () => {
              // Clean recipes for sharing
              // Clean recipes for sharing - remove undefined fields and system fields
              const cleanedRecipes = recipesInCookbook.map(r => {
                const { deletedAt, id, ...cleanRecipe } = r;
                return cleanRecipe;
              });
              setShareItem({
                type: 'cookbook',
                data: cleanedRecipes,
                name: cookbookName,
              });
              setShowShareToFriends(true);
            }
          },
          {
            text: 'Copy Code',
            onPress: async () => {
              try {
                const cookbookData = {
                  version: '1.0',
                  type: 'cookbook',
                  name: cookbookName,
                  data: recipesInCookbook.map(r => ({
                    ...r,
                    deletedAt: undefined,
                  }))
                };
                const jsonString = JSON.stringify(cookbookData);
                const encoded = encodeBase64(jsonString);
                const shareCode = `BUNCHES_COOKBOOK:${encoded}`;
                await copyToClipboard(shareCode, `Cookbook: ${cookbookName} (${recipesInCookbook.length} recipes)`);
              } catch (error) {
                console.error('Error sharing cookbook:', error);
                Alert.alert('Error', 'Failed to share cookbook');
              }
            }
          }
        ]
      );
    } else {
      // Fallback to clipboard sharing
      try {
        const cookbookData = {
          version: '1.0',
          type: 'cookbook',
          name: cookbookName,
          data: recipesInCookbook.map(r => ({
            ...r,
            deletedAt: undefined,
          }))
        };
        const jsonString = JSON.stringify(cookbookData);
        const encoded = encodeBase64(jsonString);
        const shareCode = `BUNCHES_COOKBOOK:${encoded}`;
        await copyToClipboard(shareCode, `Cookbook: ${cookbookName} (${recipesInCookbook.length} recipes)`);
      } catch (error) {
        console.error('Error sharing cookbook:', error);
        Alert.alert('Error', 'Failed to share cookbook');
      }
    }
  };

  // Import recipe from code or JSON - now shows preview first
  const importRecipe = async (inputText) => {
    try {
      let cleanedInput = inputText.trim();
      let jsonString = cleanedInput;

      // Check if it's a BUNCHES code (Base64 encoded)
      if (cleanedInput.includes('BUNCHES_RECIPE:') || cleanedInput.includes('BUNCHES_COOKBOOK:')) {
        const recipeMatch = cleanedInput.match(/BUNCHES_RECIPE:([A-Za-z0-9+/=]+)/);
        const cookbookMatch = cleanedInput.match(/BUNCHES_COOKBOOK:([A-Za-z0-9+/=]+)/);

        if (recipeMatch) {
          jsonString = decodeBase64(recipeMatch[1]);
        } else if (cookbookMatch) {
          jsonString = decodeBase64(cookbookMatch[1]);
        } else {
          throw new Error('Could not find valid BUNCHES code in the text');
        }
      }

      const parsed = JSON.parse(jsonString);

      // For single recipes, show preview screen instead of direct import
      if (parsed.type === 'recipe' && parsed.version === '1.0') {
        const recipeData = parsed.data;
        const previewRecipe = {
          ...recipeData,
          id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        // Show preview using the same flow as URL extraction
        setExtractedRecipe(previewRecipe);
        setCurrentScreen('saveRecipe');
        setShowImport(false);
        setImportText('');
      } else {
        // For cookbooks or other types, use direct import
        await processImport(parsed, importTargetFolder, saveRecipe);
      }
    } catch (error) {
      Alert.alert(
        '❌ Import Error',
        `Failed to import: ${error.message}\n\nPlease copy the ENTIRE code starting with BUNCHES_RECIPE: or BUNCHES_COOKBOOK:`
      );
    }
  };

  // Helper to process parsed import data
  const processImport = async (parsed, targetFolder, saveRecipe) => {
    if (parsed.version !== '1.0') {
      throw new Error('Unsupported format version: ' + parsed.version);
    }

    if (parsed.type === 'recipe') {
      const recipeData = parsed.data;
      const newRecipe = {
        ...recipeData,
        id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        folder: targetFolder === 'Favorites' || targetFolder === 'Recently Deleted' ? 'All Recipes' : targetFolder,
      };

      await saveRecipe(newRecipe);
      Alert.alert('✅ Success', `Recipe "${newRecipe.title}" imported to ${newRecipe.folder}!`);
    } else if (parsed.type === 'cookbook') {
      const recipesToImport = parsed.data;

      // Determine target folder for all recipes in the cookbook
      const finalFolder = targetFolder === 'Favorites' || targetFolder === 'Recently Deleted' ? 'All Recipes' : targetFolder;

      // Batch import: create all recipes with new IDs and target folder
      const newRecipes = recipesToImport.map((recipeData, index) => ({
        ...recipeData,
        id: `recipe-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        folder: finalFolder, // Override original folder
        deletedAt: undefined, // Remove any deletedAt
      }));

      // Save all at once by prepending to existing recipes
      const { saveRecipes } = require('../utils/storage');
      const currentRecipes = recipes.filter(r => !r.deletedAt); // Get current non-deleted recipes
      await saveRecipes([...newRecipes, ...currentRecipes], user?.uid || null);

      // Reload to reflect changes
      await refreshRecipes();

      Alert.alert('✅ Success', `Imported ${newRecipes.length} recipe${newRecipes.length > 1 ? 's' : ''} from "${parsed.name}" to ${finalFolder}`);
    } else {
      throw new Error('Unknown import type: ' + parsed.type);
    }
  };

  // Cookbook operations with recipe updates
  const addFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Error', 'Please enter a cookbook name');
      return;
    }

    const success = await addFolderBase(newFolderName);
    if (success) {
      setNewFolderName('');
      setShowAddFolder(false);
      setTimeout(() => setShowFolderManager(true), 100);
    }
  };

  const renameFolder = async () => {
    const result = await renameFolderBase(editingFolder, editingFolderName);

    if (result.success) {
      // Update all recipes in that folder
      const recipesInFolder = recipes.filter(r => r.folder === result.oldName);
      for (const recipe of recipesInFolder) {
        await moveRecipeToFolder(recipe.id, result.newName);
      }

      setEditingFolder(null);
      setEditingFolderName('');
    }
  };

  const deleteFolder = async (folderName) => {
    const recipesInFolder = recipes.filter(r => r.folder === folderName);
    const success = await deleteFolderBase(folderName, recipesInFolder.length);

    if (success) {
      // Move recipes to "All Recipes"
      for (const recipe of recipesInFolder) {
        await moveRecipeToFolder(recipe.id, 'All Recipes');
      }
    }
  };

  // Handle move to folder
  const handleMoveToFolder = (newFolder) => {
    // Check if we're in multiselect mode
    if (multiselectMode && selectedRecipes.size > 0) {
      handleMoveSelectedToFolder(newFolder);
    } else if (selectedRecipe) {
      moveRecipeToFolder(selectedRecipe.id, newFolder);
      setShowMoveToFolder(false);
    }
  };

  // Android back button handler - handles all modals and screens
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Priority order for back button
      if (showIngredientSearch) {
        setShowIngredientSearch(false);
        return true;
      }
      if (showImport) {
        setShowImport(false);
        setImportText('');
        return true;
      }
      if (showGroceryList) {
        setShowGroceryList(false);
        return true;
      }
      if (showMoveToFolder) {
        setShowMoveToFolder(false);
        return true;
      }
      if (editingFolder) {
        setEditingFolder(null);
        setEditingFolderName('');
        return true;
      }
      if (showAddFolder) {
        setShowAddFolder(false);
        return true;
      }
      if (selectedRecipe) {
        setSelectedRecipe(null);
        return true;
      }
      if (showFolderManager) {
        setShowFolderManager(false);
        return true;
      }
      // Handle screen navigation - go back to dashboard
      if (currentScreen !== 'recipes') {
        setCurrentScreen('recipes');
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [selectedRecipe, showFolderManager, showAddFolder, showMoveToFolder, editingFolder, showGroceryList, showImport, showIngredientSearch, currentScreen]);

  const filteredRecipes = getFilteredRecipes(currentFolder);
  const nonDeletedRecipeCount = recipes.filter(r => !r.deletedAt).length;

  // Sort recipes based on selected sort option
  const sortedRecipes = useMemo(() => {
    const recipesToSort = [...filteredRecipes];

    switch (sortBy) {
      case 'alphabetical':
        recipesToSort.sort((a, b) => {
          const titleA = a.title.toLowerCase();
          const titleB = b.title.toLowerCase();
          return sortOrder === 'asc'
            ? titleA.localeCompare(titleB)
            : titleB.localeCompare(titleA);
        });
        break;

      case 'dateAdded':
        recipesToSort.sort((a, b) => {
          const dateA = a.createdAt || 0;
          const dateB = b.createdAt || 0;
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        break;

      case 'dateModified':
        recipesToSort.sort((a, b) => {
          const dateA = a.modifiedAt || a.createdAt || 0;
          const dateB = b.modifiedAt || b.createdAt || 0;
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        break;

      default:
        break;
    }

    return recipesToSort;
  }, [filteredRecipes, sortBy, sortOrder]);

  // Reusable Swipeable Undo Button Component
  const renderSwipeableUndoButton = () => {
    if (!showUndoButton || !canUndo || undoButtonDismissed) return null;

    return (
      <Animated.View
        style={[
          styles.globalUndoButton,
          {
            transform: [
              { translateX: undoButtonPosition.x },
              { translateY: undoButtonPosition.y }
            ]
          }
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={performUndo}
          activeOpacity={0.8}
          style={styles.undoButtonTouchable}
        >
          <Text style={styles.undoButtonIcon}>↶</Text>
          <Text style={styles.undoButtonLabel}>Undo</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render different screens based on currentScreen state
  if (currentScreen === 'saveRecipe') {
    return (
      <SaveRecipeScreen
        recipe={extractedRecipe}
        folders={folders}
        onSave={handleSaveExtractedRecipe}
        onCancel={handleCancelSave}
      />
    );
  }

  if (currentScreen === 'create') {
    return (
      <SafeAreaView style={styles.container}>
        <CreateRecipeScreen
          onSave={handleCreateRecipe}
          onClose={() => setCurrentScreen('recipes')}
          folders={folders.filter(f => f !== 'Favorites' && f !== 'Recently Deleted')}
        />

        {/* Swipeable Undo Button */}
        {renderSwipeableUndoButton()}

        {/* Bottom Navigation Bar */}
        {renderNavigationBar()}
      </SafeAreaView>
    );
  }

  if (currentScreen === 'saveRecipe') {
    return (
      <SafeAreaView style={styles.container}>
        <SaveRecipeScreen
          recipe={extractedRecipe}
          folders={folders.filter(f => f !== 'Favorites' && f !== 'Recently Deleted')}
          onSave={handleSaveExtractedRecipe}
          onCancel={handleCancelSave}
        />

        {/* Swipeable Undo Button */}
        {renderSwipeableUndoButton()}

        {/* Bottom Navigation Bar */}
        {renderNavigationBar()}
      </SafeAreaView>
    );
  }

  // Main app container with all tabs inline
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header - only shown on recipes tab */}
      {currentScreen === 'recipes' && (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setCurrentFolder('All Recipes')}>
              <Text style={styles.headerTitle}>Bunches</Text>
            </TouchableOpacity>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                onPress={() => setCurrentScreen('create')}
                style={styles.iconHeaderButton}
              >
                <Text style={styles.iconHeaderButtonText}>➕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowIngredientSearch(true)}
                style={styles.iconHeaderButton}
              >
                <Text style={styles.iconHeaderButtonText}>🔍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowFolderManager(true)}
                style={styles.iconHeaderButton}
              >
                <Text style={styles.iconHeaderButtonText}>📂</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sort/Filter Bar */}
          <View style={styles.sortBar}>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setShowSortDropdown(!showSortDropdown)}
            >
              <Text style={styles.sortButtonText}>
                Sort: {sortBy === 'alphabetical' ? 'A-Z' : sortBy === 'dateAdded' ? 'Date Added' : 'Date Modified'}
                {sortOrder === 'asc' ? ' ↑' : ' ↓'}
              </Text>
            </TouchableOpacity>
            <View style={styles.sortBarRight}>
              <TouchableOpacity
                style={styles.viewModeButton}
                onPress={() => setViewMode(viewMode === 'list' ? 'photo' : 'list')}
              >
                <Text style={styles.viewModeIcon}>{viewMode === 'list' ? '🖼️' : '📝'}</Text>
              </TouchableOpacity>
              <Text style={styles.recipeCount}>{sortedRecipes.length} recipe{sortedRecipes.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {/* Sort Dropdown Menu */}
          {showSortDropdown && (
            <View style={styles.sortDropdown}>
              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'alphabetical' && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy('alphabetical');
                  setSortOrder(sortBy === 'alphabetical' && sortOrder === 'asc' ? 'desc' : 'asc');
                  setShowSortDropdown(false);
                }}
              >
                <Text style={styles.sortOptionText}>Alphabetical (A-Z)</Text>
                {sortBy === 'alphabetical' && <Text style={styles.sortOptionCheck}>✓</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'dateAdded' && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy('dateAdded');
                  setSortOrder('desc'); // Newest first by default
                  setShowSortDropdown(false);
                }}
              >
                <Text style={styles.sortOptionText}>Date Added (Newest First)</Text>
                {sortBy === 'dateAdded' && sortOrder === 'desc' && <Text style={styles.sortOptionCheck}>✓</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'dateAdded' && sortOrder === 'asc' && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy('dateAdded');
                  setSortOrder('asc'); // Oldest first
                  setShowSortDropdown(false);
                }}
              >
                <Text style={styles.sortOptionText}>Date Added (Oldest First)</Text>
                {sortBy === 'dateAdded' && sortOrder === 'asc' && <Text style={styles.sortOptionCheck}>✓</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortOption, sortBy === 'dateModified' && styles.sortOptionActive]}
                onPress={() => {
                  setSortBy('dateModified');
                  setSortOrder('desc'); // Most recently modified first
                  setShowSortDropdown(false);
                }}
              >
                <Text style={styles.sortOptionText}>Recently Modified</Text>
                {sortBy === 'dateModified' && <Text style={styles.sortOptionCheck}>✓</Text>}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Tab Content - Render different content based on currentScreen */}
      {currentScreen === 'social' && (
        <SocialModal
          visible={true}
          onClose={() => setCurrentScreen('recipes')}
          friends={friends}
          friendRequests={friendRequests}
          sharedItems={sharedItems}
          onSearchUsers={searchUsers}
          onSendFriendRequest={sendFriendRequest}
          onAcceptFriendRequest={acceptFriendRequest}
          onDeclineFriendRequest={declineFriendRequest}
          onRemoveFriend={removeFriend}
          onImportSharedItem={importSharedItem}
          onDeclineSharedItem={declineSharedItem}
          onImportRecipe={saveRecipe}
          profile={profile}
          onChangeUsername={changeUsername}
          checkUsernameAvailable={checkUsernameAvailable}
        />
      )}

      {currentScreen === 'settings' && (
        <SettingsScreen
          onClose={() => setCurrentScreen('recipes')}
          onClearAllData={handleClearAllData}
          recipeCount={nonDeletedRecipeCount}
          user={user}
          onSignOut={handleSignOut}
          onSignIn={handleSignIn}
          profile={profile}
          onOpenSocial={() => setCurrentScreen('social')}
          onUpdatePrivacySettings={updatePrivacySettings}
          friends={friends}
          onChangeUsername={changeUsername}
          checkUsernameAvailable={checkUsernameAvailable}
          recipes={recipes}
          folders={folders}
          onRestoreBackup={handleRestoreBackup}
          onSyncNow={handleSyncNow}
        />
      )}

      {currentScreen === 'grocery' && (
        <GroceryList
          visible={true}
          onClose={() => setCurrentScreen('recipes')}
          groceryList={groceryList}
          onToggleItem={handleToggleGroceryItem}
          onRemoveItem={handleRemoveGroceryItem}
          onClearChecked={handleClearCheckedItems}
          onClearAll={handleClearAllItems}
          showUndoButton={showUndoButton}
          canUndo={canUndo}
          lastActionDescription={lastActionDescription}
          performUndo={performUndo}
        />
      )}

      {/* Recipe List - shown when currentScreen === 'recipes' */}
      {currentScreen === 'recipes' && (
        loadingRecipes ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading recipes...</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Sticky multiselect toolbar - outside ScrollView */}
            {multiselectMode && (
              <View style={styles.multiselectToolbar}>
                <TouchableOpacity onPress={exitMultiselectMode} style={styles.toolbarButton}>
                  <Text style={styles.toolbarButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.toolbarTitle}>
                  {selectedRecipes.size} selected
                </Text>
                <View style={styles.toolbarActions}>
                  <TouchableOpacity
                    onPress={moveSelectedRecipesToFolder}
                    style={[styles.toolbarButton, styles.folderButton]}
                    disabled={selectedRecipes.size === 0}
                  >
                    <Text style={[styles.toolbarButtonText, styles.folderButtonText]}>
                      Move
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={deleteSelectedRecipes}
                    style={[styles.toolbarButton, styles.deleteButton]}
                    disabled={selectedRecipes.size === 0}
                  >
                    <Text style={[styles.toolbarButtonText, styles.deleteButtonText]}>
                      🗑️ Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <ScrollView style={styles.recipeList}>
          {sortedRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No recipes yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Share a recipe from your browser or paste a URL above
              </Text>
            </View>
          ) : (
            <>
              {sortedRecipes.map((recipe) => {
                const isSelected = selectedRecipes.has(recipe.id);
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[
                      styles.recipeCard,
                      isSelected && styles.recipeCardSelected
                    ]}
                    onPress={() => {
                      if (multiselectMode) {
                        toggleRecipeSelection(recipe.id);
                      } else {
                        setSelectedRecipe(recipe);
                      }
                    }}
                    onLongPress={() => {
                      if (!multiselectMode) {
                        enterMultiselectMode(recipe.id);
                      }
                    }}
                    delayLongPress={500}
                  >
                    {multiselectMode && (
                      <View style={styles.checkbox}>
                        {isSelected && (
                          <View style={styles.checkboxChecked}>
                            <Text style={styles.checkboxCheck}>✓</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {viewMode === 'photo' && recipe.image_url && (
                      <Image
                        source={{ uri: recipe.image_url }}
                        style={styles.recipeImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.recipeCardContent}>
                      {/* Folder badge - shown if recipe is in a cookbook */}
                      {recipe.folder && recipe.folder !== 'All Recipes' && (
                        <Text style={styles.recipeCardFolder}>{recipe.folder}</Text>
                      )}
                      <View style={styles.recipeCardHeader}>
                        <Text style={styles.recipeTitle}>{recipe.title}</Text>
                        {!multiselectMode && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleFavorite(recipe.id);
                            }}
                            style={styles.favoriteButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.favoriteIcon}>
                              {recipe.isFavorite ? '⭐' : '☆'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.recipeMeta} numberOfLines={1}>
                        {recipe.ingredients ? (typeof recipe.ingredients === 'string' ? recipe.ingredients.split('\n').filter(l => l.trim()).length : Object.values(recipe.ingredients).flat().length) : 0} ingredients
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
          </View>
        )
      )}

      {/* Folder Manager Modal - shown on any tab */}
      <Modal
        visible={showFolderManager}
        animationType="slide"
        onRequestClose={() => setShowFolderManager(false)}
      >
        <View style={styles.modalContainer}>
          <StatusBar style="light" hidden={true} />
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFolderManager(false)}>
              <Text style={styles.modalCloseButton}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Cookbooks</Text>
            {currentFolder === 'Recently Deleted' ? (
              <TouchableOpacity onPress={emptyRecentlyDeleted}>
                <Text style={styles.addFolderHeaderButton}>Empty</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => {
                setShowFolderManager(false);
                setTimeout(() => setShowAddFolder(true), 100);
              }}>
                <Text style={styles.addFolderHeaderButton}>+ New</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalScrollContent}
          >
            <View style={styles.folderSection}>
              <Text style={styles.folderSectionTitle}>System Cookbooks</Text>
              {folders.filter(f => f === 'All Recipes' || f === 'Favorites' || f === 'Recently Deleted').map((folder) => {
                let icon = '📚';
                let count = recipes.length;

                if (folder === 'Favorites') {
                  icon = '⭐';
                  count = recipes.filter(r => r.isFavorite && !r.deletedAt).length;
                } else if (folder === 'Recently Deleted') {
                  icon = '🗑️';
                  count = recipes.filter(r => r.deletedAt).length;
                } else {
                  // All Recipes
                  count = recipes.filter(r => !r.deletedAt).length;
                }

                return (
                  <TouchableOpacity
                    key={folder}
                    style={[
                      styles.folderManagerItem,
                      currentFolder === folder && styles.folderManagerItemActive
                    ]}
                    onPress={() => {
                      setCurrentFolder(folder);
                      setShowFolderManager(false);
                    }}
                    onLongPress={() => {
                      if (folder !== 'Recently Deleted') {
                        Alert.alert(
                          folder,
                          'Share this cookbook?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Share',
                              onPress: () => shareCookbook(folder)
                            }
                          ]
                        );
                      }
                    }}
                    delayLongPress={500}
                  >
                    <View style={styles.folderManagerItemLeft}>
                      <Text style={styles.folderManagerIcon}>{icon}</Text>
                      <Text style={[
                        styles.folderManagerItemText,
                        currentFolder === folder && styles.folderManagerItemTextActive
                      ]}>
                        {folder}
                      </Text>
                    </View>
                    <Text style={styles.folderManagerCount}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.folderSection}>
              <Text style={styles.folderSectionTitle}>My Cookbooks</Text>
              {getCustomFolders().length === 0 ? (
                <View style={styles.emptyFolders}>
                  <Text style={styles.emptyFoldersText}>No custom cookbooks yet</Text>
                  <Text style={styles.emptyFoldersSubtext}>Tap "+ New" to create one</Text>
                </View>
              ) : (
                getCustomFolders().map((folder) => {
                  // Count only non-deleted recipes in this folder
                  const recipeCount = recipes.filter(r =>
                    r.folder === folder && !r.deletedAt
                  ).length;

                  // Debug: log what we're finding
                  console.log(`Folder: ${folder}`);
                  console.log(`Total recipes in folder: ${recipes.filter(r => r.folder === folder).length}`);
                  console.log(`Non-deleted recipes: ${recipeCount}`);

                  return (
                    <TouchableOpacity
                      key={folder}
                      style={[
                        styles.folderManagerItem,
                        currentFolder === folder && styles.folderManagerItemActive
                      ]}
                      onPress={() => {
                        setCurrentFolder(folder);
                        setShowFolderManager(false);
                      }}
                      delayLongPress={300}
                      onLongPress={() => {
                        Alert.alert(
                          folder,
                          'Choose an action:',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Share',
                              onPress: () => shareCookbook(folder)
                            },
                            {
                              text: 'Rename',
                              onPress: () => {
                                setEditingFolder(folder);
                                setEditingFolderName(folder);
                              }
                            },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => deleteFolder(folder)
                            }
                          ]
                        );
                      }}
                    >
                      <View style={styles.folderManagerItemLeft}>
                        <Text style={styles.folderManagerIcon}>📖</Text>
                        <Text style={[
                          styles.folderManagerItemText,
                          currentFolder === folder && styles.folderManagerItemTextActive
                        ]}>
                          {folder}
                        </Text>
                      </View>
                      <Text style={styles.folderManagerCount}>
                        {recipeCount}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <Modal
          visible={!!selectedRecipe}
          animationType="slide"
          onRequestClose={() => setSelectedRecipe(null)}
        >
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <StatusBar style="light" hidden={true} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
                <Text style={styles.modalCloseButton}>✕ Close</Text>
              </TouchableOpacity>
              {selectedRecipe.deletedAt ? (
                // Actions for deleted recipes
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={async () => {
                      await restoreRecipe(selectedRecipe.id);
                      setSelectedRecipe(null);
                    }}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>♻️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const recipeId = selectedRecipe.id;
                      Alert.alert(
                        'Permanently Delete?',
                        'This will permanently delete the recipe. This cannot be undone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete Forever',
                            style: 'destructive',
                            onPress: async () => {
                              // Close modal first
                              setSelectedRecipe(null);

                              // Delete and reload
                              await permanentlyDeleteRecipe(recipeId);
                              await reloadFromStorage();
                            }
                          }
                        ]
                      );
                    }}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Normal actions for active recipes
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={() => toggleFavorite(selectedRecipe.id)}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>
                      {selectedRecipe.isFavorite ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => shareRecipe(selectedRecipe)}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>📤</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const customFolders = getCustomFolders();
                      if (customFolders.length === 0) {
                        Alert.alert('No Cookbooks', 'Create a custom cookbook first!', [
                          { text: 'OK' },
                          {
                            text: 'Create Cookbook',
                            onPress: () => {
                              setSelectedRecipe(null);
                              setShowFolderManager(true);
                              setTimeout(() => setShowAddFolder(true), 300);
                            }
                          }
                        ]);
                      } else {
                        setShowMoveToFolder(true);
                      }
                    }}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>📖</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Delete Recipe?',
                        `Move "${selectedRecipe.title}" to Recently Deleted?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => deleteRecipe(selectedRecipe.id)
                          }
                        ]
                      );
                    }}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.iconButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView style={styles.modalContent}>
              {selectedRecipe.deletedAt && (
                <View style={styles.deletedBanner}>
                  <Text style={styles.deletedBannerText}>
                    🗑️ Deleted on {new Date(selectedRecipe.deletedAt).toLocaleDateString()}
                  </Text>
                  <Text style={styles.deletedBannerSubtext}>
                    Tap ♻️ to restore or 🗑️ to delete permanently
                  </Text>
                </View>
              )}
              <RecipeDetail
                recipe={selectedRecipe}
                onUpdate={selectedRecipe.deletedAt ? null : updateRecipe}
                onAddToGroceryList={selectedRecipe.deletedAt ? null : handleAddToGroceryList}
                addUndoAction={addUndoAction}
              />
              <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Move to Folder Modal - inside Recipe Detail for proper stacking */}
            {showMoveToFolder && selectedRecipe && (
              <Modal
                visible={showMoveToFolder}
                animationType="fade"
                transparent
                onRequestClose={() => setShowMoveToFolder(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.addFolderModal}>
                    <Text style={styles.addFolderTitle}>Move to Cookbook</Text>
                    {/* Option to remove from cookbook - only show if recipe is in a folder */}
                    {selectedRecipe.folder && selectedRecipe.folder !== 'All Recipes' && (
                      <TouchableOpacity
                        style={[styles.folderItem, styles.removeFromFolderItem]}
                        onPress={() => handleMoveToFolder('All Recipes')}
                      >
                        <Text style={styles.removeFromFolderText}>Remove from Cookbook</Text>
                      </TouchableOpacity>
                    )}
                    {getCustomFolders().map(folder => (
                      <TouchableOpacity
                        key={folder}
                        style={styles.folderItem}
                        onPress={() => handleMoveToFolder(folder)}
                      >
                        <Text style={styles.folderItemText}>{folder}</Text>
                      </TouchableOpacity>
                    ))}
                    <View style={styles.addFolderButtons}>
                      <TouchableOpacity
                        style={[styles.addFolderButton, styles.cancelButton]}
                        onPress={() => setShowMoveToFolder(false)}
                      >
                        <Text style={styles.cancelButtonText}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}

            {/* Undo Button inside Modal */}
            {showUndoButton && canUndo && !undoButtonDismissed && (
              <Animated.View
                style={[
                  styles.globalUndoButton,
                  {
                    transform: [
                      { translateX: undoButtonPosition.x },
                      { translateY: undoButtonPosition.y }
                    ]
                  }
                ]}
                {...panResponder.panHandlers}
              >
                <TouchableOpacity
                  onPress={performUndo}
                  activeOpacity={0.8}
                  style={styles.undoButtonTouchable}
                >
                  <Text style={styles.undoButtonIcon}>↶</Text>
                  <Text style={styles.undoButtonLabel}>Undo</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Ingredient Search Modal */}
      <IngredientSearch
        visible={showIngredientSearch}
        onClose={() => setShowIngredientSearch(false)}
        recipes={recipes}
        onSelectRecipe={(recipe) => setSelectedRecipe(recipe)}
      />

      {/* Add Folder Modal */}
      <Modal
        visible={showAddFolder}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setNewFolderName('');
          setShowAddFolder(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addFolderModal}>
            <Text style={styles.addFolderTitle}>New Cookbook</Text>
            <TextInput
              style={styles.addFolderInput}
              placeholder="Cookbook name"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.addFolderButtons}>
              <TouchableOpacity
                style={[styles.addFolderButton, styles.cancelButton]}
                onPress={() => {
                  setNewFolderName('');
                  setShowAddFolder(false);
                  setTimeout(() => setShowFolderManager(true), 100);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addFolderButton, styles.createButton]}
                onPress={addFolder}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Move to Folder Modal - for multiselect mode only */}
      {showMoveToFolder && multiselectMode && (
        <Modal
          visible={showMoveToFolder}
          animationType="fade"
          transparent
          onRequestClose={() => setShowMoveToFolder(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.addFolderModal}>
              <Text style={styles.addFolderTitle}>
                {`Move ${selectedRecipes.size} Recipe${selectedRecipes.size > 1 ? 's' : ''} to Cookbook`}
              </Text>
              {/* Option to remove from cookbook - only show if any selected recipe is in a folder */}
              {recipes.some(r => selectedRecipes.has(r.id) && r.folder && r.folder !== 'All Recipes') && (
                <TouchableOpacity
                  style={[styles.folderItem, styles.removeFromFolderItem]}
                  onPress={() => handleMoveToFolder('All Recipes')}
                >
                  <Text style={styles.removeFromFolderText}>Remove from Cookbook</Text>
                </TouchableOpacity>
              )}
              {getCustomFolders().map(folder => (
                <TouchableOpacity
                  key={folder}
                  style={styles.folderItem}
                  onPress={() => handleMoveToFolder(folder)}
                >
                  <Text style={styles.folderItemText}>{folder}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.addFolderButtons}>
                <TouchableOpacity
                  style={[styles.addFolderButton, styles.cancelButton]}
                  onPress={() => setShowMoveToFolder(false)}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Rename Folder Modal */}
      {editingFolder && (
        <Modal
          visible={!!editingFolder}
          animationType="fade"
          transparent
          onRequestClose={() => {
            setEditingFolder(null);
            setEditingFolderName('');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.addFolderModal}>
              <Text style={styles.addFolderTitle}>Rename Cookbook</Text>
              <TextInput
                style={styles.addFolderInput}
                value={editingFolderName}
                onChangeText={setEditingFolderName}
                autoFocus
              />
              <View style={styles.addFolderButtons}>
                <TouchableOpacity
                  style={[styles.addFolderButton, styles.cancelButton]}
                  onPress={() => {
                    setEditingFolder(null);
                    setEditingFolderName('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addFolderButton, styles.createButton]}
                  onPress={renameFolder}
                >
                  <Text style={styles.createButtonText}>Rename</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Import Recipe Modal */}
      <Modal
        visible={showImport}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setImportText('');
          setShowImport(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.importModal}>
            <Text style={styles.addFolderTitle}>Import Recipe or Cookbook</Text>

            {/* Cookbook Selector */}
            <View style={styles.importSection}>
              <Text style={styles.importSectionLabel}>Import to:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderChips}>
                {folders.filter(f => f !== 'Favorites' && f !== 'Recently Deleted').map((folder) => (
                  <TouchableOpacity
                    key={folder}
                    style={[
                      styles.folderChip,
                      importTargetFolder === folder && styles.folderChipSelected
                    ]}
                    onPress={() => setImportTargetFolder(folder)}
                  >
                    <Text style={[
                      styles.folderChipText,
                      importTargetFolder === folder && styles.folderChipTextSelected
                    ]}>
                      {folder}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.importInstructions}>
              Paste code or URL below:
            </Text>
            <TextInput
              style={styles.importInput}
              placeholder="Paste URL or code here... (BUNCHES_RECIPE:... or BUNCHES_COOKBOOK:...)"
              value={importText}
              onChangeText={setImportText}
              multiline
              numberOfLines={6}
            />
            <View style={styles.addFolderButtons}>
              <TouchableOpacity
                style={[styles.addFolderButton, styles.cancelButton]}
                onPress={() => {
                  setImportText('');
                  setShowImport(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addFolderButton, styles.createButton]}
                onPress={async () => {
                  if (importText.trim()) {
                    // Check if it's a URL or code
                    if (importText.trim().startsWith('http')) {
                      // It's a URL, use extraction
                      await extractRecipe(importText.trim());
                      setImportText('');
                      setShowImport(false);
                    } else {
                      // It's a code, use import
                      await importRecipe(importText);
                      setImportText('');
                      setShowImport(false);
                    }
                  }
                }}
              >
                <Text style={styles.createButtonText}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Undo Button - Hide when modals are open */}
      {!selectedRecipe && !showGroceryList && !showAddFolder && !showMoveToFolder && !showRenameFolder && renderSwipeableUndoButton()}

      {/* Username Setup Modal */}
      <UsernameSetupModal
        visible={needsUsername && !!user}
        onSetup={setupUsername}
        checkAvailability={checkUsernameAvailable}
      />

      {/* Share to Friends Modal */}
      <ShareToFriendsModal
        visible={showShareToFriends}
        onClose={() => {
          setShowShareToFriends(false);
          setShareItem(null);
        }}
        onShare={async (friendIds) => {
          if (shareItem) {
            await shareWithFriends(friendIds, shareItem.type, shareItem.data, shareItem.name);
          }
        }}
        friends={friends}
        itemName={shareItem?.name || ''}
        itemType={shareItem?.type || 'recipe'}
      />

      {/* Friend Request Notification Popup */}
      <NotificationPopup
        visible={showNotificationPopup}
        request={notificationRequest}
        onAccept={handleAcceptFriendRequestFromPopup}
        onDecline={handleDeclineFriendRequestFromPopup}
        onDismiss={handleDismissNotificationPopup}
        colors={colors}
      />

      {/* Bottom Navigation Bar */}
      {renderNavigationBar()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconHeaderButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconHeaderButtonText: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  extractButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 80,
  },
  extractButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  recipeList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: colors.lightGray,
  },
  recipeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recipeCardFolder: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  favoriteButton: {
    padding: 6,
    marginLeft: 4,
    marginRight: -6,
  },
  favoriteIcon: {
    fontSize: 20,
  },
  recipeMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
  },
  multiselectToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  toolbarButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  toolbarButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  toolbarTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  folderButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  folderButtonText: {
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: colors.error,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
  },
  recipeCardSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  recipeCardContent: {
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryDark,
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addFolderHeaderButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
  },
  iconButtonText: {
    fontSize: 22,
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  bottomSpacer: {
    height: 120,
  },
  folderSection: {
    marginBottom: 25,
  },
  folderSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  folderManagerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: colors.lightGray,
  },
  folderManagerItemActive: {
    backgroundColor: colors.primaryLight,
  },
  folderManagerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderManagerIcon: {
    fontSize: 18,
  },
  folderManagerItemText: {
    fontSize: 15,
    color: colors.text,
  },
  folderManagerItemTextActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  folderManagerCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyFolders: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyFoldersText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  emptyFoldersSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFolderModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  addFolderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: colors.text,
  },
  addFolderInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 15,
  },
  addFolderButtons: {
    flexDirection: 'row',
  },
  addFolderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.lightGray,
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  folderItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  folderItemText: {
    fontSize: 15,
    color: colors.text,
  },
  removeFromFolderItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
    paddingBottom: 16,
  },
  removeFromFolderText: {
    fontSize: 15,
    color: colors.error,
    fontWeight: '500',
  },
  globalUndoButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 70,
    height: 70,
    backgroundColor: colors.warning,
    borderRadius: 12,
    zIndex: 99999,
    elevation: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  undoButtonTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoButtonIcon: {
    fontSize: 28,
    color: colors.white,
    fontWeight: '700',
  },
  undoButtonLabel: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '600',
    marginTop: 2,
  },
  deletedBanner: {
    backgroundColor: colors.error,
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deletedBannerText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  deletedBannerSubtext: {
    color: colors.white,
    fontSize: 13,
    opacity: 0.9,
  },
  importModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 500,
  },
  importInstructions: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
    fontWeight: '600',
  },
  importInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    marginBottom: 15,
    minHeight: 150,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  importSection: {
    marginBottom: 16,
  },
  importSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  folderChips: {
    flexDirection: 'row',
    maxHeight: 40,
  },
  folderChip: {
    backgroundColor: colors.lightGray,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  folderChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  folderChipText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  folderChipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  // Sort/Filter styles
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: colors.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  sortBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewModeButton: {
    padding: 6,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewModeIcon: {
    fontSize: 18,
  },
  recipeCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sortDropdown: {
    position: 'absolute',
    top: 120, // Below header + sort bar
    left: 15,
    right: 15,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  sortOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  sortOptionText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  sortOptionCheck: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  // Navigation Bar Styles
  navigationBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 25, // Extra padding for Android navigation bar
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    position: 'relative',
  },
  navButtonActive: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  navButtonIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  navButtonText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  navButtonTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  navBadge: {
    position: 'absolute',
    top: 2,
    right: '30%',
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  navBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
});

export default HomeScreen;
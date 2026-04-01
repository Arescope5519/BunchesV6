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
  Animated,
  PanResponder,
  Image,
  AppState,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import * as Clipboard from 'expo-clipboard';

// Hooks
import { useRecipes } from '../hooks/useRecipes';
import { useFolders } from '../hooks/useFolders';
import { useShareIntent } from '../hooks/useShareIntent';
import { useRecipeExtraction } from '../hooks/useRecipeExtraction';
import { useGroceryList } from '../hooks/useGroceryList';
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
import { WelcomeModal } from '../components/WelcomeModal';

// Constants
import colors from '../constants/colors';
import { PREDEFINED_TAGS, getTagColor, getPredefinedTagNames } from '../constants/tags';

// Supabase auth
import { signOut as supabaseSignOut, signInWithGoogle as supabaseSignIn } from '../services/supabase/auth';
import { saveRecipeToDatabase, deleteRecipeFromDatabase, syncRecipes as syncRecipesWithSupabase } from '../services/supabase/database';

// iOS Share Extension pending recipes
import { getPendingRecipes, clearPendingRecipes } from '../services/pendingRecipes';

// Storage utilities for manual sync
import { saveRecipes as saveRecipesToStorage, loadAppSettings, saveAppSettings, saveFollowedCookbooks, loadFollowedCookbooks } from '../utils/storage';

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

  // Tag filter state
  const [selectedTags, setSelectedTags] = useState([]); // Array of tag names to filter by
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [expandedTagsRecipeId, setExpandedTagsRecipeId] = useState(null); // Track which recipe has expanded tags

  // Folder filter state
  const [folderSortAZ, setFolderSortAZ] = useState(false); // Sort folders A-Z
  const [folderPrivacyFilter, setFolderPrivacyFilter] = useState('all'); // 'all', 'private', 'public'

  // Multiselect state
  const [multiselectMode, setMultiselectMode] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState(new Set());

  // Social state
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [showShareToFriends, setShowShareToFriends] = useState(false);
  const [shareItem, setShareItem] = useState(null); // { type, data, name }
  const [followedCookbooks, setFollowedCookbooks] = useState([]);

  // Notification popup state
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [notificationRequest, setNotificationRequest] = useState(null);
  const prevFriendRequestsRef = useRef([]);

  // Quick link button setting
  const [showQuickLinkButton, setShowQuickLinkButton] = useState(false);
  const [showQuickLinkModal, setShowQuickLinkModal] = useState(false);
  const [quickLinkUrl, setQuickLinkUrl] = useState('');
  const [quickLinkLoading, setQuickLinkLoading] = useState(false);

  // Welcome modal state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasCheckedWelcome, setHasCheckedWelcome] = useState(false);

  // Deep link friend request state
  const [pendingFriendUsername, setPendingFriendUsername] = useState(null);

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
    // Stats and version management
    updateRecipeStats,
    toggleRecipeVersion,
    markRecipeAsEdited,
  } = useRecipes(user);

  const {
    folders,
    currentFolder,
    setCurrentFolder,
    addFolder: addFolderBase,
    renameFolder: renameFolderBase,
    deleteFolder: deleteFolderBase,
    getCustomFolders,
    isFolderPrivate,
    updateFolderPrivacy,
  } = useFolders(user);

  const {
    groceryList,
    loading: groceryListLoading,
    addItems: addItemsToGroceryList,
    addCustomItem: addCustomGroceryItem,
    removeItem: removeGroceryItem,
    toggleItemChecked,
    clearCheckedItems,
    clearAllItems,
    getUncheckedCount,
    restoreList: restoreGroceryList,
  } = useGroceryList(user);


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

  // Load app settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await loadAppSettings(user?.uid);
      if (settings.showQuickLinkButton !== undefined) {
        setShowQuickLinkButton(settings.showQuickLinkButton);
      }
      // Check if user has seen welcome modal
      if (!hasCheckedWelcome && user && !settings.hasSeenWelcome) {
        setShowWelcomeModal(true);
      }
      setHasCheckedWelcome(true);

      // Load followed cookbooks
      const cookbooks = await loadFollowedCookbooks(user?.uid);
      setFollowedCookbooks(cookbooks);
    };
    loadSettings();
  }, [user?.uid, hasCheckedWelcome]);

  // Save app settings when they change
  const updateAppSetting = async (key, value) => {
    const currentSettings = await loadAppSettings(user?.uid);
    const newSettings = { ...currentSettings, [key]: value };
    await saveAppSettings(newSettings, user?.uid);
    if (key === 'showQuickLinkButton') {
      setShowQuickLinkButton(value);
    }
  };

  // Handle welcome modal "don't show again"
  const handleWelcomeDontShowAgain = async () => {
    await updateAppSetting('hasSeenWelcome', true);
  };

  // Handle following a cookbook
  const handleFollowCookbook = async (cookbookData) => {
    const updatedCookbooks = [...followedCookbooks, cookbookData];
    setFollowedCookbooks(updatedCookbooks);
    await saveFollowedCookbooks(updatedCookbooks, user?.uid);
    console.log('📚 Following cookbook:', cookbookData.name);
  };

  // Handle deep link for adding friends
  const handleDeepLink = (url) => {
    if (!url) return;

    console.log('Deep link received:', url);

    // Parse bunches://add-friend/username
    const match = url.match(/bunches:\/\/add-friend\/([^\/\?]+)/);
    if (match && match[1]) {
      const username = decodeURIComponent(match[1]);
      console.log('Friend request from deep link:', username);

      if (!user) {
        Alert.alert(
          'Sign In Required',
          'Please sign in to add friends.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Store the username and open social modal
      setPendingFriendUsername(username);
      setCurrentScreen('social');
    }
  };

  // Listen for deep links
  useEffect(() => {
    // Handle initial URL (app opened via link)
    const getInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };
    getInitialURL();

    // Handle URLs while app is open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription?.remove();
    };
  }, [user]);

  // Handle pending friend request when social data is ready
  useEffect(() => {
    if (pendingFriendUsername && searchUsers && user) {
      const handlePendingFriend = async () => {
        try {
          const results = await searchUsers(pendingFriendUsername);
          if (results && results.length > 0) {
            const foundUser = results.find(
              u => u.username?.toLowerCase() === pendingFriendUsername.toLowerCase()
            );
            if (foundUser) {
              if (foundUser.isFriend) {
                Alert.alert('Already Friends', `You're already friends with @${foundUser.username}!`);
              } else if (foundUser.requestSent) {
                Alert.alert('Request Pending', `You already have a pending request to @${foundUser.username}.`);
              } else {
                // Send friend request
                await sendFriendRequest(foundUser.id);
                Alert.alert('Request Sent!', `Friend request sent to @${foundUser.username}!`);
              }
            } else {
              Alert.alert('User Not Found', `Could not find user @${pendingFriendUsername}`);
            }
          } else {
            Alert.alert('User Not Found', `Could not find user @${pendingFriendUsername}`);
          }
        } catch (error) {
          console.error('Error handling friend link:', error);
          Alert.alert('Error', 'Failed to process friend request. Please try again.');
        }
        setPendingFriendUsername(null);
      };
      handlePendingFriend();
    }
  }, [pendingFriendUsername, searchUsers, sendFriendRequest, user]);

  // Handle quick link URL submission
  const handleQuickLinkSubmit = async () => {
    if (!quickLinkUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    setQuickLinkLoading(true);
    try {
      const extractor = new RecipeExtractor();
      const result = await extractor.extract(quickLinkUrl.trim());

      if (result.success && result.data) {
        const extracted = result.data;

        // Convert to app format
        let ingredients = { main: [] };
        if (typeof extracted.ingredients === 'object' && !Array.isArray(extracted.ingredients)) {
          ingredients = extracted.ingredients;
        } else if (Array.isArray(extracted.ingredients)) {
          ingredients = { main: extracted.ingredients };
        } else if (typeof extracted.ingredients === 'string') {
          ingredients = { main: extracted.ingredients.split('\n').filter(line => line.trim()) };
        }

        let instructions = [];
        if (Array.isArray(extracted.instructions)) {
          instructions = extracted.instructions;
        } else if (typeof extracted.instructions === 'string') {
          instructions = extracted.instructions.split('\n').filter(line => line.trim());
        }

        const recipeData = {
          title: extracted.title || 'Untitled Recipe',
          ingredients,
          instructions,
          prepTime: extracted.prepTime || extracted.prep_time || '',
          cookTime: extracted.cookTime || extracted.cook_time || '',
          servings: extracted.servings || '',
          image_url: extracted.image || extracted.image_url || '',
          source_url: quickLinkUrl.trim(),
          notes: '',
        };

        setExtractedRecipe(recipeData);
        setShowQuickLinkModal(false);
        setQuickLinkUrl('');
        setCurrentScreen('saveRecipe');
      } else {
        Alert.alert('Error', result.error || 'Could not extract recipe from this URL');
      }
    } catch (error) {
      console.error('Quick link extraction error:', error);
      Alert.alert('Error', 'Failed to extract recipe. Please check the URL and try again.');
    } finally {
      setQuickLinkLoading(false);
    }
  };

  // Track if we're currently importing to prevent duplicate imports
  const isImportingRef = useRef(false);

  // Check for pending recipes from iOS Share Extension
  useEffect(() => {
    const extractor = new RecipeExtractor();

    const checkPendingRecipes = async () => {
      console.log('[HomeScreen] checkPendingRecipes called, Platform:', Platform.OS);

      if (Platform.OS !== 'ios') {
        console.log('[HomeScreen] Not iOS, skipping pending recipes check');
        return;
      }

      // Prevent concurrent imports
      if (isImportingRef.current) {
        console.log('[HomeScreen] Already importing, skipping...');
        return;
      }

      try {
        console.log('[HomeScreen] Fetching pending recipes...');
        const pending = await getPendingRecipes();
        console.log('[HomeScreen] Pending recipes result:', JSON.stringify(pending, null, 2));

        if (pending && pending.length > 0) {
          console.log(`[HomeScreen] Found ${pending.length} pending recipe(s) from Share Extension - auto-importing...`);

          // Set flag to prevent concurrent imports
          isImportingRef.current = true;

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

                  // Store original data for version comparison
                  const originalData = {
                    title: extracted.title || item.preview_title || 'Untitled Recipe',
                    ingredients: ingredientsStr,
                    instructions: instructionsStr,
                    prep_time: extracted.prep_time || '',
                    cook_time: extracted.cook_time || '',
                    servings: extracted.servings || '',
                    image_url: extracted.image || item.preview_image || null,
                  };

                  recipeData = {
                    ...originalData,
                    url: item.url,
                    source: result.source || 'web',
                    folder: 'All Recipes',
                    // Versioning fields
                    originalRecipe: originalData,
                    hasEdits: false,
                    editHistory: [],
                  };
                } else {
                  console.warn(`Failed to extract recipe from ${item.url}: ${result.error}`);
                  failed++;
                  continue;
                }
              } else {
                // Legacy format - recipe data already parsed by share extension
                const originalData = {
                  title: item.title || 'Untitled Recipe',
                  ingredients: item.ingredients || '',
                  instructions: item.instructions || '',
                  prep_time: item.prep_time || '',
                  cook_time: item.cook_time || '',
                  servings: item.servings || '',
                  image_url: item.image_url || null,
                };

                recipeData = {
                  ...originalData,
                  url: item.source_url || item.url || '',
                  source: 'web',
                  folder: 'All Recipes',
                  // Versioning fields
                  originalRecipe: originalData,
                  hasEdits: false,
                  editHistory: [],
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

          // Reset importing flag
          isImportingRef.current = false;

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
        isImportingRef.current = false;
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

  const { loading, extractRecipe, findExistingRecipeByUrl } = useRecipeExtraction(
    (recipe, options = {}) => {
      // Handle extracted or existing recipe
      if (options.isExisting) {
        // User chose to view existing recipe
        setSelectedRecipe(recipe);
        setCurrentScreen('recipes');
      } else {
        // Navigate to save recipe screen with extracted recipe
        setExtractedRecipe(recipe);
        setCurrentScreen('saveRecipe');
      }
    },
    recipes // Pass recipes for deduplication check
  );

  // Handle save from SaveRecipeScreen
  const handleSaveExtractedRecipe = async (selectedFolder, modifiedRecipe) => {
    if (!modifiedRecipe) return;

    const recipeWithFolder = {
      ...modifiedRecipe,
      folder: selectedFolder === 'Favorites' || selectedFolder === 'Recently Deleted'
        ? 'All Recipes'
        : selectedFolder,
      // Add creator info if user is logged in
      createdBy: profile ? {
        id: user?.uid,
        username: profile.username,
      } : null,
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
    console.log('[NAV] handleNavigation called with:', screen);

    if (screen === 'recipes' || screen === 'social' || screen === 'settings' || screen === 'grocery' || screen === 'discover') {
      console.log('[NAV] Setting currentScreen to:', screen);
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
    } else if (screen === 'explore') {
      // Coming soon - no navigation
      Alert.alert('Coming Soon', 'The Explore feature is coming soon! Stay tuned for recipe discovery and community features.');
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
          style={[styles.navButton, currentScreen === 'discover' && styles.navButtonActive]}
          onPress={() => handleNavigation('discover')}
        >
          <Text style={styles.navButtonIcon}>🧭</Text>
          <Text style={[styles.navButtonText, currentScreen === 'discover' && styles.navButtonTextActive]}>
            Discover
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
    // Add creator info for manually created recipes
    const recipeWithCreator = {
      ...recipe,
      createdBy: profile ? {
        id: user?.uid,
        username: profile.username,
      } : null,
    };

    const saved = await saveRecipe(recipeWithCreator);
    if (saved) {
      Alert.alert('✅ Success', `Recipe "${recipe.title}" created!`);
      setCurrentScreen('recipes');
      setSelectedRecipe(recipeWithCreator);
    } else {
      Alert.alert('Error', 'Failed to create recipe. Please try again.');
    }
  };

  // Handle clear all data
  const handleClearAllData = async () => {
    try {
      const { saveRecipes } = require('../utils/storage');

      // Clear local storage
      await saveRecipes([], user?.uid || null);

      // If signed in, also clear cloud data
      if (user?.uid) {
        const { deleteAllRecipesFromDatabase } = require('../services/supabase/database');
        await deleteAllRecipesFromDatabase(user.uid);
      }

      await refreshRecipes();
      setCurrentScreen('recipes');
      Alert.alert('✅ Success', 'All data has been cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
      Alert.alert('Error', 'Failed to clear data');
    }
  };

  // Handle restore from backup
  const handleRestoreBackup = async (backupData) => {
    try {
      const FileSystem = require('expo-file-system');
      const { saveRecipes } = require('../utils/storage');
      const recipesToRestore = backupData.recipes || [];
      const mode = backupData.mode || 'add'; // 'add' or 'replace'

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

      // Get existing recipe titles for duplicate detection (case-insensitive)
      const existingRecipes = recipes.filter(r => !r.deletedAt);
      const existingTitles = mode === 'add'
        ? existingRecipes.map(r => r.title?.toLowerCase().trim())
        : [];

      // Process each recipe and build array
      let addedCount = 0;
      let skippedCount = 0;
      const processedRecipes = [];

      for (let index = 0; index < recipesToRestore.length; index++) {
        const recipeData = recipesToRestore[index];

        // Check for duplicates in 'add' mode
        if (mode === 'add') {
          const titleLower = recipeData.title?.toLowerCase().trim();
          if (existingTitles.includes(titleLower)) {
            skippedCount++;
            continue; // Skip duplicate
          }
        }

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
          tags: recipeData.tags || [],
          createdAt: recipeData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        processedRecipes.push(newRecipe);
        addedCount++;
      }

      // Save all recipes at once based on mode
      if (mode === 'replace') {
        // Replace mode: save only the new recipes (clears everything else)
        await saveRecipes(processedRecipes, user?.uid || null);
      } else {
        // Add mode: merge new recipes with existing ones
        await saveRecipes([...processedRecipes, ...existingRecipes], user?.uid || null);
      }

      // Also restore any new folders that don't exist
      if (backupData.folders && Array.isArray(backupData.folders)) {
        const existingFolderNames = folders.map(f => f.name.toLowerCase());
        const newFolders = backupData.folders.filter(f => {
          // Handle both old string format and new object format
          const folderName = typeof f === 'string' ? f : f.name;
          return folderName !== 'All Recipes' && !existingFolderNames.includes(folderName.toLowerCase());
        });
        for (const folder of newFolders) {
          const folderName = typeof folder === 'string' ? folder : folder.name;
          await addFolder(folderName);
        }
      }

      await refreshRecipes();

      console.log(`Restore complete: ${addedCount} added, ${skippedCount} skipped (duplicates)`);
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
        // Convert image to image_url for consistency
        const imageUrl = result.data.image || result.data.image_url || null;
        const recipe = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          url: recipeUrl,
          ...result.data,
          image_url: imageUrl, // Use image_url consistently
          extractedAt: new Date().toISOString(),
          source: result.source,
          folder: 'All Recipes',
          isFavorite: false,
        };
        console.log('🍎 [iOS] Extracted recipe:', recipe.title);
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

  // Grocery list handlers
  const handleAddToGroceryList = async (selectedItems) => {
    if (!selectedRecipe || selectedItems.length === 0) return;
    const ingredientTexts = selectedItems.map(item => item.text);
    await addItemsToGroceryList(ingredientTexts, selectedRecipe, selectedItems[0]?.section || 'main');
  };

  const handleToggleGroceryItem = async (itemId) => {
    await toggleItemChecked(itemId);
  };

  const handleRemoveGroceryItem = async (itemId) => {
    await removeGroceryItem(itemId);
  };

  const handleClearCheckedItems = async () => {
    await clearCheckedItems();
  };

  const handleClearAllItems = async () => {
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
                for (const recipeId of recipeIds) {
                  deleteRecipeFromDatabase(user.uid, recipeId).catch(console.error);
                }
                console.log(`✅ Permanently deleted ${recipeCount} recipes from database`);
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

              // Sync soft-deletion to Supabase in background if user is signed in
              if (user) {
                for (const recipeId of recipeIds) {
                  deleteRecipeFromDatabase(user.uid, recipeId).catch(console.error);
                }
                console.log(`✅ Soft-deleted ${recipeCount} recipes in database`);
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
      await Clipboard.setStringAsync(text);
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

  // Share recipe handler - supports social sharing and edit options
  const shareRecipe = async (recipe, options = {}) => {
    const { includeEdits = true } = options;

    // Prepare recipe to share, handling edit options
    let recipeToShare = { ...recipe };

    // If recipe has edits and user wants to share original only
    if (recipe.hasEdits && recipe.originalRecipe && !includeEdits) {
      recipeToShare = {
        ...recipe,
        title: recipe.originalRecipe.title,
        ingredients: recipe.originalRecipe.ingredients,
        instructions: recipe.originalRecipe.instructions,
        prep_time: recipe.originalRecipe.prep_time,
        cook_time: recipe.originalRecipe.cook_time,
        total_time: recipe.originalRecipe.total_time,
        servings: recipe.originalRecipe.servings,
        nutrition: recipe.originalRecipe.nutrition,
        image_url: recipe.originalRecipe.image_url || recipe.originalRecipe.image,
        hasEdits: false,
        editHistory: [],
        editedVersion: undefined,
        viewingOriginal: undefined,
      };
    }

    // If user is logged in, open friends picker
    if (user && profile) {
      const { deletedAt, id, ...cleanRecipe } = recipeToShare;
      setShareItem({
        type: 'recipe',
        data: {
          ...cleanRecipe,
          sharedWithEdits: includeEdits && recipe.hasEdits,
        },
        name: recipe.title,
      });
      setShowShareToFriends(true);
    } else {
      // Not logged in - show message
      Alert.alert(
        'Sign In Required',
        'Sign in to share recipes with friends in the app.',
        [{ text: 'OK' }]
      );
    }
  };

  // Share recipe with prompt for edit options
  const handleShareRecipe = (recipe) => {
    // Check if recipe has edits - if so, offer options
    if (recipe.hasEdits && recipe.originalRecipe) {
      Alert.alert(
        'Share Recipe',
        'This recipe has been edited. How would you like to share it?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Share Original',
            onPress: () => shareRecipe(recipe, { includeEdits: false }),
          },
          {
            text: 'Share with My Edits',
            onPress: () => shareRecipe(recipe, { includeEdits: true }),
          },
        ]
      );
    } else {
      // No edits, share directly
      shareRecipe(recipe);
    }
  };

  // Share entire cookbook handler
  const shareCookbook = async (cookbookName) => {
    const recipesInCookbook = getFilteredRecipes(cookbookName).filter(r => !r.deletedAt);

    if (recipesInCookbook.length === 0) {
      Alert.alert('Empty Cookbook', 'This cookbook has no recipes to share');
      return;
    }

    // If user is logged in, open friends picker directly
    if (user && profile) {
      const cleanedRecipes = recipesInCookbook.map(r => {
        const { deletedAt, id, ...cleanRecipe } = r;
        return cleanRecipe;
      });
      setShareItem({
        type: 'cookbook',
        data: cleanedRecipes,
        name: cookbookName,
      });
      // Close the folder manager first, then show friends picker
      setShowFolderManager(false);
      setShowShareToFriends(true);
    } else {
      // Not logged in - show message
      Alert.alert(
        'Sign In Required',
        'Sign in to share cookbooks with friends in the app.',
        [{ text: 'OK' }]
      );
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
      if (showQuickLinkModal) {
        setShowQuickLinkModal(false);
        setQuickLinkUrl('');
        return true;
      }
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

  // Get all unique tags from recipes for the filter
  const allTags = useMemo(() => {
    const tagSet = new Set();
    recipes.forEach(recipe => {
      if (recipe.tags && Array.isArray(recipe.tags)) {
        recipe.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [recipes]);

  // Toggle tag in filter
  const toggleTagFilter = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Clear all tag filters
  const clearTagFilters = () => {
    setSelectedTags([]);
  };

  // Sort and filter recipes based on selected sort option and tags
  const sortedRecipes = useMemo(() => {
    let recipesToSort = [...filteredRecipes];

    // Filter by selected tags (show recipes that have ANY of the selected tags)
    if (selectedTags.length > 0) {
      recipesToSort = recipesToSort.filter(recipe => {
        if (!recipe.tags || !Array.isArray(recipe.tags)) return false;
        return selectedTags.some(tag => recipe.tags.includes(tag));
      });
    }

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
  }, [filteredRecipes, sortBy, sortOrder, selectedTags]);


  // Render different screens based on currentScreen state
  if (currentScreen === 'saveRecipe') {
    return (
      <SaveRecipeScreen
        recipe={extractedRecipe}
        folders={folders.filter(f => f.name !== 'Favorites' && f.name !== 'Recently Deleted').map(f => f.name)}
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
          folders={folders.filter(f => f.name !== 'Favorites' && f.name !== 'Recently Deleted').map(f => f.name)}
        />

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
          folders={folders.filter(f => f.name !== 'Favorites' && f.name !== 'Recently Deleted').map(f => f.name)}
          onSave={handleSaveExtractedRecipe}
          onCancel={handleCancelSave}
        />

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
              {showQuickLinkButton && (
                <TouchableOpacity
                  onPress={() => setShowQuickLinkModal(true)}
                  style={styles.iconHeaderButton}
                >
                  <Text style={styles.iconHeaderButtonText}>🔗</Text>
                </TouchableOpacity>
              )}
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
              <TouchableOpacity
                onPress={() => setCurrentScreen('grocery')}
                style={styles.iconHeaderButton}
              >
                <Text style={styles.iconHeaderButtonText}>🛒</Text>
                {getUncheckedCount() > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{getUncheckedCount()}</Text>
                  </View>
                )}
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

          {/* Tag Filter Bar */}
          <View style={styles.tagFilterBar}>
            <TouchableOpacity
              style={[styles.tagFilterButton, showTagFilter && styles.tagFilterButtonActive]}
              onPress={() => setShowTagFilter(!showTagFilter)}
            >
              <Text style={[styles.tagFilterButtonText, showTagFilter && styles.tagFilterButtonTextActive]}>
                🏷️ Tags {selectedTags.length > 0 ? `(${selectedTags.length})` : ''}
              </Text>
            </TouchableOpacity>
            {selectedTags.length > 0 && (
              <TouchableOpacity onPress={clearTagFilters} style={styles.clearTagsButton}>
                <Text style={styles.clearTagsButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedTagsScroll}>
              {selectedTags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tagChipActive}
                  onPress={() => toggleTagFilter(tag)}
                >
                  <Text style={styles.tagChipActiveText}>{tag} ✕</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Tag Filter Dropdown */}
          {showTagFilter && (
            <View style={styles.tagFilterDropdown}>
              <ScrollView style={styles.tagFilterScrollView} nestedScrollEnabled>
                <Text style={styles.tagFilterSectionTitle}>Suggested Tags</Text>
                <View style={styles.tagFilterGrid}>
                  {PREDEFINED_TAGS.map(tag => (
                    <TouchableOpacity
                      key={tag.name}
                      style={[
                        styles.tagFilterChip,
                        selectedTags.includes(tag.name) && styles.tagFilterChipSelected
                      ]}
                      onPress={() => toggleTagFilter(tag.name)}
                    >
                      <Text style={[
                        styles.tagFilterChipText,
                        selectedTags.includes(tag.name) && styles.tagFilterChipTextSelected
                      ]}>
                        {tag.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {allTags.filter(t => !getPredefinedTagNames().map(n => n.toLowerCase()).includes(t.toLowerCase())).length > 0 && (
                  <>
                    <Text style={styles.tagFilterSectionTitle}>Custom Tags</Text>
                    <View style={styles.tagFilterGrid}>
                      {allTags.filter(t => !getPredefinedTagNames().map(n => n.toLowerCase()).includes(t.toLowerCase())).map(tag => (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.tagFilterChip,
                            selectedTags.includes(tag) && styles.tagFilterChipSelected
                          ]}
                          onPress={() => toggleTagFilter(tag)}
                        >
                          <Text style={[
                            styles.tagFilterChipText,
                            selectedTags.includes(tag) && styles.tagFilterChipTextSelected
                          ]}>
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </ScrollView>
              <TouchableOpacity
                style={styles.tagFilterCloseButton}
                onPress={() => setShowTagFilter(false)}
              >
                <Text style={styles.tagFilterCloseButtonText}>Done</Text>
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
          onFollowCookbook={handleFollowCookbook}
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
          showQuickLinkButton={showQuickLinkButton}
          onToggleQuickLinkButton={(value) => updateAppSetting('showQuickLinkButton', value)}
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
          onAddCustomItem={addCustomGroceryItem}
        />
      )}

      {currentScreen === 'discover' && (
        <View style={styles.discoverContainer}>
          <Text style={styles.discoverIcon}>🧭</Text>
          <Text style={styles.discoverTitle}>Discover</Text>
          <Text style={styles.discoverSubtitle}>Coming Soon</Text>
          <Text style={styles.discoverDescription}>
            Find new recipes, explore trending dishes, and discover content from the community.
          </Text>
          {console.log('[RENDER] Discover screen is being rendered')}
        </View>
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
                // Debug image_url
                if (viewMode === 'photo') {
                  console.log(`📷 Recipe "${recipe.title}" image_url:`, recipe.image_url ? recipe.image_url.substring(0, 50) + '...' : 'NONE');
                }
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
                    {viewMode === 'photo' && (
                      recipe.image_url ? (
                        <Image
                          source={{ uri: recipe.image_url }}
                          style={styles.recipeImage}
                          resizeMode="cover"
                          onError={(e) => console.log(`❌ Image failed to load for "${recipe.title}":`, e.nativeEvent.error)}
                          onLoad={() => console.log(`✅ Image loaded for "${recipe.title}"`)}
                        />
                      ) : (
                        <View style={[styles.recipeImage, styles.recipeImagePlaceholder]}>
                          <Text style={styles.recipeImagePlaceholderText}>No Image</Text>
                        </View>
                      )
                    )}
                    <View style={styles.recipeCardContent}>
                      {/* Folder badge - shown if recipe is in a cookbook */}
                      {recipe.folder && recipe.folder !== 'All Recipes' && (
                        <Text style={styles.recipeCardFolder}>{typeof recipe.folder === 'string' ? recipe.folder : recipe.folder?.name || ''}</Text>
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
                      {/* Tag chips on recipe card - below title */}
                      {recipe.tags && recipe.tags.length > 0 && (
                        <View style={styles.recipeCardTags}>
                          {(expandedTagsRecipeId === recipe.id ? recipe.tags : recipe.tags.slice(0, 3)).map(tag => (
                            <View
                              key={tag}
                              style={styles.recipeCardTagChip}
                            >
                              <Text style={styles.recipeCardTagText}>{tag}</Text>
                            </View>
                          ))}
                          {recipe.tags.length > 3 && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                setExpandedTagsRecipeId(
                                  expandedTagsRecipeId === recipe.id ? null : recipe.id
                                );
                              }}
                              style={styles.recipeCardExpandTags}
                            >
                              <Text style={styles.recipeCardExpandTagsText}>
                                {expandedTagsRecipeId === recipe.id ? 'less' : `+${recipe.tags.length - 3}`}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                      <Text style={styles.recipeMeta} numberOfLines={1}>
                        {recipe.ingredients ? (typeof recipe.ingredients === 'string' ? recipe.ingredients.split('\n').filter(l => l.trim()).length : Object.values(recipe.ingredients).flat().length) : 0} ingredients
                      </Text>
                      {/* Source/Creator badge */}
                      {recipe.source === 'manual' && recipe.createdBy?.username && (
                        <Text style={styles.recipeCreator} numberOfLines={1}>
                          ✏️ by {recipe.createdBy.username}
                        </Text>
                      )}
                      {recipe.url && (
                        <Text style={styles.recipeSource} numberOfLines={1}>
                          🔗 {new URL(recipe.url).hostname.replace('www.', '')}
                        </Text>
                      )}
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
              {folders.filter(f => f.name === 'All Recipes' || f.name === 'Favorites' || f.name === 'Recently Deleted').map((folderObj) => {
                const folder = folderObj.name;
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
              <View style={styles.folderSectionHeader}>
                <Text style={styles.folderSectionTitle}>My Cookbooks</Text>
                {getCustomFolders().length > 0 && (
                  <View style={styles.folderFilters}>
                    <TouchableOpacity
                      style={[styles.folderFilterBtn, folderSortAZ && styles.folderFilterBtnActive]}
                      onPress={() => setFolderSortAZ(!folderSortAZ)}
                    >
                      <Text style={[styles.folderFilterText, folderSortAZ && styles.folderFilterTextActive]}>A-Z</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.folderFilterBtn, folderPrivacyFilter === 'private' && styles.folderFilterBtnActive]}
                      onPress={() => setFolderPrivacyFilter(folderPrivacyFilter === 'private' ? 'all' : 'private')}
                    >
                      <Text style={[styles.folderFilterText, folderPrivacyFilter === 'private' && styles.folderFilterTextActive]}>Private</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.folderFilterBtn, folderPrivacyFilter === 'public' && styles.folderFilterBtnActive]}
                      onPress={() => setFolderPrivacyFilter(folderPrivacyFilter === 'public' ? 'all' : 'public')}
                    >
                      <Text style={[styles.folderFilterText, folderPrivacyFilter === 'public' && styles.folderFilterTextActive]}>Public</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {getCustomFolders().length === 0 ? (
                <View style={styles.emptyFolders}>
                  <Text style={styles.emptyFoldersText}>No custom cookbooks yet</Text>
                  <Text style={styles.emptyFoldersSubtext}>Tap "+ New" to create one</Text>
                </View>
              ) : (
                getCustomFolders()
                  .filter(folder => {
                    if (folderPrivacyFilter === 'all') return true;
                    const isPrivate = isFolderPrivate(folder);
                    return folderPrivacyFilter === 'private' ? isPrivate : !isPrivate;
                  })
                  .sort((a, b) => folderSortAZ ? a.localeCompare(b) : 0)
                  .map((folder) => {
                  // Count only non-deleted recipes in this folder
                  const recipeCount = recipes.filter(r =>
                    r.folder === folder && !r.deletedAt
                  ).length;
                  const isPrivate = isFolderPrivate(folder);

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
                              text: isPrivate ? 'Make Public' : 'Make Private',
                              onPress: () => {
                                updateFolderPrivacy(folder, !isPrivate);
                                Alert.alert(
                                  'Updated',
                                  `"${folder}" is now ${!isPrivate ? 'private' : 'public'}`
                                );
                              }
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
                        <Text style={styles.folderManagerIcon}>
                          {isPrivate ? '🔒' : '📖'}
                        </Text>
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
                    onPress={() => handleShareRecipe(selectedRecipe)}
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
                allRecipes={recipes}
                isFolderPrivate={isFolderPrivate(selectedRecipe.folder)}
                onToggleVersion={selectedRecipe.deletedAt ? null : toggleRecipeVersion}
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

      {/* Quick Link Modal */}
      <Modal
        visible={showQuickLinkModal}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowQuickLinkModal(false);
          setQuickLinkUrl('');
        }}
      >
        <View style={styles.quickLinkOverlay}>
          <View style={styles.quickLinkContainer}>
            <View style={styles.quickLinkHeader}>
              <Text style={styles.quickLinkTitle}>Add Recipe from URL</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowQuickLinkModal(false);
                  setQuickLinkUrl('');
                }}
              >
                <Text style={styles.quickLinkClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.quickLinkDescription}>
              Paste a recipe URL to extract and save it
            </Text>
            <TextInput
              style={styles.quickLinkInput}
              placeholder="https://example.com/recipe"
              placeholderTextColor={colors.textSecondary}
              value={quickLinkUrl}
              onChangeText={setQuickLinkUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <View style={styles.quickLinkActions}>
              <TouchableOpacity
                style={styles.quickLinkCancelButton}
                onPress={() => {
                  setShowQuickLinkModal(false);
                  setQuickLinkUrl('');
                }}
              >
                <Text style={styles.quickLinkCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickLinkSubmitButton, quickLinkLoading && styles.quickLinkButtonDisabled]}
                onPress={handleQuickLinkSubmit}
                disabled={quickLinkLoading}
              >
                {quickLinkLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.quickLinkSubmitText}>Extract Recipe</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                {folders.filter(f => f.name !== 'Favorites' && f.name !== 'Recently Deleted').map((folderObj) => (
                  <TouchableOpacity
                    key={folderObj.name}
                    style={[
                      styles.folderChip,
                      importTargetFolder === folderObj.name && styles.folderChipSelected
                    ]}
                    onPress={() => setImportTargetFolder(folderObj.name)}
                  >
                    <Text style={[
                      styles.folderChipText,
                      importTargetFolder === folderObj.name && styles.folderChipTextSelected
                    ]}>
                      {folderObj.name}
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

      {/* Welcome Modal for first-time users */}
      <WelcomeModal
        visible={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        onDontShowAgain={handleWelcomeDontShowAgain}
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
  recipeImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderStyle: 'dashed',
  },
  recipeImagePlaceholderText: {
    fontSize: 10,
    color: colors.gray,
    textAlign: 'center',
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
  recipeCreator: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  recipeSource: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  folderSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  folderFilters: {
    flexDirection: 'row',
    gap: 6,
  },
  folderFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
  },
  folderFilterBtnActive: {
    backgroundColor: colors.primary,
  },
  folderFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  folderFilterTextActive: {
    color: '#fff',
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
  // Tag Filter Styles
  tagFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tagFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagFilterButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tagFilterButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  tagFilterButtonTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  clearTagsButton: {
    marginLeft: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearTagsButtonText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '500',
  },
  selectedTagsScroll: {
    marginLeft: 8,
    flexGrow: 0,
  },
  tagChipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: '#666',
  },
  tagChipActiveText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  tagFilterDropdown: {
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 320,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tagFilterScrollView: {
    maxHeight: 220,
  },
  tagFilterSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagFilterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#999',
    marginBottom: 4,
  },
  tagFilterChipSelected: {
    backgroundColor: '#666',
    borderColor: '#666',
  },
  tagFilterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  tagFilterChipTextSelected: {
    color: '#fff',
  },
  tagFilterCloseButton: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  tagFilterCloseButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  // Recipe Card Tag Styles
  recipeCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 4,
    gap: 4,
    alignItems: 'center',
  },
  recipeCardTagChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#E8E8E8',
  },
  recipeCardTagText: {
    fontSize: 11,
    color: '#555',
    fontWeight: '500',
  },
  recipeCardExpandTags: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
  },
  recipeCardExpandTagsText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
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
  // Quick Link Modal styles
  quickLinkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickLinkContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  quickLinkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLinkTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  quickLinkClose: {
    fontSize: 20,
    color: colors.textSecondary,
    padding: 4,
  },
  quickLinkDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  quickLinkInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  quickLinkActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickLinkCancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickLinkCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  quickLinkSubmitButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickLinkSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  quickLinkButtonDisabled: {
    opacity: 0.6,
  },
  // Header badge for shopping cart button
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Discover screen styles
  discoverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.background,
  },
  discoverIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  discoverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  discoverSubtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 20,
  },
  discoverDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default HomeScreen;
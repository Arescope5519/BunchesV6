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
import Clipboard from '@react-native-clipboard/clipboard';

// Hooks
import { useRecipes } from '../hooks/useRecipes';
import { useFolders, MY_CREATIONS_FOLDER } from '../hooks/useFolders';
import { useShareIntent } from '../hooks/useShareIntent';
import { resolveShareUrl, normalizeRecipeUrl } from '../utils/urlExtractor';
import { useRecipeExtraction } from '../hooks/useRecipeExtraction';
import { useGroceryList } from '../hooks/useGroceryList';
import { useSocial } from '../hooks/useSocial';

// Components
import RecipeDetail from '../components/RecipeDetail';
import LetterPlaceholder from '../components/LetterPlaceholder';
import RecipeShareCard, { SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT } from '../components/RecipeShareCard';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { scanRecipeImages } from '../services/recipeScan';
import UserProfile from '../components/UserProfile';
import { Ionicons } from '@expo/vector-icons';
import { GroceryList } from '../components/GroceryList';
import { IngredientSearch } from '../components/IngredientSearch';
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
import { TAG_CATEGORIES, getPredefinedTagNames, getFrequentTags, combineRecipeTags } from '../constants/tags';
import { DIETS, dietLabel, analyzeRecipe, getConflicts } from '../utils/dietaryAnalysis';
import { loadDietaryPreferences, saveDietaryPreferences } from '../services/supabase/dietary';

// Supabase auth
import { signOut as supabaseSignOut, signInWithGoogle as supabaseSignIn } from '../services/supabase/auth';
import { deleteRecipeFromDatabase, syncRecipes as syncRecipesWithSupabase, saveTagSearchCountsToDatabase, loadTagSearchCountsFromDatabase, getGlobalRecipeById, findGlobalRecipeByUrl } from '../services/supabase/database';
import { useDeepLinks, buildRecipeLink } from '../hooks/useDeepLinks';
import {
  getFullPublicRecipe,
  submitContentReport,
  isUserAdmin,
  isUserPremium,
  getFeatureFlags,
  blockUser,
  unblockUser,
  getBlockStatus,
} from '../services/supabase/social';
import DiscoverFeed from '../components/DiscoverFeed';
import AdminReports from '../components/AdminReports';
import BlockedUsers from '../components/BlockedUsers';
import DisclaimerModal, { shouldShowDisclaimer } from '../components/DisclaimerModal';
import KitchenScreen from '../components/KitchenScreen';

// iOS Share Extension pending recipes
import { getPendingRecipes, clearPendingRecipes } from '../services/pendingRecipes';

// Storage utilities for manual sync
import { saveRecipes as saveRecipesToStorage, loadAppSettings, saveAppSettings, saveFollowedCookbooks, loadFollowedCookbooks, loadTagSearchCounts, saveTagSearchCounts } from '../utils/storage';

// Recipe extractor for parsing shared URLs (consistent with Android)
import RecipeExtractor from '../../RecipeExtractor';

import { log } from '../utils/log';
import {
  APP_NAME,
  isInternalUrl,
  internalRecipeUrlCandidates,
  parseFriendLink,
} from '../constants/app';
export const HomeScreen = ({ user }) => {
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState('recipes'); // recipes, social, settings, grocery

  // Local state
  const [url, setUrl] = useState('');
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  // Incremented when the recipe modal finishes opening - remounts the inner
  // ScrollView so Android re-measures it (fixes dead scroll until first tap)
  const [recipeModalTick, setRecipeModalTick] = useState(0);
  const [viewingUserProfile, setViewingUserProfile] = useState(null);
  const [importingRecipe, setImportingRecipe] = useState(null);
  const [showImportFolderPicker, setShowImportFolderPicker] = useState(false);
  const [reportingRecipe, setReportingRecipe] = useState(null);
  const [reportingProfile, setReportingProfile] = useState(null); // { userId, username }
  const [reportReason, setReportReason] = useState('inappropriate');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [discoverEnabled, setDiscoverEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showAdminReports, setShowAdminReports] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [pendingFolders, setPendingFolders] = useState([]);
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
  const [selectedDiets, setSelectedDiets] = useState([]); // Array of derived diet keys to filter by
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [expandedTagsRecipeId, setExpandedTagsRecipeId] = useState(null); // Track which recipe has expanded tags

  // Dietary preferences (loaded from user_profiles)
  const [dietaryPrefs, setDietaryPrefs] = useState({ diets: [], avoid: [] });

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
    findRecipeByUrl,
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
    addToFolder,
    removeFromFolder,
    getFilteredRecipes,
    refreshRecipes,
    reloadFromStorage,
    // Stats and version management
    updateRecipeStats,
    toggleRecipeVersion,
    markRecipeAsEdited,
    // Variant management
    selectVariant,
    createVariant,
    deleteVariant,
    addVariantToRecipe,
    // Original-recipe sync
    refreshOriginalFromOwner,
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

  // Helper to check if a recipe is custom (created by user, not imported)
  const isCustomRecipe = (recipe) => {
    if (!recipe) return false;
    const url = recipe.url || recipe.sourceUrl || recipe.source_url;
    return !url || isInternalUrl(url);
  };

  // Get folders available for a recipe (My Creations only for custom recipes)
  const getFoldersForRecipe = (recipe) => {
    const allFolders = getCustomFolders();
    if (isCustomRecipe(recipe)) {
      return allFolders; // Custom recipes can go in My Creations
    }
    // Imported recipes can't go in My Creations or its subfolders
    return allFolders.filter(f => f !== MY_CREATIONS_FOLDER && !f.startsWith(MY_CREATIONS_FOLDER + '/'));
  };

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
  // Show disclaimer on first launch
  useEffect(() => {
    (async () => {
      const needed = await shouldShowDisclaimer();
      if (needed) setShowDisclaimer(true);
    })();
  }, []);

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
          log('Failed to hide navigation bar:', error);
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

      // Check admin and premium status + feature flags
      if (user?.uid) {
        const [adminStatus, premiumStatus, flags] = await Promise.all([
          isUserAdmin(user.uid),
          isUserPremium(user.uid),
          getFeatureFlags(user.uid),
        ]);
        setIsAdmin(adminStatus);
        setIsPremium(premiumStatus);
        // Discover ships dark: admins always see it, everyone else needs
        // the per-user flag (sql/add_feature_flags.sql)
        setDiscoverEnabled(adminStatus || flags.discover === true);
      } else {
        setIsAdmin(false);
        setIsPremium(false);
        setDiscoverEnabled(false);
      }
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
    log('📚 Following cookbook:', cookbookData.name);
  };

  // Handle deep link for adding friends
  const handleDeepLink = (url) => {
    if (!url) return;

    log('Deep link received:', url);

    // Parse <scheme>://add-friend/username, legacy schemes included
    const username = parseFriendLink(url);
    if (username) {
      log('Friend request from deep link:', username);

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

  // When opening an imported recipe, silently refresh its "original" from the owner
  useEffect(() => {
    if (!selectedRecipe) return;
    if (selectedRecipe.isReadOnly) return; // Already viewing owner's live copy
    if (!selectedRecipe.originalOwnerId || !selectedRecipe.originalOwnerRecipeId) return;

    // Fire and forget - updates the recipe in local state when done
    refreshOriginalFromOwner(selectedRecipe.id).then((updated) => {
      if (updated && selectedRecipe && updated.id === selectedRecipe.id) {
        setSelectedRecipe(updated);
      }
    });
  }, [selectedRecipe?.id]);

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
      log('[HomeScreen] checkPendingRecipes called, Platform:', Platform.OS);

      if (Platform.OS !== 'ios') {
        log('[HomeScreen] Not iOS, skipping pending recipes check');
        return;
      }

      // Prevent concurrent imports
      if (isImportingRef.current) {
        log('[HomeScreen] Already importing, skipping...');
        return;
      }

      try {
        log('[HomeScreen] Fetching pending recipes...');
        const pending = await getPendingRecipes();
        log('[HomeScreen] Pending recipes result:', JSON.stringify(pending, null, 2));

        if (pending && pending.length > 0) {
          log(`[HomeScreen] Found ${pending.length} pending recipe(s) from Share Extension - auto-importing...`);

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
                log(`Parsing URL with RecipeExtractor: ${item.url}`);
                const result = await extractor.extract(item.url);

                if (result.success && result.data) {
                  // Convert RecipeExtractor format to app format
                  const extracted = result.data;

                  // Handle ingredients - can be object with sections or string
                  let ingredientsStr = '';
                  if (typeof extracted.ingredients === 'object' && !Array.isArray(extracted.ingredients)) {
                    // Convert sectioned ingredients to string
                    ingredientsStr = Object.entries(extracted.ingredients)
                      .map(([section, items]) => {
                        if (section === 'main') return Array.isArray(items) ? items.join('\n') : String(items);
                        return `${section}:\n${Array.isArray(items) ? items.join('\n') : String(items)}`;
                      })
                      .join('\n\n');
                  } else if (Array.isArray(extracted.ingredients)) {
                    ingredientsStr = extracted.ingredients.join('\n');
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

          // Silent import - no alerts (user already saw Share Extension confirmation)
          if (imported > 0) {
            log(`✅ [iOS] Silently imported ${imported} recipe(s)`);
          }
          if (failed > 0) {
            log(`⚠️ [iOS] Failed to import ${failed} recipe(s)`);
          }
        } else {
          log('[HomeScreen] No pending recipes found');
        }
      } catch (error) {
        console.error('[HomeScreen] Error checking pending recipes:', error);
        isImportingRef.current = false;
      }
    };

    // Check on mount
    log('[HomeScreen] Mounting, will check pending recipes...');
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
      setCurrentScreen('recipes');
      // More scanned recipes waiting? Offer the next one instead of
      // opening the just-saved recipe
      if (!advanceScanQueue()) {
        setSelectedRecipe(recipeWithFolder);
        Alert.alert('Saved', `Recipe saved to ${recipeWithFolder.folder}!`);
      }
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
    // Cancelling one scanned recipe still offers the rest
    advanceScanQueue();
  };

  // Navigation handler - all tabs now render inline
  const handleNavigation = (screen) => {
    log('[NAV] handleNavigation called with:', screen);

    if (screen === 'recipes' || screen === 'social' || screen === 'settings' || screen === 'grocery' || screen === 'discover') {
      log('[NAV] Setting currentScreen to:', screen);
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
          <Ionicons name="people" size={24} color={currentScreen === 'social' ? colors.primary : colors.textTertiary} />
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
          <Ionicons name="book" size={24} color={currentScreen === 'recipes' ? colors.primary : colors.textTertiary} />
          <Text style={[styles.navButtonText, currentScreen === 'recipes' && styles.navButtonTextActive]}>
            Recipes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'grocery' && styles.navButtonActive]}
          onPress={() => handleNavigation('grocery')}
        >
          <Ionicons name="restaurant" size={24} color={currentScreen === 'grocery' ? colors.primary : colors.textTertiary} />
          {getUncheckedCount && getUncheckedCount() > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{getUncheckedCount()}</Text>
            </View>
          )}
          <Text style={[styles.navButtonText, currentScreen === 'grocery' && styles.navButtonTextActive]}>
            Kitchen
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, currentScreen === 'settings' && styles.navButtonActive]}
          onPress={() => handleNavigation('settings')}
        >
          <Ionicons name="settings" size={24} color={currentScreen === 'settings' ? colors.primary : colors.textTertiary} />
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
      Alert.alert('Success', `Recipe "${recipe.title}" created!`);
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
      Alert.alert('Success', 'All data has been cleared');
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
            log('Failed to save image:', error);
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

      log(`Restore complete: ${addedCount} added, ${skippedCount} skipped (duplicates)`);
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
      log('🔄 Manual sync started...');
      // Sync local recipes with Supabase
      const mergedRecipes = await syncRecipesWithSupabase(user.uid, recipes);
      // Save merged result to local storage
      await saveRecipesToStorage(mergedRecipes, user.uid);
      // Reload UI from storage
      await reloadFromStorage();
      log('✅ Manual sync complete');
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
        log('🍎 [iOS] Extracted recipe:', recipe.title);
        return { success: true, recipe };
      }
      log('🍎 [iOS] Extraction failed for:', recipeUrl);
      return { success: false, url: recipeUrl };
    } catch (error) {
      console.error('🍎 [iOS] Extraction error:', error);
      return { success: false, url: recipeUrl };
    }
  };

  // iOS batch auto-save: Extract all recipes first, then save all at once
  const extractAndAutoSaveBatch = async (urls) => {
    log(`🍎 [iOS] Processing batch of ${urls.length} recipes...`);

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
        log(`🍎 [iOS] Batch saved ${extractedRecipes.length} recipes`);
      } else {
        // If batch save failed, count all as failed
        failedUrls.push(...extractedRecipes.map(r => r.url));
        extractedRecipes.length = 0;
      }
    }

    const succeeded = extractedRecipes.length;
    const failed = failedUrls.length;

    // Silent import - no alerts for iOS (Share Extension already handled user feedback)
    if (succeeded > 0) {
      log(`✅ [iOS] Auto-saved ${succeeded} recipe(s): ${savedNames.join(', ')}`);
    }
    if (failed > 0) {
      log(`⚠️ [iOS] Failed to extract ${failed} recipe(s)`);
    }
  };

  // Share intent handler - iOS auto-saves, Android shows save screen
  useShareIntent((sharedUrlOrUrls, isBatch = false) => {
    log('📤 [SHARE INTENT] Received:', { sharedUrlOrUrls, isBatch, platform: Platform.OS });

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
      log('📤 [SHARE INTENT] Android URL to extract:', url);
      if (!url) {
        Alert.alert('Share Failed', 'No URL was received. The share intent came through empty.');
        return;
      }
      // Chrome hands over a share.google wrapper rather than the page,
      // and mints a new one every time - so resolve it BEFORE the
      // duplicate check, or the same recipe never looks like a match.
      resolveShareUrl(url).then(resolvedUrl =>
        handleSharedRecipeUrl(normalizeRecipeUrl(resolvedUrl)));
    }
  });

  /**
   * Import a shared recipe URL, unless it is already saved.
   */
  const handleSharedRecipeUrl = (url) => {
    const existing = findRecipeByUrl(url);
    if (existing) {
      Alert.alert(
        'Already Saved',
        `"${existing.title}" is already in your recipes.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Recipe', onPress: () => {
            setCurrentScreen('recipes');
            setSelectedRecipe(existing);
          } },
        ]
      );
      return;
    }

    setUrl(url);
    extractRecipe(url).then(result => {
      log('📤 [SHARE INTENT] extractRecipe returned:', result);
    }).catch(err => {
      console.error('📤 [SHARE INTENT] extractRecipe threw:', err);
      Alert.alert('Share Failed', `Error: ${err.message}`);
    });
  };

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
                log(`✅ Permanently deleted ${recipeCount} recipes from database`);
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
                log(`✅ Soft-deleted ${recipeCount} recipes in database`);
              }
            }
          }
        }
      ]
    );
  };

  const moveSelectedRecipesToFolder = () => {
    if (selectedRecipes.size === 0) return;
    openFolderModalMultiselect();
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
      Alert.alert('Success', `Moved ${recipeCount} recipe${recipeCount > 1 ? 's' : ''} to ${targetFolder}`);
    } else {
      Alert.alert('Error', 'Failed to move recipes');
    }
  };

  // Handle toggle folder for multiselect mode
  const handleToggleFolderMultiselect = (folder) => {
    if (pendingFolders.includes(folder)) {
      setPendingFolders(pendingFolders.filter(f => f !== folder));
    } else {
      setPendingFolders([...pendingFolders, folder]);
    }
  };

  // Save folder changes for multiselect mode
  const handleSaveFoldersMultiselect = async () => {
    if (selectedRecipes.size === 0) {
      setShowMoveToFolder(false);
      return;
    }

    const recipeIds = Array.from(selectedRecipes);
    const customFolders = getCustomFolders();
    let changesCount = 0;

    // Update each recipe with its final folders array
    for (const recipeId of recipeIds) {
      const recipe = recipes.find(r => r.id === recipeId);
      if (!recipe) continue;

      const currentFolders = recipe.folders || [recipe.folder || 'All Recipes'];
      const currentCustomFolders = currentFolders.filter(f => customFolders.includes(f));

      // Find folders to add and remove
      const foldersToAdd = pendingFolders.filter(f => !currentCustomFolders.includes(f));
      const foldersToRemove = currentCustomFolders.filter(f => !pendingFolders.includes(f));

      if (foldersToAdd.length === 0 && foldersToRemove.length === 0) continue;

      // Build final folders array directly
      let finalFolders = [...currentFolders];

      // Add new folders
      for (const folder of foldersToAdd) {
        if (!finalFolders.includes(folder)) {
          finalFolders.push(folder);
        }
      }

      // Remove folders
      finalFolders = finalFolders.filter(f => !foldersToRemove.includes(f));

      // Ensure at least 'All Recipes' if empty
      if (finalFolders.length === 0) {
        finalFolders = ['All Recipes'];
      }

      const primaryFolder = finalFolders.find(f => f !== 'All Recipes') || finalFolders[0];

      // Update recipe with final folders
      const updatedRecipe = {
        ...recipe,
        folders: finalFolders,
        folder: primaryFolder,
        updatedAt: Date.now(),
      };

      await updateRecipe(updatedRecipe);
      changesCount++;
    }

    setShowMoveToFolder(false);
    exitMultiselectMode();

    if (changesCount > 0) {
      Alert.alert('Cookbooks Updated',
        `${changesCount} recipe${changesCount > 1 ? 's' : ''} updated`);
    }
  };

  // Open folder modal for multiselect
  const openFolderModalMultiselect = () => {
    // For multiselect, start with folders that ALL selected recipes have in common
    const customFolders = getCustomFolders();
    const selectedRecipesList = recipes.filter(r => selectedRecipes.has(r.id));

    if (selectedRecipesList.length === 0) {
      setPendingFolders([]);
    } else {
      // Find common folders across all selected recipes
      const firstRecipeFolders = (selectedRecipesList[0].folders || [selectedRecipesList[0].folder || 'All Recipes'])
        .filter(f => customFolders.includes(f));

      const commonFolders = firstRecipeFolders.filter(folder =>
        selectedRecipesList.every(recipe => {
          const recipeFolders = recipe.folders || [recipe.folder || 'All Recipes'];
          return recipeFolders.includes(folder);
        })
      );

      setPendingFolders(commonFolders);
    }
    setShowMoveToFolder(true);
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
      Clipboard.setString(text);
      Alert.alert(
        'Copied',
        `${title}\n\nThe code has been copied to your clipboard. You can now:\n\n1. Share it via any app\n2. Or paste it directly into Import to test`,
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
  // Resolve the sender's currently-effective edited fields (variant, legacy edit,
  // or top-level fields when originalRecipe holds the base)
  const getEffectiveEditedFields = (recipe) => {
    if (recipe.variants?.length && recipe.selectedVariantId) {
      const v = recipe.variants.find(x => x.id === recipe.selectedVariantId);
      if (v?.edits) {
        return {
          title: v.edits.title ?? recipe.title,
          ingredients: v.edits.ingredients ?? recipe.ingredients,
          instructions: v.edits.instructions ?? recipe.instructions,
        };
      }
    }
    if (recipe.editedVersion) {
      return {
        title: recipe.editedVersion.title ?? recipe.title,
        ingredients: recipe.editedVersion.ingredients ?? recipe.ingredients,
        instructions: recipe.editedVersion.instructions ?? recipe.instructions,
      };
    }
    // Legacy shape: top-level fields ARE the edited state, originalRecipe is the base
    return {
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
    };
  };

  const shareRecipe = async (recipe, options = {}) => {
    const { includeEdits = true } = options;

    // Base payload is always the ORIGINAL recipe when we have it, so the
    // recipient gets a clean base + optional variant on top.
    const base = recipe.originalRecipe || {};
    const recipeToShare = {
      ...recipe,
      title: base.title ?? recipe.title,
      ingredients: base.ingredients ?? recipe.ingredients,
      instructions: base.instructions ?? recipe.instructions,
      prep_time: base.prep_time ?? recipe.prep_time,
      cook_time: base.cook_time ?? recipe.cook_time,
      total_time: base.total_time ?? recipe.total_time,
      servings: base.servings ?? recipe.servings,
      nutrition: base.nutrition ?? recipe.nutrition,
      image_url: base.image_url || base.image || recipe.image_url,
    };

    // Build the shared variant when the sender wants to include their edits
    let sharedVariant = null;
    if (includeEdits && recipe.hasEdits) {
      const edited = getEffectiveEditedFields(recipe);
      sharedVariant = {
        name: `${profile?.username || 'Friend'}'s version`,
        sharedBy: profile?.username || null,
        edits: edited,
        createdAt: Date.now(),
      };
    }

    // If user is logged in, open friends picker
    if (user && profile) {
      // Strip user-specific + private-edit fields before sharing.
      // The sender's own variants/edit history must never leak; edits travel
      // ONLY via the explicit sharedVariant.
      const {
        deletedAt, id, folder, folders,
        variants, selectedVariantId, editHistory, editedVersion,
        hasEdits, viewingOriginal, originalRecipe, isFavorite, isPrivate,
        ...cleanRecipe
      } = recipeToShare;
      setShareItem({
        type: 'recipe',
        data: {
          ...cleanRecipe,
          sharedVariant,
          sharedWithEdits: !!sharedVariant,
        },
        name: recipe.title,
      });
      // Close recipe detail modal first (iOS modal stacking issue)
      if (selectedRecipe) {
        setSelectedRecipe(null);
        setTimeout(() => setShowShareToFriends(true), 300);
      } else {
        setShowShareToFriends(true);
      }
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
  // Handle import of a public recipe into current user's cookbooks
  const handleImportPublicRecipe = async (targetFolder) => {
    if (!importingRecipe) return;

    const newId = `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Snapshot of the owner's current recipe (used as the "original" version)
    const originalSnapshot = {
      title: importingRecipe.title,
      image_url: importingRecipe.image_url || importingRecipe.imageUrl || null,
      ingredients: importingRecipe.ingredients,
      instructions: importingRecipe.instructions,
    };

    const cleanedRecipe = {
      id: newId,
      title: importingRecipe.title,
      image_url: importingRecipe.image_url || importingRecipe.imageUrl || null,
      ingredients: importingRecipe.ingredients,
      instructions: importingRecipe.instructions,
      // Preserve original source_url so global_recipes stays linked to owner
      source_url: importingRecipe.source_url || importingRecipe.sourceUrl || null,
      url: importingRecipe.source_url || importingRecipe.sourceUrl || null,
      folder: targetFolder,
      folders: [targetFolder],
      notes: importingRecipe.notes || null,
      createdBy: importingRecipe.createdBy || (importingRecipe.ownerUserId ? {
        id: importingRecipe.ownerUserId,
        username: importingRecipe.ownerUsername,
      } : null),
      // Track owner for original-version sync
      originalOwnerId: importingRecipe.ownerUserId || null,
      originalOwnerRecipeId: importingRecipe.id || null,
      originalRecipe: originalSnapshot,
      importedFrom: importingRecipe.ownerUserId || null,
      importedAt: Date.now(),
      createdAt: Date.now(),
    };

    setShowImportFolderPicker(false);
    setImportingRecipe(null);
    setSelectedRecipe(null);

    const saved = await saveRecipe(cleanedRecipe);
    if (saved) {
      Alert.alert('Added', `"${cleanedRecipe.title}" added to ${targetFolder}!`);
    } else {
      Alert.alert('Error', 'Failed to add recipe. Please try again.');
    }
  };

  // Open the report modal for a recipe
  const openReportDialog = (recipe) => {
    setReportingRecipe(recipe);
    setReportingProfile(null);
    setReportReason('inappropriate');
    setReportDetails('');
  };

  // Open the report modal for a profile
  const openProfileReportDialog = ({ userId, username }) => {
    setReportingProfile({ userId, username });
    setReportingRecipe(null);
    setReportReason('inappropriate');
    setReportDetails('');
  };

  // Submit the report from the modal
  const handleSubmitReport = async () => {
    if (!user?.uid) return;
    const isProfileReport = !!reportingProfile;
    const target = isProfileReport ? reportingProfile : reportingRecipe;
    if (!target) return;

    setSubmittingReport(true);
    try {
      const result = await submitContentReport({
        reporterId: user.uid,
        reportedUserId: isProfileReport
          ? reportingProfile.userId
          : (reportingRecipe.ownerUserId || reportingRecipe.createdBy?.id || 'unknown'),
        contentType: isProfileReport ? 'profile' : 'recipe',
        contentId: isProfileReport ? reportingProfile.userId : reportingRecipe.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
      });

      setReportingRecipe(null);
      setReportingProfile(null);
      setReportDetails('');

      if (result?.rateLimited) {
        Alert.alert('Too Many Reports', 'You have submitted too many reports recently. Please try again later.');
      } else if (result?.duplicate) {
        Alert.alert('Already Reported', 'You already reported this recently. Our team will review it.');
      } else if (result?.success) {
        Alert.alert('Report Submitted', 'Thank you. Our team will review this content.');
      } else {
        Alert.alert('Report Failed', 'Could not submit your report. Please try again.');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  // --- AI recipe scanning (Phase 5) ---
  const [scanning, setScanning] = useState(false);
  // When one scan finds several recipes, they preview one at a time
  const scanQueueRef = useRef([]);

  const previewScanResult = (item) => {
    if (item.confidence !== 'high' || (item.warnings || []).length > 0) {
      const details = (item.warnings || []).join('\n• ');
      Alert.alert(
        'Check the Results',
        `The AI wasn't fully confident reading "${item.recipe.title}".${details ? `\n\n• ${details}` : ''}\n\nReview everything before saving.`
      );
    }
    setExtractedRecipe(item.recipe);
    setCurrentScreen('saveRecipe');
  };

  // Called after each save/cancel in the SaveRecipeScreen flow
  const advanceScanQueue = () => {
    if (scanQueueRef.current.length === 0) return false;
    const [next, ...rest] = scanQueueRef.current;
    scanQueueRef.current = rest;
    Alert.alert(
      'Next Scanned Recipe',
      `"${next.recipe.title}"${rest.length > 0 ? ` (${rest.length} more after this)` : ''}`,
      [
        {
          text: 'Skip All',
          style: 'cancel',
          onPress: () => { scanQueueRef.current = []; },
        },
        { text: 'Preview', onPress: () => previewScanResult(next) },
      ]
    );
    return true;
  };

  const processScanImages = async (assets) => {
    const base64Images = (assets || [])
      .map(a => a?.base64)
      .filter(Boolean)
      .slice(0, 3);
    if (base64Images.length === 0) return;

    setScanning(true);
    try {
      const result = await scanRecipeImages(base64Images);

      if (result.success) {
        const [first, ...rest] = result.results;
        scanQueueRef.current = rest;
        if (rest.length > 0) {
          Alert.alert(
            'Multiple Recipes Found',
            `Found ${result.results.length} recipes in your photos. You'll preview and save them one at a time.`
          );
        }
        previewScanResult(first);
        return;
      }

      if (result.error === 'limit_reached') {
        Alert.alert('Scan Limit Reached', result.message);
        return;
      }

      // No recipe found / AI problem - offer manual entry as fallback
      const failDetail = result.detail ? `\n\nDetails: ${result.detail}` : '';
      Alert.alert(
        'Scan Failed',
        (result.message || 'Could not read a recipe from the photo.') + failDetail,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => handleScanRecipe() },
          { text: 'Enter Manually', onPress: () => setCurrentScreen('create') },
        ]
      );
    } finally {
      setScanning(false);
    }
  };

  // Camera flow: capture pages one at a time, up to 3
  const captureCameraPages = async (pages = []) => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    });

    if (result.canceled) {
      if (pages.length > 0) {
        Alert.alert(
          'Scan Captured Pages?',
          `You have ${pages.length} page${pages.length > 1 ? 's' : ''} captured.`,
          [
            { text: 'Discard', style: 'cancel' },
            { text: 'Scan Now', onPress: () => processScanImages(pages) },
          ]
        );
      }
      return;
    }

    const nextPages = [...pages, result.assets[0]];
    if (nextPages.length >= 3) {
      await processScanImages(nextPages);
      return;
    }

    Alert.alert(
      `Page ${nextPages.length} Captured`,
      'Does the recipe continue on another page?',
      [
        { text: 'Scan Now', onPress: () => processScanImages(nextPages) },
        { text: 'Add Another Page', onPress: () => captureCameraPages(nextPages) },
      ]
    );
  };

  const handleScanRecipe = () => {
    Alert.alert(
      'Scan a Recipe',
      'Photograph a cookbook page, recipe card, or handwritten recipe. Multi-page recipes and pages with several recipes both work.\n\nScanned recipes are for your personal cookbook. Please don\'t publicly share copyrighted recipes or claim them as your own creation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Please allow camera access to scan recipes.');
              return;
            }
            await captureCameraPages([]);
          },
        },
        {
          text: 'Choose Photos',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Please allow photo access to scan recipes.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsMultipleSelection: true,
              selectionLimit: 3,
              quality: 0.7,
              base64: true,
            });
            if (!result.canceled) await processScanImages(result.assets);
          },
        },
      ]
    );
  };

  // Recipe deep links: <scheme>://recipe/<globalRecipeId> jumps to that
  // recipe's card - the user's own copy if saved, read-only otherwise
  const openRecipeFromLink = async (globalRecipeId) => {
    try {
      const existing = recipes.find(r => r.globalRecipeId === globalRecipeId && !r.deletedAt);
      if (existing) {
        setCurrentScreen('recipes');
        setSelectedRecipe(existing);
        return;
      }

      const globalRecipe = await getGlobalRecipeById(globalRecipeId);
      if (!globalRecipe) {
        Alert.alert('Recipe Not Found', 'This recipe link is invalid or the recipe was removed.');
        return;
      }

      const externalUrl = globalRecipe.source_url && !isInternalUrl(globalRecipe.source_url)
        ? globalRecipe.source_url
        : null;

      setCurrentScreen('recipes');
      setSelectedRecipe({
        id: `global-${globalRecipe.id}`,
        globalRecipeId: globalRecipe.id,
        title: globalRecipe.title,
        ingredients: globalRecipe.ingredients,
        instructions: globalRecipe.instructions,
        image_url: globalRecipe.image_url,
        url: externalUrl,
        source_url: externalUrl,
        prep_time: globalRecipe.prep_time,
        cook_time: globalRecipe.cook_time,
        total_time: globalRecipe.total_time,
        servings: globalRecipe.servings,
        nutrition: globalRecipe.nutrition,
        globalTags: globalRecipe.tags || [],
        isReadOnly: true,
      });
    } catch (err) {
      console.error('❌ Deep link open failed:', err);
      Alert.alert('Error', 'Could not open the shared recipe.');
    }
  };

  useDeepLinks(openRecipeFromLink);

  // Resolve a recipe's global (shared) id - local copies from older
  // storage may not carry it even though the cloud version exists
  const resolveRecipeGlobalId = async (recipe) => {
    if (recipe.globalRecipeId) return recipe.globalRecipeId;
    const storedUrl = recipe.url || recipe.sourceUrl || recipe.source_url;
    // With no stored URL this is an older local recipe whose global entry
    // may have been minted under any scheme the app has used, so try each
    // rather than assuming the current one.
    const candidates = storedUrl
      ? [storedUrl]
      : (user?.uid ? internalRecipeUrlCandidates(user.uid, recipe.id) : []);
    for (const url of candidates) {
      const globalRecipe = await findGlobalRecipeByUrl(url);
      if (globalRecipe?.id) return globalRecipe.id;
    }
    return null;
  };

  // Share-as-image state: mounting shareCard renders the card offscreen;
  // onReady fires once its hero image loads, then we capture
  const shareCardRef = useRef(null);
  const shareCardCaptured = useRef(false);
  const [shareCard, setShareCard] = useState(null); // { recipe, link }

  const shareRecipeAsImage = async (recipe) => {
    shareCardCaptured.current = false;
    // Best-effort link for the QR code - card still renders without one
    let link = null;
    try {
      const globalRecipeId = await resolveRecipeGlobalId(recipe);
      if (globalRecipeId) link = buildRecipeLink(globalRecipeId);
    } catch (err) {
      log('⚠️ No link for share card:', err?.message);
    }
    setShareCard({ recipe, link });
  };

  const handleShareCardReady = async () => {
    if (shareCardCaptured.current) return; // onLoadEnd + onError can both fire
    shareCardCaptured.current = true;
    try {
      // Give the just-loaded image a frame to commit before capturing
      await new Promise(resolve => setTimeout(resolve, 250));
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        width: 1080,
        height: 1920,
      });
      const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share Recipe',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
      }
    } catch (err) {
      console.error('❌ Share-as-image failed:', err);
      Alert.alert('Error', 'Could not create the recipe image. Please try again.');
    } finally {
      setShareCard(null);
    }
  };

  const copyRecipeLink = async (recipe) => {
    try {
      const globalRecipeId = await resolveRecipeGlobalId(recipe);

      if (!globalRecipeId) {
        Alert.alert(
          'Link Unavailable',
          'This recipe has not synced to the cloud yet. Make sure you are online, then try again.'
        );
        return;
      }

      const link = buildRecipeLink(globalRecipeId);
      Clipboard.setString(link);
      Alert.alert(
        'Link Copied',
        `${link}\n\nAnyone with the app can open this link to jump straight to the recipe. Paste it anywhere - a message, a post description, a bio.`
      );
    } catch (err) {
      console.error('❌ Copy link failed:', err);
      Alert.alert('Error', 'Could not create the recipe link.');
    }
  };

  const handleShareRecipe = (recipe) => {
    Alert.alert(
      'Share Recipe',
      'How would you like to share it?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share as Image', onPress: () => shareRecipeAsImage(recipe) },
        { text: 'Send to Friends', onPress: () => handleShareToFriends(recipe) },
        { text: 'Copy Link', onPress: () => copyRecipeLink(recipe) },
      ]
    );
  };

  const handleShareToFriends = (recipe) => {
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
        // Strip user-specific fields (folder, deletedAt, id) before sharing
        const { deletedAt, id, folder, ...cleanRecipe } = r;
        return cleanRecipe;
      });
      setShareItem({
        type: 'cookbook',
        data: cleanedRecipes,
        name: cookbookName,
      });
      // Close the folder manager first, then show friends picker (iOS modal stacking)
      setShowFolderManager(false);
      setTimeout(() => setShowShareToFriends(true), 300);
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
        'Import Error',
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
      Alert.alert('Success', `Recipe "${newRecipe.title}" imported to ${newRecipe.folder}!`);
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

      Alert.alert('Success', `Imported ${newRecipes.length} recipe${newRecipes.length > 1 ? 's' : ''} from "${parsed.name}" to ${finalFolder}`);
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
      // Update all recipes that have this folder in their folders array
      const recipesInFolder = recipes.filter(r => {
        const recipeFolders = r.folders || [r.folder || 'All Recipes'];
        return recipeFolders.includes(result.oldName);
      });

      for (const recipe of recipesInFolder) {
        // Remove old folder name, add new folder name
        await removeFromFolder(recipe.id, result.oldName, true);
        await addToFolder(recipe.id, result.newName, true);
      }

      setEditingFolder(null);
      setEditingFolderName('');
    }
  };

  const deleteFolder = async (folderName) => {
    const recipesInFolder = recipes.filter(r => {
      const recipeFolders = r.folders || [r.folder || 'All Recipes'];
      return recipeFolders.includes(folderName);
    });
    const success = await deleteFolderBase(folderName, recipesInFolder.length);

    if (success) {
      // Remove folder from all recipes (they stay in other folders or go to All Recipes)
      for (const recipe of recipesInFolder) {
        await removeFromFolder(recipe.id, folderName, true);
      }
    }
  };

  // Handle move to folder (legacy - replaces all folders)
  const handleMoveToFolder = (newFolder) => {
    // Check if we're in multiselect mode
    if (multiselectMode && selectedRecipes.size > 0) {
      handleMoveSelectedToFolder(newFolder);
    } else if (selectedRecipe) {
      moveRecipeToFolder(selectedRecipe.id, newFolder);
      setShowMoveToFolder(false);
    }
  };

  // Handle toggle folder membership (multi-folder support) - local state only
  const handleToggleFolder = (folder) => {
    if (pendingFolders.includes(folder)) {
      setPendingFolders(pendingFolders.filter(f => f !== folder));
    } else {
      setPendingFolders([...pendingFolders, folder]);
    }
  };

  // Save folder changes when Done is pressed
  const handleSaveFolders = async () => {
    if (!selectedRecipe) {
      setShowMoveToFolder(false);
      return;
    }

    const currentFolders = selectedRecipe.folders || [selectedRecipe.folder || 'All Recipes'];
    const customFolders = getCustomFolders();

    // Find folders to add and remove (only consider custom folders)
    const currentCustomFolders = currentFolders.filter(f => customFolders.includes(f));
    const foldersToAdd = pendingFolders.filter(f => !currentCustomFolders.includes(f));
    const foldersToRemove = currentCustomFolders.filter(f => !pendingFolders.includes(f));

    // Build final folders array directly (instead of sequential updates)
    let finalFolders = [...currentFolders];

    // Add new folders
    for (const folder of foldersToAdd) {
      if (!finalFolders.includes(folder)) {
        finalFolders.push(folder);
      }
    }

    // Remove folders
    finalFolders = finalFolders.filter(f => !foldersToRemove.includes(f));

    // Ensure at least 'All Recipes' if empty
    if (finalFolders.length === 0) {
      finalFolders = ['All Recipes'];
    }

    const primaryFolder = finalFolders.find(f => f !== 'All Recipes') || finalFolders[0];

    // Update recipe with final folders in one operation
    if (foldersToAdd.length > 0 || foldersToRemove.length > 0) {
      const updatedRecipe = {
        ...selectedRecipe,
        folders: finalFolders,
        folder: primaryFolder,
        updatedAt: Date.now(),
      };

      await updateRecipe(updatedRecipe);

      const changes = [];
      if (foldersToAdd.length > 0) {
        changes.push(`Added to: ${foldersToAdd.join(', ')}`);
      }
      if (foldersToRemove.length > 0) {
        changes.push(`Removed from: ${foldersToRemove.join(', ')}`);
      }
      Alert.alert('Cookbooks Updated', changes.join('\n'));
    }

    setShowMoveToFolder(false);
  };

  // Initialize pending folders when modal opens
  const openFolderModal = () => {
    if (selectedRecipe) {
      const currentFolders = selectedRecipe.folders || [selectedRecipe.folder || 'All Recipes'];
      const customFolders = getCustomFolders();
      setPendingFolders(currentFolders.filter(f => customFolders.includes(f)));
    }
    setShowMoveToFolder(true);
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

  // Get all unique tags from recipes for the filter (user + global auto-tags)
  const allTags = useMemo(() => {
    const tagSet = new Set();
    recipes.forEach(recipe => {
      combineRecipeTags(recipe).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [recipes]);

  // Tag search tracking - counts how often each tag is used as a filter.
  // Shape: { [tagLowercase]: { display, count, lastUsed } }.
  // Source of truth: Supabase user_settings.tag_search_counts;
  // AsyncStorage acts as a local cache / offline fallback.
  const [tagSearchCounts, setTagSearchCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      // Local cache first for instant UI
      const local = await loadTagSearchCounts(user?.uid);
      if (!cancelled && Object.keys(local).length > 0) {
        setTagSearchCounts(local);
      }
      if (!user?.uid) return;

      // Then cloud - merge per tag, keeping the higher count (also
      // migrates any counts gathered before cloud sync existed)
      const remote = await loadTagSearchCountsFromDatabase(user.uid);
      if (cancelled) return;
      const merged = { ...remote };
      let localAhead = false;
      for (const [key, entry] of Object.entries(local)) {
        const remoteEntry = merged[key];
        if (!remoteEntry || (entry.count || 0) > (remoteEntry.count || 0)) {
          merged[key] = entry;
          localAhead = true;
        }
      }
      setTagSearchCounts(merged);
      saveTagSearchCounts(merged, user.uid);
      if (localAhead) {
        saveTagSearchCountsToDatabase(user.uid, merged);
      }
    };
    loadCounts();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const recordTagSearch = (tag) => {
    const key = tag.toLowerCase();
    const existing = tagSearchCounts[key];
    const next = {
      ...tagSearchCounts,
      [key]: {
        display: existing?.display || tag,
        count: (existing?.count || 0) + 1,
        lastUsed: Date.now(),
      },
    };
    setTagSearchCounts(next);
    // Fire-and-forget: local cache + cloud
    saveTagSearchCounts(next, user?.uid);
    if (user?.uid) {
      saveTagSearchCountsToDatabase(user.uid, next);
    }
  };

  // Most-searched tags, for the Frequently Used section
  const frequentTags = useMemo(() => getFrequentTags(tagSearchCounts), [tagSearchCounts]);

  // Dietary analysis per recipe (computed from ingredients, never stored)
  const analysisById = useMemo(() => {
    const map = new Map();
    recipes.forEach(recipe => {
      map.set(recipe.id, analyzeRecipe(recipe.ingredients));
    });
    return map;
  }, [recipes]);

  // Load dietary preferences when the user changes
  useEffect(() => {
    let cancelled = false;
    if (user?.uid) {
      loadDietaryPreferences(user.uid).then(prefs => {
        if (!cancelled) setDietaryPrefs(prefs);
      });
    } else {
      setDietaryPrefs({ diets: [], avoid: [] });
    }
    return () => { cancelled = true; };
  }, [user?.uid]);

  // Save dietary preferences (from Settings)
  const updateDietaryPrefs = async (prefs) => {
    setDietaryPrefs(prefs);
    if (user?.uid) {
      await saveDietaryPreferences(user.uid, prefs);
    }
  };

  // Toggle tag in filter (selecting counts as a "search" for Frequently Used)
  const toggleTagFilter = (tag) => {
    if (!selectedTags.includes(tag)) {
      recordTagSearch(tag);
    }
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Toggle derived diet in filter
  const toggleDietFilter = (dietKey) => {
    setSelectedDiets(prev =>
      prev.includes(dietKey)
        ? prev.filter(d => d !== dietKey)
        : [...prev, dietKey]
    );
  };

  // Clear all tag filters
  const clearTagFilters = () => {
    setSelectedTags([]);
    setSelectedDiets([]);
  };

  // Sort and filter recipes based on selected sort option and tags
  const sortedRecipes = useMemo(() => {
    let recipesToSort = [...filteredRecipes];

    // Filter by selected tags (show recipes that have ANY of the selected
    // tags, counting both user tags and global auto-tags)
    if (selectedTags.length > 0) {
      recipesToSort = recipesToSort.filter(recipe => {
        const recipeTags = combineRecipeTags(recipe).map(t => t.toLowerCase());
        return selectedTags.some(tag => recipeTags.includes(tag.toLowerCase()));
      });
    }

    // Filter by derived diets (recipe must satisfy ALL selected diets)
    if (selectedDiets.length > 0) {
      recipesToSort = recipesToSort.filter(recipe => {
        const analysis = analysisById.get(recipe.id);
        if (!analysis || analysis.diets.length === 0) return false;
        return selectedDiets.every(diet => analysis.diets.includes(diet));
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
  }, [filteredRecipes, sortBy, sortOrder, selectedTags, selectedDiets, analysisById]);


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
          userId={user?.uid}
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
              <Text style={styles.headerTitle}>{APP_NAME}</Text>
            </TouchableOpacity>
          </View>

          {/* Actions Bar - light icon row like the Social sub-tabs */}
          <View style={styles.actionsBar}>
            <TouchableOpacity
              style={styles.actionBarButton}
              onPress={() => setCurrentScreen('create')}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBarButton}
              onPress={handleScanRecipe}
            >
              <Ionicons name="camera" size={22} color={colors.primary} />
            </TouchableOpacity>
            {showQuickLinkButton && (
              <TouchableOpacity
                style={styles.actionBarButton}
                onPress={() => setShowQuickLinkModal(true)}
              >
                <Ionicons name="link" size={22} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionBarButton}
              onPress={() => setShowIngredientSearch(true)}
            >
              <Ionicons name="search" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBarButton}
              onPress={() => setShowFolderManager(true)}
            >
              <Ionicons name="folder-open" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBarButton}
              onPress={() => setViewMode(viewMode === 'list' ? 'photo' : 'list')}
            >
              <Ionicons name={viewMode === 'list' ? 'image' : 'list'} size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Sort + Tags Bar */}
          <View style={styles.filterBar}>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setShowSortDropdown(!showSortDropdown)}
            >
              <Text style={styles.sortButtonText}>
                Sort: {sortBy === 'alphabetical' ? 'A-Z' : sortBy === 'dateAdded' ? 'Date Added' : 'Date Modified'}
                {sortOrder === 'asc' ? ' ↑' : ' ↓'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tagFilterButton, showTagFilter && styles.tagFilterButtonActive]}
              onPress={() => setShowTagFilter(!showTagFilter)}
            >
              <Ionicons
                name="pricetag"
                size={14}
                color={showTagFilter ? colors.primary : colors.text}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.tagFilterButtonText, showTagFilter && styles.tagFilterButtonTextActive]}>
                Tags {(selectedTags.length + selectedDiets.length) > 0 ? `(${selectedTags.length + selectedDiets.length})` : ''}
              </Text>
            </TouchableOpacity>
            {(selectedTags.length > 0 || selectedDiets.length > 0) && (
              <TouchableOpacity onPress={clearTagFilters} style={styles.clearTagsButton}>
                <Text style={styles.clearTagsButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedTagsScroll}>
              {selectedDiets.map(dietKey => (
                <TouchableOpacity
                  key={dietKey}
                  style={styles.tagChipActive}
                  onPress={() => toggleDietFilter(dietKey)}
                >
                  <Text style={styles.tagChipActiveText}>{dietLabel(dietKey)}</Text>
                  <Ionicons name="close" size={12} color="#fff" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
              {selectedTags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tagChipActive}
                  onPress={() => toggleTagFilter(tag)}
                >
                  <Text style={styles.tagChipActiveText}>{tag}</Text>
                  <Ionicons name="close" size={12} color="#fff" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.recipeCount}>{sortedRecipes.length} recipe{sortedRecipes.length !== 1 ? 's' : ''}</Text>
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
                {sortBy === 'alphabetical' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
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
                {sortBy === 'dateAdded' && sortOrder === 'desc' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
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
                {sortBy === 'dateAdded' && sortOrder === 'asc' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
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
                {sortBy === 'dateModified' && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            </View>
          )}

          {/* Tag Filter Dropdown */}
          {showTagFilter && (
            <View style={styles.tagFilterDropdown}>
              <ScrollView style={styles.tagFilterScrollView} nestedScrollEnabled>
                {/* Most-used tags first */}
                {frequentTags.length > 0 && (
                  <>
                    <Text style={styles.tagFilterSectionTitle}>Frequently Used</Text>
                    <View style={styles.tagFilterGrid}>
                      {frequentTags.map(tagName => (
                        <TouchableOpacity
                          key={tagName}
                          style={[
                            styles.tagFilterChip,
                            selectedTags.includes(tagName) && styles.tagFilterChipSelected
                          ]}
                          onPress={() => toggleTagFilter(tagName)}
                        >
                          <Text style={[
                            styles.tagFilterChipText,
                            selectedTags.includes(tagName) && styles.tagFilterChipTextSelected
                          ]}>
                            {tagName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Derived dietary filters - computed from ingredients */}
                <Text style={styles.tagFilterSectionTitle}>Dietary</Text>
                <View style={styles.tagFilterGrid}>
                  {DIETS.map(diet => (
                    <TouchableOpacity
                      key={diet.key}
                      style={[
                        styles.tagFilterChip,
                        styles.dietFilterChip,
                        selectedDiets.includes(diet.key) && styles.dietFilterChipSelected
                      ]}
                      onPress={() => toggleDietFilter(diet.key)}
                    >
                      <Ionicons
                        name="leaf"
                        size={12}
                        color={selectedDiets.includes(diet.key) ? '#fff' : colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[
                        styles.tagFilterChipText,
                        selectedDiets.includes(diet.key) ? styles.tagFilterChipTextSelected : { color: colors.primary }
                      ]}>
                        {diet.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.tagFilterHint}>
                  Detected from ingredients - always double-check labels
                </Text>
                {TAG_CATEGORIES.map(category => (
                  <View key={category.name}>
                    <Text style={styles.tagFilterSectionTitle}>{category.name}</Text>
                    <View style={styles.tagFilterGrid}>
                      {category.tags.map(tagName => (
                        <TouchableOpacity
                          key={tagName}
                          style={[
                            styles.tagFilterChip,
                            selectedTags.includes(tagName) && styles.tagFilterChipSelected
                          ]}
                          onPress={() => toggleTagFilter(tagName)}
                        >
                          <Text style={[
                            styles.tagFilterChipText,
                            selectedTags.includes(tagName) && styles.tagFilterChipTextSelected
                          ]}>
                            {tagName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
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

          {/* Cookbook title - shown when viewing a specific cookbook */}
          {currentFolder !== 'All Recipes' && (
            <View style={styles.folderTitleBar}>
              <Ionicons
                name={
                  currentFolder === 'Recently Deleted' ? 'trash'
                    : currentFolder === 'Favorites' ? 'star'
                    : 'book'
                }
                size={16}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.folderTitleText}>{currentFolder}</Text>
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
          onRefresh={refreshSocialData}
          currentUserId={user?.uid}
          onRecipePress={async (recipe) => {
            setCurrentScreen('recipes');
            try {
              const ownerId = recipe.ownerUserId;
              if (!ownerId) {
                console.warn('No ownerUserId on recipe, opening with partial data');
                setSelectedRecipe({
                  ...recipe,
                  ingredients: recipe.ingredients || { main: [] },
                  instructions: recipe.instructions || [],
                  isReadOnly: true,
                });
                return;
              }

              const full = await getFullPublicRecipe(ownerId, recipe.id);
              if (full) {
                setSelectedRecipe(full);
              } else {
                Alert.alert('Recipe Not Available', 'This recipe could not be loaded.');
              }
            } catch (err) {
              console.error('Failed to load public recipe:', err);
              Alert.alert('Error', 'Failed to load recipe details.');
            }
          }}
          recipes={recipes}
          onProfileUpdated={refreshSocialData}
          onReportProfile={({ userId, username }) => {
            setCurrentScreen('recipes');
            setTimeout(() => openProfileReportDialog({ userId, username }), 300);
          }}
          onAddVariantToRecipe={addVariantToRecipe}
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
          isAdmin={isAdmin}
          onOpenAdminReports={() => setShowAdminReports(true)}
          onOpenBlockedUsers={() => setShowBlockedUsers(true)}
          dietaryPrefs={dietaryPrefs}
          onUpdateDietaryPrefs={updateDietaryPrefs}
        />
      )}

      {currentScreen === 'grocery' && (
        <KitchenScreen
          isPremium={isPremium}
          userId={user?.uid}
          recipes={recipes}
          onOpenRecipe={(recipe) => setSelectedRecipe(recipe)}
          groceryList={groceryList}
          onToggleItem={handleToggleGroceryItem}
          onRemoveItem={handleRemoveGroceryItem}
          onClearChecked={handleClearCheckedItems}
          onClearAll={handleClearAllItems}
          onAddCustomItem={addCustomGroceryItem}
          onAddItemsToGroceryList={addItemsToGroceryList}
        />
      )}

      {currentScreen === 'discover' && (
        discoverEnabled ? (
          <DiscoverFeed
            userId={user?.uid}
            onOpenRecipe={async (card) => {
              try {
                const full = await getFullPublicRecipe(card.ownerUserId, card.id);
                if (full) {
                  setCurrentScreen('recipes');
                  setSelectedRecipe(full);
                } else {
                  Alert.alert('Recipe Not Available', 'This recipe could not be loaded.');
                }
              } catch (err) {
                console.error('Failed to load discover recipe:', err);
                Alert.alert('Error', 'Failed to load recipe details.');
              }
            }}
          />
        ) : (
          <View style={styles.discoverContainer}>
            <Ionicons name="compass" size={80} color={colors.primary} style={{ marginBottom: 20 }} />
            <Text style={styles.discoverTitle}>Discover</Text>
            <Text style={styles.discoverSubtitle}>Coming Soon</Text>
            <Text style={styles.discoverDescription}>
              Find new recipes, explore trending dishes, and discover content from the community.
            </Text>
            {log('[RENDER] Discover screen is being rendered')}
          </View>
        )
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
                    <Ionicons name="trash" size={14} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={[styles.toolbarButtonText, styles.deleteButtonText]}>
                      Delete
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
                const dietConflicts = getConflicts(analysisById.get(recipe.id), dietaryPrefs);
                const cardTags = combineRecipeTags(recipe);
                // Debug image_url
                if (viewMode === 'photo') {
                  log(`📷 Recipe "${recipe.title}" image_url:`, recipe.image_url ? recipe.image_url.substring(0, 50) + '...' : 'NONE');
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
                            <Ionicons name="checkmark" size={16} color="#fff" />
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
                          onError={(e) => log(`❌ Image failed to load for "${recipe.title}":`, e.nativeEvent.error)}
                          onLoad={() => log(`✅ Image loaded for "${recipe.title}"`)}
                        />
                      ) : (
                        <LetterPlaceholder title={recipe.title} size={40} style={styles.recipeImage} />
                      )
                    )}
                    <View style={styles.recipeCardContent}>
                      <View style={styles.recipeCardHeader}>
                        <Text style={styles.recipeTitle}>{recipe.title}</Text>
                        {dietConflicts.length > 0 && (
                          <Ionicons
                            name="alert-circle"
                            size={16}
                            color={colors.error}
                            style={{ marginLeft: 4, marginTop: 2 }}
                          />
                        )}
                        {!multiselectMode && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleFavorite(recipe.id);
                            }}
                            style={styles.favoriteButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons
                              name={recipe.isFavorite ? 'star' : 'star-outline'}
                              size={20}
                              color={recipe.isFavorite ? colors.favorite : colors.textTertiary}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      {/* Tag chips on recipe card - below title */}
                      {cardTags.length > 0 && (
                        <View style={styles.recipeCardTags}>
                          {(expandedTagsRecipeId === recipe.id ? cardTags : cardTags.slice(0, 3)).map(tag => (
                            <View
                              key={tag}
                              style={styles.recipeCardTagChip}
                            >
                              <Text style={styles.recipeCardTagText}>{tag}</Text>
                            </View>
                          ))}
                          {cardTags.length > 3 && (
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
                                {expandedTagsRecipeId === recipe.id ? 'less' : `+${cardTags.length - 3}`}
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
                        <View style={styles.recipeMetaRow}>
                          <Ionicons name="pencil" size={10} color={colors.primary} style={{ marginRight: 3 }} />
                          <Text style={styles.recipeCreator} numberOfLines={1}>
                            by {recipe.createdBy.username}
                          </Text>
                        </View>
                      )}
                      {recipe.source === 'scan' && (
                        <View style={styles.recipeMetaRow}>
                          <Ionicons name="camera" size={10} color={colors.textTertiary} style={{ marginRight: 3 }} />
                          <Text style={styles.recipeSource} numberOfLines={1}>
                            scanned{recipe.createdBy?.username ? ` by ${recipe.createdBy.username}` : ''}
                          </Text>
                        </View>
                      )}
                      {recipe.url && (
                        <View style={styles.recipeMetaRow}>
                          <Ionicons name="link" size={10} color={colors.textTertiary} style={{ marginRight: 3 }} />
                          <Text style={styles.recipeSource} numberOfLines={1}>
                            {new URL(recipe.url).hostname.replace('www.', '')}
                          </Text>
                        </View>
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
            <TouchableOpacity onPress={() => setShowFolderManager(false)} style={styles.modalCloseRow}>
              <Ionicons name="close" size={18} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.modalCloseButton}>Close</Text>
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
                let icon = 'book';
                let count = recipes.length;

                if (folder === 'Favorites') {
                  icon = 'star';
                  count = recipes.filter(r => r.isFavorite && !r.deletedAt).length;
                } else if (folder === 'Recently Deleted') {
                  icon = 'trash';
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
                      <Ionicons name={icon} size={18} color={colors.primary} style={styles.folderManagerIcon} />
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
                  // Count only non-deleted recipes in this folder (check folders array)
                  const recipeCount = recipes.filter(r => {
                    if (r.deletedAt) return false;
                    const recipeFolders = r.folders || [r.folder || 'All Recipes'];
                    return recipeFolders.includes(folder);
                  }).length;
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
                        <Ionicons
                          name={isPrivate ? 'lock-closed' : 'book'}
                          size={18}
                          color={colors.primary}
                          style={styles.folderManagerIcon}
                        />
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
          onShow={() => setRecipeModalTick(t => t + 1)}
        >
          {/* Android note: behavior="height" is a known cause of frozen
              ScrollViews inside Modals - Android resizes the window natively
              (adjustResize), so no KAV behavior is needed there. */}
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <StatusBar style="light" hidden={true} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedRecipe(null)} style={styles.modalCloseRow}>
                <Ionicons name="close" size={18} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.modalCloseButton}>Close</Text>
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
                    <Ionicons name="refresh" size={20} color="#fff" />
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
                    <Ionicons name="trash" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : selectedRecipe.isReadOnly ? (
                // Read-only actions for viewing another user's recipe
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={() => {
                      const importableFolders = getCustomFolders()
                        .filter(f => f !== MY_CREATIONS_FOLDER && !f.startsWith(MY_CREATIONS_FOLDER + '/'));
                      if (importableFolders.length === 0) {
                        Alert.alert('No Cookbooks', 'Create a cookbook first to add this recipe.', [
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
                        return;
                      }
                      setImportingRecipe(selectedRecipe);
                      setShowImportFolderPicker(true);
                    }}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="download" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openReportDialog(selectedRecipe)}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="flag" size={20} color="#fff" />
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
                    <Ionicons
                      name={selectedRecipe.isFavorite ? 'star' : 'star-outline'}
                      size={20}
                      color={selectedRecipe.isFavorite ? '#E9B44C' : '#fff'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleShareRecipe(selectedRecipe)}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="share-social" size={20} color="#fff" />
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
                        openFolderModal();
                      }
                    }}
                    style={styles.iconButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="book" size={20} color="#fff" />
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
                    <Ionicons name="trash" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <ScrollView
              key={`recipe-scroll-${recipeModalTick}`}
              style={styles.modalContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {selectedRecipe.deletedAt && (
                <View style={styles.deletedBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="trash" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.deletedBannerText}>
                      Deleted on {new Date(selectedRecipe.deletedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.deletedBannerSubtext}>
                    Use the buttons above to restore or permanently delete
                  </Text>
                </View>
              )}
              <RecipeDetail
                recipe={selectedRecipe}
                dietaryPrefs={dietaryPrefs}
                frequentTags={frequentTags}
                userId={user?.uid}
                onUpdate={selectedRecipe.deletedAt || selectedRecipe.isReadOnly ? null : updateRecipe}
                onAddToGroceryList={selectedRecipe.deletedAt ? null : handleAddToGroceryList}
                allRecipes={recipes}
                isFolderPrivate={isFolderPrivate(selectedRecipe.folder)}
                onToggleVersion={selectedRecipe.deletedAt || selectedRecipe.isReadOnly ? null : toggleRecipeVersion}
                onSelectVariant={selectedRecipe.deletedAt || selectedRecipe.isReadOnly ? null : selectVariant}
                onCreateVariant={selectedRecipe.deletedAt || selectedRecipe.isReadOnly ? null : createVariant}
                onDeleteVariant={selectedRecipe.deletedAt || selectedRecipe.isReadOnly ? null : deleteVariant}
                onViewOwnerProfile={(ownerId, username) => {
                  setSelectedRecipe(null);
                  setViewingUserProfile(ownerId);
                }}
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
                    <Text style={styles.addFolderTitle}>Add to Cookbooks</Text>
                    <Text style={{ color: colors.text + '99', marginBottom: 12, fontSize: 13 }}>
                      Recipe can be in multiple cookbooks
                    </Text>
                    {getFoldersForRecipe(selectedRecipe).map(folder => {
                      const isInFolder = pendingFolders.includes(folder);
                      return (
                        <TouchableOpacity
                          key={folder}
                          style={[styles.folderItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                          onPress={() => handleToggleFolder(folder)}
                        >
                          <Text style={styles.folderItemText}>{folder}</Text>
                          <View style={[styles.folderCheckbox, isInFolder && styles.folderCheckboxChecked]}>
                            {isInFolder && <Ionicons name="checkmark" size={14} color={colors.white} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    <View style={styles.addFolderButtons}>
                      <TouchableOpacity
                        style={[styles.addFolderButton, styles.cancelButton]}
                        onPress={handleSaveFolders}
                      >
                        <Text style={styles.cancelButtonText}>Done</Text>
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
                <Ionicons name="close" size={22} color={colors.textSecondary} style={{ padding: 4 }} />
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
                {`Add ${selectedRecipes.size} Recipe${selectedRecipes.size > 1 ? 's' : ''} to Cookbooks`}
              </Text>
              <Text style={{ color: colors.text + '99', marginBottom: 12, fontSize: 13 }}>
                Recipes can be in multiple cookbooks
              </Text>
              {(() => {
                // For multiselect, only show My Creations if ALL selected are custom
                const selectedRecipesList = recipes.filter(r => selectedRecipes.has(r.id));
                const allCustom = selectedRecipesList.every(r => isCustomRecipe(r));
                const availableFolders = allCustom
                  ? getCustomFolders()
                  : getCustomFolders().filter(f => f !== MY_CREATIONS_FOLDER && !f.startsWith(MY_CREATIONS_FOLDER + '/'));

                return availableFolders.map(folder => {
                  const isInFolder = pendingFolders.includes(folder);
                  return (
                    <TouchableOpacity
                      key={folder}
                      style={[styles.folderItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                      onPress={() => handleToggleFolderMultiselect(folder)}
                    >
                      <Text style={styles.folderItemText}>{folder}</Text>
                      <View style={[styles.folderCheckbox, isInFolder && styles.folderCheckboxChecked]}>
                        {isInFolder && <Ionicons name="checkmark" size={14} color={colors.white} />}
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
              <View style={styles.addFolderButtons}>
                <TouchableOpacity
                  style={[styles.addFolderButton, styles.cancelButton]}
                  onPress={handleSaveFoldersMultiselect}
                >
                  <Text style={styles.cancelButtonText}>Done</Text>
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
                      // Already saved? Say so rather than extracting a
                      // recipe the save step would then discard.
                      const pasted = normalizeRecipeUrl(await resolveShareUrl(importText.trim()));
                      const already = findRecipeByUrl(pasted);
                      if (already) {
                        setImportText('');
                        setShowImport(false);
                        Alert.alert(
                          'Already Saved',
                          `"${already.title}" is already in your recipes.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'View Recipe', onPress: () => {
                              setCurrentScreen('recipes');
                              setSelectedRecipe(already);
                            } },
                          ]
                        );
                        return;
                      }
                      // It's a URL, use extraction
                      await extractRecipe(pasted);
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

      {/* Public User Profile Modal (from recipe owner link) */}
      <UserProfile
        visible={!!viewingUserProfile}
        onClose={() => setViewingUserProfile(null)}
        targetUserId={viewingUserProfile}
        currentUserId={user?.uid}
        onRecipePress={async (recipe) => {
          setViewingUserProfile(null);
          try {
            const ownerId = recipe.ownerUserId;
            if (!ownerId) return;
            const full = await getFullPublicRecipe(ownerId, recipe.id);
            if (full) setSelectedRecipe(full);
          } catch (err) {
            console.error('Failed to load recipe:', err);
          }
        }}
        onReportProfile={({ userId, username }) => {
          setViewingUserProfile(null);
          setTimeout(() => openProfileReportDialog({ userId, username }), 300);
        }}
      />

      {/* Import Public Recipe Folder Picker */}
      <Modal
        visible={showImportFolderPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowImportFolderPicker(false)}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowImportFolderPicker(false)} style={styles.modalCloseRow}>
              <Ionicons name="close" size={18} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Add to Cookbook</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            {getCustomFolders()
              .filter(f => f !== MY_CREATIONS_FOLDER && !f.startsWith(MY_CREATIONS_FOLDER + '/'))
              .map((folder) => (
              <TouchableOpacity
                key={folder}
                style={styles.folderManagerItem}
                onPress={() => handleImportPublicRecipe(folder)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="book" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                  <Text style={styles.folderManagerItemText}>{folder}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Report Content Modal (recipes or profiles) */}
      <Modal
        visible={!!(reportingRecipe || reportingProfile)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (submittingReport) return;
          setReportingRecipe(null);
          setReportingProfile(null);
        }}
      >
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => { setReportingRecipe(null); setReportingProfile(null); }}
                disabled={submittingReport}
                style={[styles.modalCloseRow, submittingReport && { opacity: 0.4 }]}
              >
                <Ionicons name="close" size={18} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.modalCloseButton}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>
                {reportingProfile ? `Report @${reportingProfile.username}` : 'Report Recipe'}
              </Text>
              <TouchableOpacity
                onPress={handleSubmitReport}
                disabled={submittingReport}
              >
                {submittingReport ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButton}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: colors.text }}>
                Reason
              </Text>
              {[
                { key: 'inappropriate', label: 'Inappropriate content' },
                { key: 'hate_harassment', label: 'Hate or harassment' },
                { key: 'spam', label: 'Spam or misleading' },
                { key: 'other', label: 'Other' },
              ].map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: reportReason === option.key ? colors.primary : colors.border,
                    backgroundColor: reportReason === option.key ? colors.primaryLight : '#fff',
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                  onPress={() => setReportReason(option.key)}
                >
                  <Text style={{ fontSize: 18, marginRight: 10 }}>
                    {reportReason === option.key ? '●' : '○'}
                  </Text>
                  <Text style={{ fontSize: 15, color: colors.text }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8, color: colors.text }}>
                Additional details (optional)
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                Give us more context so we can review this faster.
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 15,
                  color: colors.text,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
                placeholder="Describe the issue (max 500 characters)"
                placeholderTextColor={colors.textSecondary}
                value={reportDetails}
                onChangeText={(text) => setReportDetails(text.slice(0, 500))}
                multiline
                maxLength={500}
              />
              <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: 4 }}>
                {reportDetails.length}/500
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Admin Reports Review */}
      <AdminReports
        visible={showAdminReports}
        onClose={() => setShowAdminReports(false)}
        onOpenRecipe={(recipe) => {
          setShowAdminReports(false);
          setSelectedRecipe(recipe);
        }}
        onOpenProfile={(userId) => {
          setShowAdminReports(false);
          setViewingUserProfile(userId);
        }}
      />

      {/* Blocked Users */}
      <BlockedUsers
        visible={showBlockedUsers}
        onClose={() => setShowBlockedUsers(false)}
        currentUserId={user?.uid}
      />

      {/* First-launch disclaimer */}
      <DisclaimerModal
        visible={showDisclaimer}
        onAccept={() => setShowDisclaimer(false)}
      />

      {/* Recipe extraction loading overlay */}
      {loading && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <View style={{
            backgroundColor: '#fff',
            padding: 24,
            borderRadius: 12,
            alignItems: 'center',
            minWidth: 200,
          }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: colors.text }}>
              Extracting recipe…
            </Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
              This can take up to 30 seconds
            </Text>
          </View>
        </View>
      )}

      {/* AI recipe scanning overlay */}
      {scanning && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <View style={{
            backgroundColor: '#fff',
            padding: 24,
            borderRadius: 12,
            alignItems: 'center',
            minWidth: 200,
          }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: colors.text }}>
              Reading your recipe…
            </Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
              The AI is extracting it from your photo
            </Text>
          </View>
        </View>
      )}

      {/* Offscreen share card - mounted only while capturing a share image */}
      {shareCard && (
        <View
          ref={shareCardRef}
          collapsable={false}
          style={{
            position: 'absolute',
            left: -SHARE_CARD_WIDTH * 3,
            top: 0,
            width: SHARE_CARD_WIDTH,
            height: SHARE_CARD_HEIGHT,
          }}
        >
          <RecipeShareCard
            recipe={shareCard.recipe}
            link={shareCard.link}
            onReady={handleShareCardReady}
          />
        </View>
      )}

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
    height: 100,
    paddingTop: 38,
    paddingBottom: 8,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionBarButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
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
  recipeMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  recipeCreator: {
    fontSize: 10,
    color: colors.primary,
    fontStyle: 'italic',
    flex: 1,
  },
  recipeSource: {
    fontSize: 10,
    color: colors.textTertiary,
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  modalCloseRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 20,
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
    marginRight: 10,
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
    color: colors.text,
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
  folderCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    color: colors.text,
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: colors.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  folderTitleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 4,
  },
  folderTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
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
    marginRight: 8,
  },
  sortButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  recipeCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginLeft: 8,
  },
  sortDropdown: {
    position: 'absolute',
    top: 192, // Below header + actions bar + sort/tags bar
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
  // Tag Filter Styles
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
    flex: 1,
  },
  tagChipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: colors.primary,
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
    borderColor: colors.border,
    marginBottom: 4,
  },
  tagFilterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagFilterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tagFilterChipTextSelected: {
    color: '#fff',
  },
  dietFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.primary,
  },
  dietFilterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagFilterHint: {
    fontSize: 11,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 4,
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
    backgroundColor: colors.navBar || colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.navBarBorder || colors.border,
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
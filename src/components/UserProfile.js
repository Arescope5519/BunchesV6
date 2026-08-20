/**
 * UserProfile Component
 * Displays another user's profile with new layout:
 * - Top: Avatar (left) + Username (right) + Stats
 * - Featured recipes section
 * - Public recipes button
 * - Public folders button
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import LetterPlaceholder from './LetterPlaceholder';
import { log } from '../utils/log';
import {
  getPublicProfile,
  getUserPublicFolders,
  getUserFavorites,
  getUserFolderRecipes,
  getUserFeaturedRecipes,
  getUserPublicRecipes,
  isFollowing as checkIsFollowing,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  getBlockStatus,
} from '../services/supabase/social';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RECIPE_CARD_WIDTH = 140;

const UserProfile = ({
  visible,
  onClose,
  targetUserId,
  currentUserId,
  onRecipePress,
  onReportProfile,
}) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [featuredRecipes, setFeaturedRecipes] = useState([]);
  const [sampleRecipes, setSampleRecipes] = useState([]);
  const [publicFolders, setPublicFolders] = useState([]);
  const [currentView, setCurrentView] = useState('main'); // 'main', 'recipes', 'folders', 'folder-detail'
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderRecipes, setFolderRecipes] = useState([]);
  const [publicRecipes, setPublicRecipes] = useState([]);
  const [uncategorizedRecipes, setUncategorizedRecipes] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [blockStatus, setBlockStatus] = useState({ blocking: false, blockedBy: false });
  const [blockActionLoading, setBlockActionLoading] = useState(false);

  const CARD_WIDTH = SCREEN_WIDTH - 48; // Full width minus padding

  useEffect(() => {
    if (visible && targetUserId && currentUserId) {
      loadProfile();
    }
  }, [visible, targetUserId, currentUserId]);

  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      setCurrentView('main');
      setSelectedFolder(null);
      setProfile(null);
    }
  }, [visible]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [profileData, following, blocks] = await Promise.all([
        getPublicProfile(targetUserId, currentUserId),
        checkIsFollowing(currentUserId, targetUserId),
        getBlockStatus(currentUserId, targetUserId),
      ]);
      setProfile(profileData);
      setIsFollowing(following);
      setBlockStatus(blocks);

      if (profileData?.canView) {
        const [featured, folders, allRecipes] = await Promise.all([
          getUserFeaturedRecipes(targetUserId),
          getUserPublicFolders(targetUserId),
          getUserPublicRecipes(targetUserId),
        ]);
        log('📷 Featured recipes loaded:', featured?.length, featured);
        log('📁 Public folders loaded:', folders?.length);
        setFeaturedRecipes(featured || []);
        setPublicFolders(folders || []);

        // Get 5 random sample recipes (excluding featured)
        const featuredIds = (featured || []).map(r => r.id);
        const nonFeatured = (allRecipes || []).filter(r => !featuredIds.includes(r.id));
        const shuffled = nonFeatured.sort(() => Math.random() - 0.5);
        setSampleRecipes(shuffled.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const performUnfollow = async () => {
    setFollowLoading(true);
    try {
      await unfollowUser(currentUserId, targetUserId);
      setIsFollowing(false);
      setProfile(prev => ({
        ...prev,
        followerCount: Math.max((prev.followerCount || 1) - 1, 0),
        // Mutual follow IS friendship, so breaking either direction
        // ends it (the database trigger updates both friends[] caches)
        isFriend: false,
      }));
    } catch (error) {
      console.error('Error unfollowing:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (isFollowing) {
      if (profile?.isFriend) {
        Alert.alert(
          'Remove Friend?',
          `You and @${profile?.username} are friends. Unfollowing ends the friendship - they will no longer see your private recipes, and you will need a new friend request to reconnect.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Unfollow', style: 'destructive', onPress: performUnfollow },
          ]
        );
      } else {
        performUnfollow();
      }
      return;
    }
    setFollowLoading(true);
    try {
      await followUser(currentUserId, targetUserId);
      setIsFollowing(true);
      setProfile(prev => ({
        ...prev,
        followerCount: (prev.followerCount || 0) + 1,
      }));
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlockToggle = async () => {
    setBlockActionLoading(true);
    try {
      if (blockStatus.blocking) {
        const ok = await unblockUser(currentUserId, targetUserId);
        if (ok) setBlockStatus(prev => ({ ...prev, blocking: false }));
      } else {
        const ok = await blockUser(currentUserId, targetUserId);
        if (ok) {
          setBlockStatus(prev => ({ ...prev, blocking: true }));
          // Also unfollow if we were following
          if (isFollowing) {
            await unfollowUser(currentUserId, targetUserId);
            setIsFollowing(false);
          }
        }
      }
    } finally {
      setBlockActionLoading(false);
    }
  };

  const openActionMenu = () => {
    const username = profile?.username || 'user';
    const buttons = [
      { text: 'Report', onPress: () => onReportProfile?.({ userId: targetUserId, username }) },
      {
        text: blockStatus.blocking ? 'Unblock' : 'Block',
        style: blockStatus.blocking ? 'default' : 'destructive',
        onPress: () => {
          if (blockStatus.blocking) {
            handleBlockToggle();
          } else {
            Alert.alert(
              `Block @${username}?`,
              'They won\'t be able to interact with you and you won\'t see their content.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: handleBlockToggle },
              ]
            );
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ];
    Alert.alert(`@${username}`, null, buttons);
  };

  const loadPublicRecipes = async () => {
    setCurrentView('recipes');
    setLoadingContent(true);
    try {
      const recipes = await getUserPublicRecipes(targetUserId);
      setPublicRecipes(recipes);
    } catch (error) {
      console.error('Error loading public recipes:', error);
      setPublicRecipes([]);
    } finally {
      setLoadingContent(false);
    }
  };

  const loadFolderRecipes = async (folderName) => {
    setSelectedFolder(folderName);
    setCurrentView('folder-detail');
    setLoadingContent(true);
    try {
      const recipes = await getUserFolderRecipes(targetUserId, folderName);
      setFolderRecipes(recipes);
    } catch (error) {
      console.error('Error loading folder recipes:', error);
      setFolderRecipes([]);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleClose = () => {
    setCurrentView('main');
    setSelectedFolder(null);
    onClose();
  };

  const handleBack = () => {
    if (currentView === 'folder-detail') {
      setCurrentView('folders');
      setSelectedFolder(null);
    } else {
      setCurrentView('main');
    }
  };

  const renderRecipeCard = (recipe, isSmall = false) => (
    <TouchableOpacity
      key={recipe.id}
      style={[styles.recipeCard, isSmall && styles.recipeCardSmall]}
      onPress={() => onRecipePress?.({ ...recipe, ownerUserId: targetUserId })}
    >
      {recipe.imageUrl ? (
        <Image
          source={{ uri: recipe.imageUrl }}
          style={[styles.recipeImage, isSmall && styles.recipeImageSmall]}
        />
      ) : (
        <LetterPlaceholder title={recipe.title} size={28} style={[styles.recipeImage, isSmall && styles.recipeImageSmall]} />
      )}
      <Text style={[styles.recipeCardTitle, isSmall && styles.recipeCardTitleSmall]} numberOfLines={2}>
        {recipe.title}
      </Text>
    </TouchableOpacity>
  );

  const renderRecipeList = (recipes, emptyMessage) => {
    if (loadingContent) {
      return <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />;
    }

    if (recipes.length === 0) {
      return <Text style={styles.emptyText}>{emptyMessage}</Text>;
    }

    return (
      <ScrollView style={styles.recipeList}>
        {recipes.map(recipe => (
          <TouchableOpacity
            key={recipe.id}
            style={styles.recipeListItem}
            onPress={() => onRecipePress?.({ ...recipe, ownerUserId: targetUserId })}
          >
            {recipe.imageUrl ? (
              <Image source={{ uri: recipe.imageUrl }} style={styles.recipeListImage} />
            ) : (
              <LetterPlaceholder title={recipe.title} size={22} style={styles.recipeListImage} />
            )}
            <View style={styles.recipeListInfo}>
              <Text style={styles.recipeListTitle} numberOfLines={2}>{recipe.title}</Text>
              {recipe.isCustom && (
                <Text style={styles.customBadge}>Original Recipe</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderPublicRecipesView = () => (
    <View style={styles.subView}>
      <View style={styles.subViewHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.subViewTitle}>My Creations</Text>
        <View style={styles.headerSpacer} />
      </View>
      {renderRecipeList(publicRecipes, 'No recipes created yet')}
    </View>
  );

  const loadUncategorizedRecipes = async () => {
    setSelectedFolder('Uncategorized');
    setCurrentView('folder-detail');
    setLoadingContent(true);
    try {
      const allRecipes = await getUserPublicRecipes(targetUserId);
      // Filter recipes that don't have a specific cookbook folder
      const uncategorized = (allRecipes || []).filter(recipe => {
        const folders = recipe.folders || [];
        // Recipe is uncategorized if it has no folders, or only has "All Recipes" or "My Creations"
        return folders.length === 0 ||
               folders.every(f => f === 'All Recipes' || f === 'My Creations');
      });
      setFolderRecipes(uncategorized);
    } catch (error) {
      console.error('Error loading uncategorized recipes:', error);
      setFolderRecipes([]);
    } finally {
      setLoadingContent(false);
    }
  };

  const renderFoldersView = () => (
    <View style={styles.subView}>
      <View style={styles.subViewHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.subViewTitle}>Cookbooks</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.foldersList}>
        {publicFolders.map(folder => (
          <TouchableOpacity
            key={folder.fullPath || folder.name}
            style={styles.folderListItem}
            onPress={() => loadFolderRecipes(folder.fullPath || folder.name)}
          >
            <Ionicons name="book" size={18} color={colors.primary} style={styles.folderIcon} />
            <Text style={styles.folderListName}>{folder.displayName || folder.name}</Text>
            <Text style={styles.folderArrow}>{'>'}</Text>
          </TouchableOpacity>
        ))}

        {/* Uncategorized folder for recipes without a cookbook */}
        <TouchableOpacity
          style={styles.folderListItem}
          onPress={loadUncategorizedRecipes}
        >
          <Ionicons name="list" size={18} color={colors.primary} style={styles.folderIcon} />
          <Text style={styles.folderListName}>Uncategorized</Text>
          <Text style={styles.folderArrow}>{'>'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderFolderDetailView = () => {
    // Extract display name from full path
    const displayName = selectedFolder?.includes('/')
      ? selectedFolder.substring(selectedFolder.lastIndexOf('/') + 1)
      : selectedFolder;

    return (
      <View style={styles.subView}>
        <View style={styles.subViewHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>{'<'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.subViewTitle}>{displayName}</Text>
          <View style={styles.headerSpacer} />
        </View>
        {renderRecipeList(folderRecipes, 'No recipes in this cookbook')}
      </View>
    );
  };

  const renderMainView = () => {
    if (blockStatus.blocking) {
      return (
        <View style={styles.privateProfileContainer}>
          <Ionicons name="ban" size={44} color={colors.textLight} style={styles.privateProfileIcon} />
          <Text style={styles.privateProfileTitle}>Blocked</Text>
          <Text style={styles.privateProfileText}>
            You have blocked this user. Their content is hidden. Tap ⋯ to unblock.
          </Text>
        </View>
      );
    }
    if (blockStatus.blockedBy) {
      return (
        <View style={styles.privateProfileContainer}>
          <Ionicons name="ban" size={44} color={colors.textLight} style={styles.privateProfileIcon} />
          <Text style={styles.privateProfileTitle}>Not Available</Text>
          <Text style={styles.privateProfileText}>
            This profile is not available.
          </Text>
        </View>
      );
    }
    if (!profile?.canView) {
      return (
        <View style={styles.privateProfileContainer}>
          <Ionicons name="lock-closed" size={44} color={colors.textLight} style={styles.privateProfileIcon} />
          <Text style={styles.privateProfileTitle}>Private Profile</Text>
          <Text style={styles.privateProfileText}>
            This user's profile is private. Send a friend request to view their recipes.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Featured Recipes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Recipes ({featuredRecipes.length})</Text>
          {featuredRecipes.length === 0 ? (
            <Text style={styles.emptyText}>No featured recipes</Text>
          ) : (
            <View>
              <FlatList
                data={featuredRecipes}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 12}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 16 }}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 12));
                  setFeaturedIndex(index);
                }}
                keyExtractor={(item) => item.id}
                renderItem={({ item: recipe }) => (
                  <TouchableOpacity
                    style={[styles.featuredCard, { width: CARD_WIDTH }]}
                    onPress={() => onRecipePress?.({ ...recipe, ownerUserId: targetUserId })}
                    activeOpacity={0.9}
                  >
                    {recipe.imageUrl ? (
                      <Image
                        source={{ uri: recipe.imageUrl }}
                        style={styles.featuredImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <LetterPlaceholder title={recipe.title} size={56} style={styles.featuredImage} />
                    )}
                    <View style={styles.featuredOverlay}>
                      <Text style={styles.featuredTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      {recipe.isCustom && (
                        <Text style={styles.featuredBadge}>Original Recipe</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
              {/* Page Indicator Dots */}
              {featuredRecipes.length > 1 && (
                <View style={styles.pageIndicator}>
                  {featuredRecipes.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.pageDot,
                        index === featuredIndex && styles.pageDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Sample Recipes Section */}
        {sampleRecipes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipes</Text>
            {sampleRecipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.sampleRecipeRow}
                onPress={() => onRecipePress?.({ ...recipe, ownerUserId: targetUserId })}
              >
                {recipe.imageUrl ? (
                  <Image
                    source={{ uri: recipe.imageUrl }}
                    style={styles.sampleRecipeImage}
                    resizeMode="cover"
                  />
                ) : (
                  <LetterPlaceholder title={recipe.title} size={20} style={styles.sampleRecipeImage} />
                )}
                <View style={styles.sampleRecipeInfo}>
                  <Text style={styles.sampleRecipeTitle} numberOfLines={1}>{recipe.title}</Text>
                  {recipe.isCustom && (
                    <Text style={styles.sampleRecipeBadge}>Original</Text>
                  )}
                </View>
                <Text style={styles.sampleRecipeArrow}>{'>'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* View All Recipes Button */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setCurrentView('folders')}
          >
            <Ionicons name="library" size={18} color={colors.primary} style={styles.actionButtonIcon} />
            <View style={styles.actionButtonTextContainer}>
              <Text style={styles.actionButtonTitle}>{profile?.username || 'User'}'s Cookbooks</Text>
              <Text style={styles.actionButtonSubtitle}>Browse all cookbooks</Text>
            </View>
            <Text style={styles.actionButtonArrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case 'recipes':
        return renderPublicRecipesView();
      case 'folders':
        return renderFoldersView();
      case 'folder-detail':
        return renderFolderDetailView();
      default:
        return renderMainView();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : !profile ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Could not load profile</Text>
          </View>
        ) : (
          <>
            {/* Profile Header - Avatar Left, Info Right */}
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.profileHeaderInfo}>
                <Text style={styles.username}>@{profile.username}</Text>
                <View style={styles.badges}>
                  {profile.isPublic && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Public</Text>
                    </View>
                  )}
                  {profile.isFriend && (
                    <View style={[styles.badge, styles.friendBadge]}>
                      <Text style={styles.badgeText}>Friend</Text>
                    </View>
                  )}
                </View>
              </View>
              {/* Follow Button - public profiles only. Private users are
                  reached through friend requests; friendship with them is
                  managed from the Friends tab, not this toggle */}
              {currentUserId !== targetUserId && !blockStatus.blocking && (profile.isPublic || isFollowing) && (
                <TouchableOpacity
                  style={[
                    styles.followButton,
                    isFollowing && styles.followingButton,
                  ]}
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                >
                  <Text style={[
                    styles.followButtonText,
                    isFollowing && styles.followingButtonText,
                  ]}>
                    {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
              {/* Actions Menu */}
              {currentUserId !== targetUserId && (
                <TouchableOpacity
                  onPress={openActionMenu}
                  style={{ padding: 8, marginLeft: 8 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={{ fontSize: 22, color: '#666' }}>⋯</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{profile.followerCount || 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{profile.followingCount || 0}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{profile.recipeCount || 0}</Text>
                <Text style={styles.statLabel}>Recipes</Text>
              </View>
            </View>

            {/* Main Content */}
            {renderContent()}
          </>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 8,
    minWidth: 60,
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  headerSpacer: {
    width: 60,
  },
  loader: {
    marginTop: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
  },

  // Profile Header - Horizontal layout
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: colors.white,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
  },
  profileHeaderInfo: {
    marginLeft: 16,
    flex: 1,
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  badges: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  friendBadge: {
    backgroundColor: colors.success + '20',
  },
  badgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },

  // Follow Button
  followButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  followingButtonText: {
    color: colors.text,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // Content
  content: {
    flex: 1,
  },
  section: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  horizontalScroll: {
    paddingLeft: 16,
  },
  horizontalScrollContent: {
    paddingRight: 16,
  },

  // Featured Recipe Carousel
  featuredCard: {
    width: Dimensions.get('window').width - 48,
    height: 220,
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.border,
  },
  featuredImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredPlaceholderText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  featuredOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  featuredBadge: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  pageDotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },

  // Recipe Cards
  recipeCard: {
    width: RECIPE_CARD_WIDTH,
    marginRight: 12,
  },
  recipeCardSmall: {
    width: 100,
  },
  recipeImage: {
    width: RECIPE_CARD_WIDTH,
    height: RECIPE_CARD_WIDTH,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  recipeImageSmall: {
    width: 100,
    height: 100,
  },
  recipeImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  placeholderTextSmall: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  recipeCardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginTop: 8,
  },
  recipeCardTitleSmall: {
    fontSize: 12,
  },

  // Action Buttons
  actionButtons: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  actionButtonTextContainer: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionButtonSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionButtonArrow: {
    fontSize: 20,
    color: colors.textSecondary,
  },

  // Private Profile
  privateProfileContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  privateProfileIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  privateProfileTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  privateProfileText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Sub Views
  subView: {
    flex: 1,
  },
  subViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
    minWidth: 60,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  subViewTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },

  // Recipe List (vertical)
  recipeList: {
    flex: 1,
    padding: 16,
  },
  recipeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeListImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  recipeListInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recipeListTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  customBadge: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
  },

  // Folders List
  foldersList: {
    flex: 1,
    padding: 16,
  },
  folderListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  folderIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  folderListName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  folderArrow: {
    fontSize: 18,
    color: colors.textSecondary,
  },

  // Sample Recipes List
  sampleRecipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sampleRecipeImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  sampleRecipeImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  samplePlaceholderText: {
    fontSize: 20,
  },
  sampleRecipeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sampleRecipeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sampleRecipeBadge: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 2,
  },
  sampleRecipeArrow: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 8,
  },
});

export default UserProfile;

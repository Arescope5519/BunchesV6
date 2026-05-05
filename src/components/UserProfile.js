/**
 * UserProfile Component
 * Displays another user's profile with favorites and public folders
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import colors from '../constants/colors';
import {
  getPublicProfile,
  getUserPublicFolders,
  getUserFavorites,
  getUserFolderRecipes,
} from '../services/supabase/social';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RECIPE_CARD_WIDTH = 140;
const RECIPE_CARD_HEIGHT = 180;

const UserProfile = ({ visible, onClose, targetUserId, currentUserId, onRecipePress }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [publicFolders, setPublicFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderRecipes, setFolderRecipes] = useState([]);
  const [loadingFolderRecipes, setLoadingFolderRecipes] = useState(false);

  useEffect(() => {
    if (visible && targetUserId && currentUserId) {
      loadProfile();
    }
  }, [visible, targetUserId, currentUserId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const profileData = await getPublicProfile(targetUserId, currentUserId);
      setProfile(profileData);

      if (profileData?.canView) {
        const [favs, folders] = await Promise.all([
          getUserFavorites(targetUserId),
          getUserPublicFolders(targetUserId),
        ]);
        setFavorites(favs);
        setPublicFolders(folders);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFolderRecipes = async (folderName) => {
    setSelectedFolder(folderName);
    setLoadingFolderRecipes(true);
    try {
      const recipes = await getUserFolderRecipes(targetUserId, folderName);
      setFolderRecipes(recipes);
    } catch (error) {
      console.error('Error loading folder recipes:', error);
      setFolderRecipes([]);
    } finally {
      setLoadingFolderRecipes(false);
    }
  };

  const handleClose = () => {
    setProfile(null);
    setFavorites([]);
    setPublicFolders([]);
    setSelectedFolder(null);
    setFolderRecipes([]);
    onClose();
  };

  const renderRecipeCard = (recipe) => (
    <TouchableOpacity
      key={recipe.id}
      style={styles.recipeCard}
      onPress={() => onRecipePress?.(recipe)}
    >
      {recipe.imageUrl ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.recipeImage} />
      ) : (
        <View style={[styles.recipeImage, styles.recipeImagePlaceholder]}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}
      <Text style={styles.recipeTitle} numberOfLines={2}>
        {recipe.title}
      </Text>
    </TouchableOpacity>
  );

  const renderFolderContent = () => {
    if (!selectedFolder) return null;

    return (
      <View style={styles.folderContent}>
        <View style={styles.folderContentHeader}>
          <TouchableOpacity onPress={() => setSelectedFolder(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>{'<'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.folderContentTitle}>{selectedFolder}</Text>
        </View>

        {loadingFolderRecipes ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : folderRecipes.length === 0 ? (
          <Text style={styles.emptyText}>No recipes in this cookbook</Text>
        ) : (
          <ScrollView style={styles.folderRecipesList}>
            {folderRecipes.map(recipe => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.folderRecipeItem}
                onPress={() => onRecipePress?.(recipe)}
              >
                {recipe.imageUrl ? (
                  <Image source={{ uri: recipe.imageUrl }} style={styles.folderRecipeImage} />
                ) : (
                  <View style={[styles.folderRecipeImage, styles.recipeImagePlaceholder]}>
                    <Text style={styles.placeholderTextSmall}>No Image</Text>
                  </View>
                )}
                <Text style={styles.folderRecipeTitle} numberOfLines={2}>
                  {recipe.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderMainContent = () => {
    if (!profile?.canView) {
      return (
        <View style={styles.privateProfileContainer}>
          <Text style={styles.privateProfileIcon}>🔒</Text>
          <Text style={styles.privateProfileTitle}>Private Profile</Text>
          <Text style={styles.privateProfileText}>
            This user's profile is private. Send a friend request to view their recipes.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Favorites Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Favorites</Text>
          {favorites.length === 0 ? (
            <Text style={styles.emptyText}>No favorite recipes</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.horizontalScrollContent}
            >
              {favorites.map(recipe => renderRecipeCard(recipe))}
            </ScrollView>
          )}
        </View>

        {/* Public Cookbooks Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Public Cookbooks</Text>
          {publicFolders.length === 0 ? (
            <Text style={styles.emptyText}>No public cookbooks</Text>
          ) : (
            <View style={styles.foldersGrid}>
              {publicFolders.map(folder => (
                <TouchableOpacity
                  key={folder.name}
                  style={styles.folderCard}
                  onPress={() => loadFolderRecipes(folder.name)}
                >
                  <Text style={styles.folderIcon}>📖</Text>
                  <Text style={styles.folderName} numberOfLines={1}>
                    {folder.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
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
          <View style={styles.headerRight} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : !profile ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Could not load profile</Text>
          </View>
        ) : (
          <>
            {/* Profile Info */}
            <View style={styles.profileInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
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
              <Text style={styles.friendCount}>{profile.friendCount} friends</Text>
            </View>

            {/* Main Content or Folder Content */}
            {selectedFolder ? renderFolderContent() : renderMainContent()}
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
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  headerRight: {
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
  profileInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  friendBadge: {
    backgroundColor: colors.success + '20',
  },
  badgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  friendCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
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
  },
  horizontalScroll: {
    paddingLeft: 16,
  },
  horizontalScrollContent: {
    paddingRight: 16,
  },
  recipeCard: {
    width: RECIPE_CARD_WIDTH,
    marginRight: 12,
  },
  recipeImage: {
    width: RECIPE_CARD_WIDTH,
    height: RECIPE_CARD_WIDTH,
    borderRadius: 12,
    backgroundColor: colors.border,
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
  recipeTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginTop: 8,
  },
  foldersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  folderCard: {
    width: (SCREEN_WIDTH - 48) / 2,
    margin: 4,
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  folderIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  folderName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
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
  folderContent: {
    flex: 1,
  },
  folderContentHeader: {
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
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  folderContentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  folderRecipesList: {
    flex: 1,
    padding: 16,
  },
  folderRecipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  folderRecipeImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  folderRecipeTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 12,
  },
});

export default UserProfile;

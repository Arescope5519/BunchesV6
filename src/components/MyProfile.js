/**
 * MyProfile Component
 * Edit your own profile: featured recipes, public settings, etc.
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
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../constants/colors';
import LetterPlaceholder from './LetterPlaceholder';
import { getUserProfile, updatePrivacySettings, getUserFollowers, getUserFollowing } from '../services/supabase/social';
import { supabase } from '../services/supabase/config';

import { isOwnInternalRecipeUrl } from '../constants/app';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MyProfile = ({
  visible,
  onClose,
  userId,
  recipes,
  profile: initialProfile,
  onProfileUpdated,
  // Embedded mode: rendered inside the Social hub's Account tab rather
  // than as its own modal - no Modal wrapper, no Close header
  embedded = false,
  onViewUser,
  onPreviewProfile,
  children,
}) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [currentView, setCurrentView] = useState('main'); // 'main', 'featured', 'my-recipes', 'followers', 'following'
  const [featuredRecipeIds, setFeaturedRecipeIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [followList, setFollowList] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);

  const isActive = embedded || visible;

  useEffect(() => {
    if (isActive && userId) {
      loadProfile();
    }
  }, [isActive, userId]);

  useEffect(() => {
    if (!isActive) {
      setCurrentView('main');
    }
  }, [isActive]);

  const openFollowList = async (type) => {
    setCurrentView(type);
    setFollowList([]);
    setFollowListLoading(true);
    try {
      const users = type === 'followers'
        ? await getUserFollowers(userId)
        : await getUserFollowing(userId);
      setFollowList(users || []);
    } catch (err) {
      console.error(`Error loading ${type}:`, err);
    } finally {
      setFollowListLoading(false);
    }
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const profileData = await getUserProfile(userId);
      setProfile(profileData);

      // Load featured recipe IDs from profile
      const { data } = await supabase
        .from('user_profiles')
        .select('featured_recipes')
        .eq('user_id', userId)
        .single();

      setFeaturedRecipeIds(data?.featured_recipes || []);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeaturedRecipe = (recipeId) => {
    setFeaturedRecipeIds(prev => {
      if (prev.includes(recipeId)) {
        return prev.filter(id => id !== recipeId);
      }
      if (prev.length >= 10) {
        Alert.alert('Limit Reached', 'You can feature up to 10 recipes');
        return prev;
      }
      return [...prev, recipeId];
    });
  };

  const saveFeaturedRecipes = async () => {
    setSaving(true);
    try {
      // If adding featured recipes, also make profile public
      const updateData = { featured_recipes: featuredRecipeIds };
      if (featuredRecipeIds.length > 0 && !profile?.isPublic) {
        updateData.is_public = true;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local profile state if we made it public
      if (updateData.is_public) {
        setProfile(prev => ({ ...prev, isPublic: true }));
        Alert.alert('Saved', 'Your featured recipes have been updated and your profile is now public');
      } else {
        Alert.alert('Saved', 'Your featured recipes have been updated');
      }
      onProfileUpdated?.();
      setCurrentView('main');
    } catch (error) {
      console.error('Error saving featured recipes:', error);
      Alert.alert('Error', 'Could not save featured recipes');
    } finally {
      setSaving(false);
    }
  };

  const togglePublicProfile = async () => {
    try {
      await updatePrivacySettings(userId, { isPublic: !profile?.isPublic });
      setProfile(prev => ({ ...prev, isPublic: !prev?.isPublic }));
      onProfileUpdated?.();
    } catch (error) {
      console.error('Error updating privacy:', error);
      Alert.alert('Error', 'Could not update setting');
    }
  };

  // Get user's custom recipes (not from external URLs)
  // Own creations only: no URL, or an internal URL that references THIS
  // user. A friend's shared recipe keeps the sender's internal URL, so
  // a plain isInternalUrl check would let you feature someone else's
  // recipe as your own.
  const customRecipes = recipes.filter(r => {
    if (r.deletedAt) return false;
    const url = r.url || r.sourceUrl || r.source_url;
    return !url || isOwnInternalRecipeUrl(url, userId);
  });

  const handleClose = () => {
    setCurrentView('main');
    onClose();
  };

  const renderFeaturedEditor = () => (
    <View style={styles.subView}>
      <View style={styles.subViewHeader}>
        <TouchableOpacity onPress={() => setCurrentView('main')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.subViewTitle}>Edit Featured</Text>
        <TouchableOpacity onPress={saveFeaturedRecipes} style={styles.saveButton} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? '...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helperText}>
        Select up to 10 recipes to feature on your profile ({featuredRecipeIds.length}/10)
      </Text>

      <ScrollView style={styles.recipeSelectList}>
        {customRecipes.length === 0 ? (
          <Text style={styles.emptyText}>
            No custom recipes yet. Create your own recipes to feature them!
          </Text>
        ) : (
          customRecipes.map(recipe => {
            const isSelected = featuredRecipeIds.includes(recipe.id);
            return (
              <TouchableOpacity
                key={recipe.id}
                style={[styles.recipeSelectItem, isSelected && styles.recipeSelectItemSelected]}
                onPress={() => toggleFeaturedRecipe(recipe.id)}
              >
                {recipe.image_url || recipe.imageUrl ? (
                  <Image
                    source={{ uri: recipe.image_url || recipe.imageUrl }}
                    style={styles.recipeSelectImage}
                  />
                ) : (
                  <LetterPlaceholder title={recipe.title} size={22} style={styles.recipeSelectImage} />
                )}
                <Text style={styles.recipeSelectTitle} numberOfLines={2}>
                  {recipe.title}
                </Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const renderMyRecipesView = () => (
    <View style={styles.subView}>
      <View style={styles.subViewHeader}>
        <TouchableOpacity onPress={() => setCurrentView('main')} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.subViewTitle}>My Recipes</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.recipeSelectList}>
        {customRecipes.length === 0 ? (
          <Text style={styles.emptyText}>
            No custom recipes yet. Create your own recipes to share them!
          </Text>
        ) : (
          customRecipes.map(recipe => (
            <View key={recipe.id} style={styles.recipeListItem}>
              {recipe.image_url || recipe.imageUrl ? (
                <Image
                  source={{ uri: recipe.image_url || recipe.imageUrl }}
                  style={styles.recipeSelectImage}
                />
              ) : (
                <LetterPlaceholder title={recipe.title} size={22} style={styles.recipeSelectImage} />
              )}
              <Text style={styles.recipeSelectTitle} numberOfLines={2}>
                {recipe.title}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderFollowListView = (type) => (
    <View style={styles.subView}>
      <View style={styles.subViewHeader}>
        <TouchableOpacity onPress={() => setCurrentView('main')} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.subViewTitle}>{type === 'followers' ? 'Followers' : 'Following'}</Text>
        <View style={{ width: 50 }} />
      </View>

      {followListLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <ScrollView style={styles.recipeSelectList}>
          {followList.length === 0 ? (
            <Text style={styles.emptyText}>
              {type === 'followers'
                ? 'No followers yet. Share your profile with friends!'
                : 'Not following anyone yet. Find people in the Feed.'}
            </Text>
          ) : (
            followList.map(u => {
              const isFriend = (profile?.friends || []).includes(u.id);
              return (
                <TouchableOpacity
                  key={u.id}
                  style={styles.followListItem}
                  onPress={() => onViewUser?.(u.id)}
                >
                  <View style={styles.followAvatar}>
                    <Text style={styles.followAvatarText}>
                      {u.username?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <Text style={styles.followUsername} numberOfLines={1}>@{u.username}</Text>
                  {isFriend && (
                    <View style={styles.friendChip}>
                      <Text style={styles.friendChipText}>Friend</Text>
                    </View>
                  )}
                  <Text style={styles.actionArrow}>{'>'}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );

  const renderMainView = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <TouchableOpacity style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <Text style={styles.editAvatarText}>Edit</Text>
        </TouchableOpacity>
        <View style={styles.profileHeaderInfo}>
          <Text style={styles.username}>@{profile?.username}</Text>
          <Text style={styles.userCode}>{profile?.userCode}</Text>
        </View>
      </View>

      {/* Stats Row - each opens its list */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statItem} onPress={() => openFollowList('following')}>
          <Text style={styles.statNumber}>{profile?.followingCount || 0}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={() => openFollowList('followers')}>
          <Text style={styles.statNumber}>{profile?.followerCount || 0}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={() => setCurrentView('my-recipes')}>
          <Text style={styles.statNumber}>{customRecipes.length}</Text>
          <Text style={styles.statLabel}>Recipes</Text>
        </TouchableOpacity>
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Settings</Text>

        <TouchableOpacity style={styles.settingItem} onPress={togglePublicProfile}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Public Profile</Text>
            <Text style={styles.settingSubtitle}>
              Anyone can view your public recipes
            </Text>
          </View>
          <View style={[styles.toggle, profile?.isPublic && styles.toggleActive]}>
            <View style={[styles.toggleCircle, profile?.isPublic && styles.toggleCircleActive]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Profile Content Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Public Profile</Text>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => setCurrentView('featured')}
        >
          <Ionicons name="star" size={20} color={colors.favorite} style={styles.actionIcon} />
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Featured Recipes</Text>
            <Text style={styles.actionSubtitle}>
              {featuredRecipeIds.length} recipes featured
            </Text>
          </View>
          <Text style={styles.actionArrow}>{'>'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => setCurrentView('my-recipes')}
        >
          <Ionicons name="create-outline" size={20} color={colors.primary} style={styles.actionIcon} />
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>My Recipes</Text>
            <Text style={styles.actionSubtitle}>
              {customRecipes.length} custom recipes
            </Text>
          </View>
          <Text style={styles.actionArrow}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Preview Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How Others See You</Text>
        <Text style={styles.previewText}>
          {profile?.isPublic
            ? 'Your profile is public. Anyone can see your public recipes and cookbooks. Recipes and folders you mark private stay hidden.'
            : 'Your profile is private. Only friends can see your public recipes - private ones stay hidden even from them.'}
        </Text>
        {onPreviewProfile && (
          <TouchableOpacity style={styles.actionItem} onPress={onPreviewProfile}>
            <Ionicons name="eye-outline" size={20} color={colors.primary} style={styles.actionIcon} />
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Preview Your Profile</Text>
              <Text style={styles.actionSubtitle}>
                See your profile exactly as others do
              </Text>
            </View>
            <Text style={styles.actionArrow}>{'>'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {children}
    </ScrollView>
  );

  const body = loading ? (
    <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
  ) : currentView === 'featured' ? (
    renderFeaturedEditor()
  ) : currentView === 'my-recipes' ? (
    renderMyRecipesView()
  ) : currentView === 'followers' || currentView === 'following' ? (
    renderFollowListView(currentView)
  ) : (
    renderMainView()
  );

  // Embedded in the Social hub's Account tab: no Modal, no Close header
  if (embedded) {
    return <View style={styles.container}>{body}</View>;
  }

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
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        {body}
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
  content: {
    flex: 1,
  },

  // Profile Header
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: colors.white,
  },
  avatarContainer: {
    alignItems: 'center',
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
  editAvatarText: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  profileHeaderInfo: {
    marginLeft: 16,
    flex: 1,
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  userCode: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Stats
  followListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  followAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  followUsername: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  friendChip: {
    backgroundColor: colors.accentLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  friendChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentDark,
  },
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

  // Sections
  section: {
    marginTop: 20,
    backgroundColor: colors.white,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Settings
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },

  // Action Items
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 18,
    color: colors.textSecondary,
  },

  // Preview
  previewText: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 16,
    lineHeight: 20,
  },

  // Sub View
  subView: {
    flex: 1,
  },
  subViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  saveButton: {
    padding: 4,
  },
  saveButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  subViewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Recipe Select List
  recipeSelectList: {
    flex: 1,
    padding: 12,
  },
  recipeSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  recipeSelectItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  recipeSelectImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 8,
    color: colors.textSecondary,
  },
  recipeSelectTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginHorizontal: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  recipeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
});

export default MyProfile;

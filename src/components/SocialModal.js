/**
 * Social Modal
 * Friends list, friend requests, shared items inbox, add friends
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import colors from '../constants/colors';

export const SocialModal = ({
  visible,
  onClose,
  friends,
  friendRequests,
  sharedItems,
  onSearchUsers,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemoveFriend,
  onImportSharedItem,
  onDeclineSharedItem,
  onImportRecipe,
  onFollowCookbook,
  profile,
  onChangeUsername,
  checkUsernameAvailable,
}) => {
  const [activeTab, setActiveTab] = useState('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null); // For threaded inbox
  const [previewRecipe, setPreviewRecipe] = useState(null); // For recipe preview

  // Group shared items by sender for threaded view
  const threadedInbox = React.useMemo(() => {
    const threads = {};
    sharedItems.forEach(item => {
      const key = item.from || item.fromUsername;
      if (!threads[key]) {
        threads[key] = {
          fromUserId: item.from,
          fromUsername: item.fromUsername,
          items: [],
          latestAt: item.createdAt,
        };
      }
      threads[key].items.push(item);
      if (item.createdAt > threads[key].latestAt) {
        threads[key].latestAt = item.createdAt;
      }
    });
    // Sort threads by latest activity
    return Object.values(threads).sort((a, b) => b.latestAt - a.latestAt);
  }, [sharedItems]);

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return;

    setSearching(true);
    try {
      const results = await onSearchUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (userId) => {
    const success = await onSendFriendRequest(userId);
    if (success) {
      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    }
  };

  const handleImport = async (item) => {
    // Import the recipe(s) to local storage
    if (item.type === 'recipe') {
      const recipe = {
        ...item.data,
        id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        importedFrom: item.fromUsername,
        importedAt: Date.now(),
      };
      await onImportRecipe(recipe);
    } else if (item.type === 'cookbook') {
      // Import all recipes in cookbook
      for (const recipeData of item.data) {
        const recipe = {
          ...recipeData,
          id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          importedFrom: item.fromUsername,
          importedAt: Date.now(),
        };
        await onImportRecipe(recipe);
      }
    }

    // Mark as imported
    await onImportSharedItem(item.id);
    Alert.alert('Imported!', `${item.type === 'recipe' ? 'Recipe' : 'Cookbook'} has been added to your recipes`);
  };

  const renderFriendsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Add Friends Button */}
      <TouchableOpacity
        style={styles.addFriendsButton}
        onPress={() => {
          setShowAddFriends(!showAddFriends);
          if (!showAddFriends) {
            setSearchQuery('');
            setSearchResults([]);
          }
        }}
      >
        <Text style={styles.addFriendsButtonText}>
          {showAddFriends ? '✕ Close Search' : '+ Add Friends'}
        </Text>
      </TouchableOpacity>

      {/* Add Friends Search UI */}
      {showAddFriends && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username or code"
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={handleSearch}
              style={styles.searchButton}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              <Text style={styles.searchResultsTitle}>Results</Text>
              {searchResults.map(user => (
                <View key={user.id} style={styles.listItem}>
                  <View style={styles.userInfo}>
                    <Text style={styles.usernameText}>@{user.username}</Text>
                    {user.userCode && (
                      <Text style={styles.userCodeText}>{user.userCode}</Text>
                    )}
                  </View>
                  {user.isFriend ? (
                    <Text style={styles.alreadyFriendsText}>✓ Friends</Text>
                  ) : user.requestSent ? (
                    <Text style={styles.requestSentText}>Pending</Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleSendRequest(user.id)}
                      style={styles.addButton}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {searchQuery.length > 0 && searchResults.length === 0 && !searching && (
            <Text style={styles.noResultsText}>No users found</Text>
          )}
        </View>
      )}

      {/* Friends List */}
      {friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No friends yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Click "Add Friends" above to get started
          </Text>
        </View>
      ) : (
        <View style={styles.friendsList}>
          <Text style={styles.friendsListTitle}>Your Friends ({friends.length})</Text>
          {friends.map(friend => (
            <View key={friend.id} style={styles.listItem}>
              <View style={styles.userInfo}>
                <Text style={styles.usernameText}>@{friend.username}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Remove Friend',
                    `Remove @${friend.username} from friends?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => onRemoveFriend(friend.id),
                      },
                    ]
                  );
                }}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderRequestsTab = () => (
    <ScrollView style={styles.tabContent}>
      {friendRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No pending requests</Text>
        </View>
      ) : (
        friendRequests.map(request => (
          <View key={request.id} style={styles.listItem}>
            <View style={styles.userInfo}>
              <Text style={styles.usernameText}>@{request.senderUsername}</Text>
            </View>
            <View style={styles.requestActions}>
              <TouchableOpacity
                onPress={() => onAcceptFriendRequest(request.id)}
                style={styles.acceptButton}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDeclineFriendRequest(request.id)}
                style={styles.declineButton}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  // Format time ago for thread list
  const formatTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Render cookbook preview (folder view with scrollable recipes)
  const renderCookbookPreview = () => {
    if (!previewRecipe || previewRecipe.type !== 'cookbook') return null;
    const recipes = previewRecipe.data || [];

    return (
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => setPreviewRecipe(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Cookbook</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={styles.previewContent}>
          {/* Cookbook header */}
          <View style={styles.cookbookHeader}>
            <Text style={styles.cookbookIcon}>📁</Text>
            <Text style={styles.cookbookName}>{previewRecipe.name}</Text>
            <Text style={styles.previewFrom}>Shared by @{previewRecipe.fromUsername}</Text>
            <Text style={styles.cookbookCount}>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</Text>
          </View>

          {/* Recipe list */}
          <Text style={styles.cookbookListTitle}>Recipes in this cookbook:</Text>
          {recipes.map((recipe, index) => (
            <View key={index} style={styles.cookbookRecipeItem}>
              <Text style={styles.cookbookRecipeNumber}>{index + 1}</Text>
              <View style={styles.cookbookRecipeInfo}>
                <Text style={styles.cookbookRecipeTitle}>{recipe.title || 'Untitled Recipe'}</Text>
                {(recipe.prep_time || recipe.cook_time) && (
                  <Text style={styles.cookbookRecipeMeta}>
                    {recipe.prep_time && `Prep: ${recipe.prep_time}`}
                    {recipe.prep_time && recipe.cook_time && ' • '}
                    {recipe.cook_time && `Cook: ${recipe.cook_time}`}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Cookbook Import Options */}
        <View style={styles.cookbookOptionsContainer}>
          <Text style={styles.cookbookOptionsTitle}>How would you like to add this cookbook?</Text>

          <TouchableOpacity
            onPress={() => {
              if (onFollowCookbook) {
                onFollowCookbook({
                  id: previewRecipe.id,
                  name: previewRecipe.name,
                  ownerId: previewRecipe.from,
                  ownerUsername: previewRecipe.fromUsername,
                  recipeCount: recipes.length,
                  followedAt: Date.now(),
                });
                onImportSharedItem(previewRecipe.id);
                setPreviewRecipe(null);
                setSelectedThread(null);
                Alert.alert('Following!', `You're now following "${previewRecipe.name}". You'll see updates when recipes are added or changed.`);
              }
            }}
            style={styles.followCookbookButton}
          >
            <Text style={styles.followCookbookIcon}>👁️</Text>
            <View style={styles.followCookbookTextContainer}>
              <Text style={styles.followCookbookTitle}>Follow Cookbook</Text>
              <Text style={styles.followCookbookDescription}>
                See live updates when recipes are added or changed
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              handleImport(previewRecipe);
              setPreviewRecipe(null);
              setSelectedThread(null);
            }}
            style={styles.copyCookbookButton}
          >
            <Text style={styles.copyCookbookIcon}>📋</Text>
            <View style={styles.copyCookbookTextContainer}>
              <Text style={styles.copyCookbookTitle}>Make a Copy</Text>
              <Text style={styles.copyCookbookDescription}>
                Copy all {recipes.length} recipes to edit as your own
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.previewActions}>
          <TouchableOpacity
            onPress={() => {
              onDeclineSharedItem(previewRecipe.id);
              setPreviewRecipe(null);
            }}
            style={styles.declineButton}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render recipe preview
  const renderRecipePreview = () => {
    if (!previewRecipe) return null;

    // Handle cookbook separately
    if (previewRecipe.type === 'cookbook') {
      return renderCookbookPreview();
    }

    const recipe = previewRecipe.data;

    return (
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => setPreviewRecipe(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Recipe Preview</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={styles.previewContent}>
          {recipe ? (
            <>
              <Text style={styles.previewRecipeTitle}>{recipe.title || previewRecipe.name}</Text>
              <Text style={styles.previewFrom}>Shared by @{previewRecipe.fromUsername}</Text>

              {recipe.image_url && (
                <View style={styles.previewImagePlaceholder}>
                  <Text style={styles.previewImageText}>📷 Image</Text>
                </View>
              )}

              {/* Recipe meta info */}
              <View style={styles.previewMeta}>
                {recipe.prep_time && (
                  <Text style={styles.previewMetaItem}>Prep: {recipe.prep_time}</Text>
                )}
                {recipe.cook_time && (
                  <Text style={styles.previewMetaItem}>Cook: {recipe.cook_time}</Text>
                )}
                {recipe.servings && (
                  <Text style={styles.previewMetaItem}>Servings: {recipe.servings}</Text>
                )}
              </View>

              {/* Ingredients */}
              <Text style={styles.previewSectionTitle}>Ingredients</Text>
              {recipe.ingredients && typeof recipe.ingredients === 'object' ? (
                Object.entries(recipe.ingredients).map(([section, items]) => (
                  <View key={section}>
                    {section !== 'main' && (
                      <Text style={styles.previewSubsectionTitle}>{section}</Text>
                    )}
                    {Array.isArray(items) && items.map((item, idx) => (
                      <Text key={idx} style={styles.previewIngredient}>• {item}</Text>
                    ))}
                  </View>
                ))
              ) : (
                <Text style={styles.previewIngredient}>{String(recipe.ingredients || 'No ingredients')}</Text>
              )}

              {/* Instructions */}
              <Text style={styles.previewSectionTitle}>Instructions</Text>
              {Array.isArray(recipe.instructions) ? (
                recipe.instructions.map((step, idx) => (
                  <Text key={idx} style={styles.previewInstruction}>
                    {idx + 1}. {step}
                  </Text>
                ))
              ) : (
                <Text style={styles.previewInstruction}>{String(recipe.instructions || 'No instructions')}</Text>
              )}

              {recipe.notes && (
                <>
                  <Text style={styles.previewSectionTitle}>Notes</Text>
                  <Text style={styles.previewNotes}>{recipe.notes}</Text>
                </>
              )}
            </>
          ) : (
            <Text style={styles.previewError}>Unable to preview this recipe</Text>
          )}
        </ScrollView>

        <View style={styles.previewActions}>
          <TouchableOpacity
            onPress={() => {
              handleImport(previewRecipe);
              setPreviewRecipe(null);
              setSelectedThread(null);
            }}
            style={styles.importButton}
          >
            <Text style={styles.importButtonText}>Import Recipe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              onDeclineSharedItem(previewRecipe.id);
              setPreviewRecipe(null);
            }}
            style={styles.declineButton}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render thread detail view
  const renderThreadDetail = () => {
    if (!selectedThread) return null;

    return (
      <View style={styles.threadDetailContainer}>
        <View style={styles.threadDetailHeader}>
          <TouchableOpacity onPress={() => setSelectedThread(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.threadDetailHeaderCenter}>
            <Text style={styles.threadDetailTitle}>@{selectedThread.fromUsername}</Text>
            <Text style={styles.threadDetailSubtitle}>
              {selectedThread.items.length} recipe{selectedThread.items.length !== 1 ? 's' : ''} shared
            </Text>
          </View>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={styles.threadDetailContent}>
          {selectedThread.items.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.threadRecipeCard}
              onPress={() => setPreviewRecipe(item)}
            >
              <View style={styles.threadRecipeInfo}>
                <Text style={styles.threadRecipeType}>
                  {item.type === 'recipe' ? '📄' : '📚'} {item.type === 'recipe' ? 'Recipe' : 'Cookbook'}
                </Text>
                <Text style={styles.threadRecipeName}>{item.name}</Text>
                {item.type === 'cookbook' && (
                  <Text style={styles.threadRecipeCount}>
                    {item.data?.length || 0} recipes
                  </Text>
                )}
                <Text style={styles.threadRecipeTime}>{formatTimeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.threadRecipeArrow}>›</Text>
            </TouchableOpacity>
          ))}

          {/* Import All / Decline All buttons */}
          <View style={styles.threadBulkActions}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Import All',
                  `Import all ${selectedThread.items.length} recipe${selectedThread.items.length !== 1 ? 's' : ''} from @${selectedThread.fromUsername}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Import All',
                      onPress: async () => {
                        for (const item of selectedThread.items) {
                          await handleImport(item);
                        }
                        setSelectedThread(null);
                      },
                    },
                  ]
                );
              }}
              style={styles.bulkImportButton}
            >
              <Text style={styles.bulkImportButtonText}>Import All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Decline All',
                  `Decline all recipes from @${selectedThread.fromUsername}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Decline All',
                      style: 'destructive',
                      onPress: async () => {
                        for (const item of selectedThread.items) {
                          await onDeclineSharedItem(item.id);
                        }
                        setSelectedThread(null);
                      },
                    },
                  ]
                );
              }}
              style={styles.bulkDeclineButton}
            >
              <Text style={styles.bulkDeclineButtonText}>Decline All</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  // Render thread list (main inbox view)
  const renderThreadList = () => (
    <ScrollView style={styles.tabContent}>
      {threadedInbox.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No shared items</Text>
          <Text style={styles.emptyStateSubtext}>
            When friends share recipes with you, they'll appear here
          </Text>
        </View>
      ) : (
        threadedInbox.map(thread => (
          <TouchableOpacity
            key={thread.fromUserId}
            style={styles.threadItem}
            onPress={() => setSelectedThread(thread)}
          >
            <View style={styles.threadAvatar}>
              <Text style={styles.threadAvatarText}>
                {thread.fromUsername?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.threadInfo}>
              <View style={styles.threadTopRow}>
                <Text style={styles.threadUsername}>@{thread.fromUsername}</Text>
                <Text style={styles.threadTime}>{formatTimeAgo(thread.latestAt)}</Text>
              </View>
              <Text style={styles.threadPreview}>
                {thread.items.length} recipe{thread.items.length !== 1 ? 's' : ''} shared
              </Text>
            </View>
            <View style={styles.threadBadge}>
              <Text style={styles.threadBadgeText}>{thread.items.length}</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  const renderInboxTab = () => {
    // Show recipe preview if one is selected
    if (previewRecipe) {
      return renderRecipePreview();
    }
    // Show thread detail if a thread is selected
    if (selectedThread) {
      return renderThreadDetail();
    }
    // Show thread list
    return renderThreadList();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Social</Text>
        {profile && (
          <Text style={styles.myUsername}>@{profile.username}</Text>
        )}
      </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
            onPress={() => setActiveTab('friends')}
          >
            <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
              Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
              Requests {friendRequests.length > 0 && `(${friendRequests.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'inbox' && styles.activeTab]}
            onPress={() => setActiveTab('inbox')}
          >
            <Text style={[styles.tabText, activeTab === 'inbox' && styles.activeTabText]}>
              Inbox {sharedItems.length > 0 && `(${sharedItems.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'friends' && renderFriendsTab()}
        {activeTab === 'requests' && renderRequestsTab()}
        {activeTab === 'inbox' && renderInboxTab()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  myUsername: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  username: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  declineButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: colors.error || '#f44336',
    fontSize: 13,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  friendBadge: {
    fontSize: 12,
    color: colors.success || '#4CAF50',
    fontWeight: '500',
  },
  notAccepting: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sharedItem: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  sharedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sharedItemType: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sharedItemFrom: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sharedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  sharedItemCount: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  sharedItemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  importButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchResults: {
    flex: 1,
  },
  // Profile tab styles
  profileSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  profileItem: {
    marginBottom: 20,
  },
  profileLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  profileValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  profileHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  displayNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  editNameContainer: {
    gap: 12,
  },
  editNameInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editNameActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saveNameButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  saveNameButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelNameButton: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelNameButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  // Username display style
  usernameText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  // Username edit styles
  usernameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  atSymbol: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: 4,
  },
  usernameEditInput: {
    flex: 1,
    padding: 12,
    paddingLeft: 0,
    fontSize: 16,
    color: colors.text,
  },
  availableIcon: {
    fontSize: 18,
    color: colors.success || '#4CAF50',
    marginLeft: 8,
  },
  unavailableIcon: {
    fontSize: 18,
    color: colors.error || '#f44336',
    marginLeft: 8,
  },
  usernameHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  availableText: {
    fontSize: 12,
    color: colors.success || '#4CAF50',
    marginTop: 4,
  },
  unavailableText: {
    fontSize: 12,
    color: colors.error || '#f44336',
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.6,
  },
  addFriendsButton: {
    backgroundColor: colors.primary,
    padding: 14,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addFriendsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResults: {
    marginTop: 16,
  },
  searchResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  userCodeText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  alreadyFriendsText: {
    fontSize: 14,
    color: colors.success || '#4CAF50',
    fontWeight: '500',
  },
  requestSentText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  friendsList: {
    marginTop: 16,
  },
  friendsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
  },
  noResultsText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 16,
    fontStyle: 'italic',
  },
  // Thread list styles
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  threadAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  threadAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  threadInfo: {
    flex: 1,
  },
  threadTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  threadUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  threadTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  threadPreview: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  threadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  threadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Thread detail styles
  threadDetailContainer: {
    flex: 1,
  },
  threadDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  threadDetailHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  threadDetailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  threadDetailSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  threadDetailContent: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  threadRecipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  threadRecipeInfo: {
    flex: 1,
  },
  threadRecipeType: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  threadRecipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  threadRecipeCount: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  threadRecipeTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  threadRecipeArrow: {
    fontSize: 24,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  threadBulkActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bulkImportButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  bulkImportButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  bulkDeclineButton: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkDeclineButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  // Recipe preview styles
  previewContainer: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  previewContent: {
    flex: 1,
    padding: 16,
  },
  previewRecipeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  previewFrom: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  previewImagePlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewImageText: {
    fontSize: 32,
  },
  previewMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  previewMetaItem: {
    fontSize: 13,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  previewSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  previewSubsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 8,
  },
  previewIngredient: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 6,
    paddingLeft: 8,
  },
  previewInstruction: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  previewNotes: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  previewError: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  // Cookbook preview styles
  cookbookHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 16,
  },
  cookbookIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  cookbookName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  cookbookCount: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 8,
  },
  cookbookListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  cookbookRecipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  cookbookRecipeNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
    marginRight: 12,
    overflow: 'hidden',
  },
  cookbookRecipeInfo: {
    flex: 1,
  },
  cookbookRecipeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  cookbookRecipeMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cookbookOptionsContainer: {
    backgroundColor: colors.background,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cookbookOptionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  followCookbookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  followCookbookIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  followCookbookTextContainer: {
    flex: 1,
  },
  followCookbookTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  followCookbookDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  copyCookbookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyCookbookIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  copyCookbookTextContainer: {
    flex: 1,
  },
  copyCookbookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  copyCookbookDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default SocialModal;

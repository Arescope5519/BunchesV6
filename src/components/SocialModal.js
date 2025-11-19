/**
 * Social Modal
 * Friends list, friend requests, shared items inbox, add friends
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
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
  profile,
  onUpdateDisplayName,
}) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

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
      {friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No friends yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Search for users to add friends
          </Text>
        </View>
      ) : (
        friends.map(friend => (
          <View key={friend.id} style={styles.listItem}>
            <View style={styles.userInfo}>
              <Text style={styles.displayName}>{friend.displayName}</Text>
              <Text style={styles.username}>@{friend.username}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Remove Friend',
                  `Remove ${friend.displayName} from friends?`,
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
        ))
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
              <Text style={styles.displayName}>{request.senderDisplayName}</Text>
              <Text style={styles.username}>@{request.senderUsername}</Text>
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

  const renderInboxTab = () => (
    <ScrollView style={styles.tabContent}>
      {sharedItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No shared items</Text>
          <Text style={styles.emptyStateSubtext}>
            When friends share recipes with you, they'll appear here
          </Text>
        </View>
      ) : (
        sharedItems.map(item => (
          <View key={item.id} style={styles.sharedItem}>
            <View style={styles.sharedItemHeader}>
              <Text style={styles.sharedItemType}>
                {item.type === 'recipe' ? 'Recipe' : 'Cookbook'}
              </Text>
              <Text style={styles.sharedItemFrom}>
                from @{item.fromUsername}
              </Text>
            </View>
            <Text style={styles.sharedItemName}>{item.name}</Text>
            {item.type === 'cookbook' && (
              <Text style={styles.sharedItemCount}>
                {item.data.length} recipes
              </Text>
            )}
            <View style={styles.sharedItemActions}>
              <TouchableOpacity
                onPress={() => handleImport(item)}
                style={styles.importButton}
              >
                <Text style={styles.importButtonText}>Import</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDeclineSharedItem(item.id)}
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

  const renderAddTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by username..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          onPress={handleSearch}
          style={styles.searchButton}
          disabled={searching || searchQuery.length < 2}
        >
          {searching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.searchResults}>
        {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No users found</Text>
          </View>
        )}
        {searchResults.map(user => {
          const isFriend = friends.some(f => f.id === user.id);
          return (
            <View key={user.id} style={styles.listItem}>
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{user.displayName}</Text>
                <Text style={styles.username}>@{user.username}</Text>
              </View>
              {isFriend ? (
                <Text style={styles.friendBadge}>Friend</Text>
              ) : user.acceptingFriendRequests ? (
                <TouchableOpacity
                  onPress={() => handleSendRequest(user.id)}
                  style={styles.addButton}
                >
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.notAccepting}>Not accepting</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim() || newDisplayName.trim() === profile?.displayName) {
      setEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      await onUpdateDisplayName(newDisplayName.trim());
      setEditingName(false);
    } catch (error) {
      console.error('Failed to update display name:', error);
    } finally {
      setSavingName(false);
    }
  };

  const renderProfileTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>Your Profile</Text>

        <View style={styles.profileItem}>
          <Text style={styles.profileLabel}>Username</Text>
          <Text style={styles.profileValue}>@{profile?.username || 'Not set'}</Text>
          <Text style={styles.profileHint}>Username cannot be changed</Text>
        </View>

        <View style={styles.profileItem}>
          <Text style={styles.profileLabel}>Display Name</Text>
          {editingName ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={styles.editNameInput}
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                placeholder="Enter display name"
                placeholderTextColor={colors.textSecondary}
                maxLength={30}
                autoFocus
              />
              <View style={styles.editNameActions}>
                <TouchableOpacity
                  onPress={handleSaveDisplayName}
                  style={styles.saveNameButton}
                  disabled={savingName}
                >
                  {savingName ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveNameButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditingName(false)}
                  style={styles.cancelNameButton}
                >
                  <Text style={styles.cancelNameButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.displayNameRow}>
              <Text style={styles.profileValue}>{profile?.displayName || profile?.username || 'Not set'}</Text>
              <TouchableOpacity
                onPress={() => {
                  setNewDisplayName(profile?.displayName || '');
                  setEditingName(true);
                }}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={styles.profileHint}>This is what friends see</Text>
        </View>

        <View style={styles.profileItem}>
          <Text style={styles.profileLabel}>Friends</Text>
          <Text style={styles.profileValue}>{friends.length}</Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar style="light" hidden={true} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Social</Text>
          {profile && (
            <Text style={styles.myUsername}>@{profile.username}</Text>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>
              Profile
            </Text>
          </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.tab, activeTab === 'add' && styles.activeTab]}
            onPress={() => setActiveTab('add')}
          >
            <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>
              Add
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'friends' && renderFriendsTab()}
        {activeTab === 'requests' && renderRequestsTab()}
        {activeTab === 'inbox' && renderInboxTab()}
        {activeTab === 'add' && renderAddTab()}
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
    padding: 16,
    paddingTop: 50,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  myUsername: {
    fontSize: 12,
    color: colors.textSecondary,
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
});

export default SocialModal;

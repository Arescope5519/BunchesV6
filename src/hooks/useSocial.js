/**
 * useSocial Hook
 * Manages social features: profile, friends, sharing, notifications
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { isFirestoreAvailable } from '../services/firebase/availability';

// Conditionally import social functions
let socialModule = null;
if (isFirestoreAvailable()) {
  try {
    socialModule = require('../services/firebase/social');
  } catch (e) {
    console.error('Failed to load social module:', e);
  }
}

export const useSocial = (user) => {
  const [profile, setProfile] = useState(null);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [sharedItems, setSharedItems] = useState([]);
  const [notificationCounts, setNotificationCounts] = useState({
    friendRequests: 0,
    sharedItems: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  /**
   * Load user profile and check if username setup is needed
   */
  const loadProfile = useCallback(async () => {
    if (!user || !socialModule) {
      setProfile(null);
      setNeedsUsername(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userProfile = await socialModule.getUserProfile(user.uid);

      if (!userProfile || !userProfile.username) {
        // User needs to set up username
        setNeedsUsername(true);
        setProfile(null);
      } else {
        setProfile(userProfile);
        setNeedsUsername(false);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Set up username for new user
   */
  const setupUsername = async (username) => {
    if (!user || !socialModule) return false;

    try {
      await socialModule.setupUserProfile(user.uid, username);
      await loadProfile();
      return true;
    } catch (error) {
      console.error('Error setting up username:', error);
      Alert.alert('Error', error.message || 'Failed to set up username');
      return false;
    }
  };

  /**
   * Change username
   */
  const changeUsername = async (newUsername) => {
    if (!user || !socialModule || !profile) return false;

    try {
      await socialModule.changeUsername(user.uid, profile.username, newUsername);
      await loadProfile();
      Alert.alert('Success', 'Username updated');
      return true;
    } catch (error) {
      console.error('Error changing username:', error);
      Alert.alert('Error', error.message || 'Failed to change username');
      return false;
    }
  };

  /**
   * Check if username is available
   * Returns: true (available), false (taken), or null (error/couldn't check)
   */
  const checkUsernameAvailable = async (username) => {
    if (!socialModule) {
      console.error('Social module not available');
      return null; // Return null to indicate we couldn't check
    }
    try {
      return await socialModule.isUsernameAvailable(username);
    } catch (error) {
      console.error('Error checking username:', error);
      return null; // Return null to indicate we couldn't check
    }
  };

  /**
   * Load friends list
   */
  const loadFriends = useCallback(async () => {
    if (!user || !socialModule) {
      setFriends([]);
      return;
    }

    try {
      const friendsList = await socialModule.getFriendsList(user.uid);
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  }, [user]);

  /**
   * Load friend requests
   */
  const loadFriendRequests = useCallback(async () => {
    if (!user || !socialModule) {
      setFriendRequests([]);
      return;
    }

    try {
      const requests = await socialModule.getPendingFriendRequests(user.uid);
      setFriendRequests(requests);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  }, [user]);

  /**
   * Load shared items
   */
  const loadSharedItems = useCallback(async () => {
    if (!user || !socialModule) {
      setSharedItems([]);
      return;
    }

    try {
      const items = await socialModule.getReceivedSharedItems(user.uid);
      setSharedItems(items);
    } catch (error) {
      console.error('Error loading shared items:', error);
    }
  }, [user]);

  /**
   * Load notification counts
   */
  const loadNotificationCounts = useCallback(async () => {
    if (!user || !socialModule) {
      setNotificationCounts({ friendRequests: 0, sharedItems: 0, total: 0 });
      return;
    }

    try {
      const counts = await socialModule.getNotificationCounts(user.uid);
      setNotificationCounts(counts);
    } catch (error) {
      console.error('Error loading notification counts:', error);
    }
  }, [user]);

  /**
   * Refresh all social data
   */
  const refreshSocialData = useCallback(async () => {
    await Promise.all([
      loadFriends(),
      loadFriendRequests(),
      loadSharedItems(),
      loadNotificationCounts(),
    ]);
  }, [loadFriends, loadFriendRequests, loadSharedItems, loadNotificationCounts]);

  /**
   * Search for users by username
   */
  const searchUsers = async (searchTerm) => {
    if (!user || !socialModule) return [];
    try {
      return await socialModule.searchUsersByUsername(searchTerm, user.uid);
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  /**
   * Send friend request
   */
  const sendFriendRequest = async (toUserId) => {
    if (!user || !socialModule) return false;

    try {
      await socialModule.sendFriendRequest(user.uid, toUserId);
      Alert.alert('Success', 'Friend request sent!');
      return true;
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', error.message || 'Failed to send friend request');
      return false;
    }
  };

  /**
   * Accept friend request
   */
  const acceptFriendRequest = async (requestId) => {
    if (!user || !socialModule) return false;

    try {
      await socialModule.acceptFriendRequest(requestId, user.uid);
      await refreshSocialData();
      Alert.alert('Success', 'Friend request accepted!');
      return true;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', error.message || 'Failed to accept friend request');
      return false;
    }
  };

  /**
   * Decline friend request
   */
  const declineFriendRequest = async (requestId) => {
    if (!user || !socialModule) return false;

    try {
      await socialModule.declineFriendRequest(requestId, user.uid);
      await refreshSocialData();
      return true;
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', error.message || 'Failed to decline friend request');
      return false;
    }
  };

  /**
   * Remove friend
   */
  const removeFriend = async (friendId) => {
    if (!user || !socialModule) return false;

    try {
      await socialModule.removeFriend(user.uid, friendId);
      await loadFriends();
      Alert.alert('Success', 'Friend removed');
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', error.message || 'Failed to remove friend');
      return false;
    }
  };

  /**
   * Share recipe or cookbook with friends
   */
  const shareWithFriends = async (friendIds, type, data, name) => {
    if (!user || !socialModule) return false;

    try {
      await socialModule.shareWithFriends(user.uid, friendIds, type, data, name);
      Alert.alert('Success', `${type === 'recipe' ? 'Recipe' : 'Cookbook'} shared with ${friendIds.length} friend(s)!`);
      return true;
    } catch (error) {
      console.error('Error sharing with friends:', error);
      Alert.alert('Error', error.message || 'Failed to share');
      return false;
    }
  };

  /**
   * Import a shared item
   */
  const importSharedItem = async (itemId) => {
    if (!socialModule) return false;

    try {
      await socialModule.markSharedItemImported(itemId);
      await refreshSocialData();
      return true;
    } catch (error) {
      console.error('Error importing shared item:', error);
      return false;
    }
  };

  /**
   * Decline a shared item
   */
  const declineSharedItem = async (itemId) => {
    if (!socialModule) return false;

    try {
      await socialModule.declineSharedItem(itemId);
      await refreshSocialData();
      return true;
    } catch (error) {
      console.error('Error declining shared item:', error);
      return false;
    }
  };

  /**
   * Update privacy settings
   */
  const updatePrivacySettings = async (settings) => {
    if (!user || !socialModule) return false;

    try {
      await socialModule.updatePrivacySettings(user.uid, settings);
      await loadProfile();
      Alert.alert('Success', 'Privacy settings updated');
      return true;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      Alert.alert('Error', error.message || 'Failed to update settings');
      return false;
    }
  };


  // Load profile when user changes
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Load social data when profile is loaded
  useEffect(() => {
    if (profile) {
      refreshSocialData();
    }
  }, [profile, refreshSocialData]);

  // Poll for notifications every 30 seconds when user is logged in
  useEffect(() => {
    if (!user || !profile) return;

    const interval = setInterval(() => {
      loadNotificationCounts();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, profile, loadNotificationCounts]);

  return {
    // State
    profile,
    needsUsername,
    friends,
    friendRequests,
    sharedItems,
    notificationCounts,
    loading,

    // Actions
    setupUsername,
    changeUsername,
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
    refreshSocialData,
  };
};

export default useSocial;

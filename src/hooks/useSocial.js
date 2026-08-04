/**
 * useSocial Hook
 * Manages social features: profile, friends, sharing, notifications
 * Using Supabase
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as socialModule from '../services/supabase/social';
import { supabase } from '../services/supabase/config';

import { log } from '../utils/log';
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
    if (!user) {
      setProfile(null);
      setNeedsUsername(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userProfile = await socialModule.getUserProfile(user.uid);

      if (!userProfile || !userProfile.username) {
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
    if (!user) return false;

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
   * Check if username is available
   */
  const checkUsernameAvailable = async (username) => {
    try {
      return await socialModule.isUsernameAvailable(username);
    } catch (error) {
      console.error('Error checking username:', error);
      return null;
    }
  };

  /**
   * Load friends list
   */
  const loadFriends = useCallback(async () => {
    if (!user) {
      setFriends([]);
      return;
    }

    try {
      // First, sync any accepted friend requests (for senders who haven't synced yet)
      await socialModule.syncAcceptedFriendRequests(user.uid);

      // Now load friends from profile
      const userProfile = await socialModule.getUserProfile(user.uid);
      if (userProfile?.friends) {
        // Load friend profiles
        const friendProfiles = [];
        for (const friendId of userProfile.friends) {
          const friendProfile = await socialModule.getUserProfile(friendId);
          if (friendProfile) {
            friendProfiles.push({
              id: friendId,
              username: friendProfile.username,
              userCode: friendProfile.userCode,
            });
          }
        }
        setFriends(friendProfiles);
      } else {
        setFriends([]);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  }, [user]);

  /**
   * Load friend requests
   */
  const loadFriendRequests = useCallback(async () => {
    if (!user) {
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
    if (!user) {
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
    if (!user) {
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
    if (!user) return [];
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
    if (!user) return false;

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
    if (!user) return false;

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
   * Share recipe or cookbook with friends
   */
  const shareWithFriends = async (friendIds, type, data, name) => {
    if (!user) return false;

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
   * Decline friend request
   */
  const declineFriendRequest = async (requestId) => {
    if (!user) return false;

    try {
      await socialModule.declineFriendRequest(requestId);
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
    if (!user) return false;

    try {
      await socialModule.removeFriend(user.uid, friendId);
      await refreshSocialData();
      Alert.alert('Success', 'Friend removed');
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', error.message || 'Failed to remove friend');
      return false;
    }
  };

  /**
   * Update privacy settings
   */
  const updatePrivacySettings = async (settings) => {
    if (!user || !profile) return false;

    // Optimistic update - immediately update UI
    const previousProfile = { ...profile };
    setProfile({
      ...profile,
      ...(settings.isPrivate !== undefined && { isPrivate: settings.isPrivate }),
      ...(settings.isPublic !== undefined && { isPublic: settings.isPublic }),
      ...(settings.acceptingFriendRequests !== undefined && { acceptingFriendRequests: settings.acceptingFriendRequests }),
    });

    try {
      await socialModule.updatePrivacySettings(user.uid, settings);
      return true;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      // Revert on error
      setProfile(previousProfile);
      Alert.alert('Error', error.message || 'Failed to update privacy settings');
      return false;
    }
  };

  /**
   * Change username
   */
  const changeUsername = async (newUsername) => {
    if (!user) return false;

    try {
      await socialModule.changeUsername(user.uid, newUsername);
      await loadProfile();
      Alert.alert('Success', 'Username updated!');
      return true;
    } catch (error) {
      console.error('Error changing username:', error);
      Alert.alert('Error', error.message || 'Failed to change username');
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

  // Real-time subscriptions for friend requests, shared items, and profile changes
  useEffect(() => {
    if (!user || !profile) return;

    // Subscribe to friend_requests table changes (INSERT and UPDATE)
    // Using broader subscription without filters for better reliability
    const friendRequestsChannel = supabase
      .channel(`friend-requests-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
        },
        (payload) => {
          // Check if this request is for us (we are the recipient)
          if (payload.new?.to_user_id === user.uid) {
            log('📬 New friend request received:', payload);
            loadFriendRequests();
            loadNotificationCounts();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'friend_requests',
        },
        (payload) => {
          // Check if we sent this request (for when it gets accepted/declined)
          if (payload.new?.from_user_id === user.uid) {
            log('📬 Our sent friend request status changed:', payload);
            if (payload.new?.status === 'accepted') {
              // Our request was accepted, reload friends list
              loadFriends();
            }
          }
          // Also check if we received this request (for cleanup after accepting)
          if (payload.new?.to_user_id === user.uid) {
            log('📬 Received friend request status changed:', payload);
            loadFriendRequests();
            loadNotificationCounts();
          }
        }
      )
      .subscribe((status) => {
        log('📡 Friend requests subscription status:', status);
      });

    // Subscribe to shared_items table changes (for receiving shared recipes)
    const sharedItemsChannel = supabase
      .channel(`shared-items-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shared_items',
        },
        (payload) => {
          // Check if this shared item is for us
          if (payload.new?.to_user_id === user.uid) {
            log('📦 New shared item received:', payload);
            loadSharedItems();
            loadNotificationCounts();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shared_items',
        },
        (payload) => {
          // Check if this is our shared item being updated (imported/declined)
          if (payload.new?.to_user_id === user.uid) {
            log('📦 Shared item status changed:', payload);
            loadSharedItems();
            loadNotificationCounts();
          }
        }
      )
      .subscribe((status) => {
        log('📡 Shared items subscription status:', status);
      });

    // Subscribe to profile changes (for friends list updates when someone accepts our request)
    const profileChannel = supabase
      .channel(`profile-changes-${user.uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          // Check if this is our profile being updated
          if (payload.new?.user_id === user.uid) {
            log('👤 Our profile updated:', payload);
            // Reload friends if friends array changed
            if (payload.new?.friends) {
              loadFriends();
            }
          }
        }
      )
      .subscribe((status) => {
        log('📡 Profile subscription status:', status);
      });

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(friendRequestsChannel);
      supabase.removeChannel(sharedItemsChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user, profile, loadFriendRequests, loadSharedItems, loadNotificationCounts, loadFriends]);

  // Poll for notifications and friend requests every 10 seconds (fallback for real-time)
  useEffect(() => {
    if (!user || !profile) return;

    const interval = setInterval(() => {
      loadNotificationCounts();
      loadFriendRequests();
      loadFriends();
    }, 10000);

    return () => clearInterval(interval);
  }, [user, profile, loadNotificationCounts, loadFriendRequests, loadFriends]);

  return {
    profile,
    needsUsername,
    friends,
    friendRequests,
    sharedItems,
    notificationCounts,
    loading,

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
  };
};

export default useSocial;

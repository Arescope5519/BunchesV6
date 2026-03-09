/**
 * Supabase Social Features Service
 * Handles usernames, friends, sharing, and notifications
 */

import { supabase } from './config';

/**
 * Generate a random user code (6 characters)
 */
const generateUserCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Check if a username is available
 */
export const isUsernameAvailable = async (username) => {
  try {
    const normalized = username.toLowerCase().trim();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', normalized)
      .single();

    if (error && error.code === 'PGRST116') {
      return true; // Not found = available
    }

    return !data;
  } catch (error) {
    console.error('Error checking username:', error);
    throw error;
  }
};

/**
 * Set up user profile with username
 */
export const setupUserProfile = async (userId, username) => {
  try {
    const normalized = username.toLowerCase().trim();

    const available = await isUsernameAvailable(normalized);
    if (!available) {
      throw new Error('Username is already taken');
    }

    const userCode = generateUserCode();

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        username: normalized,
        user_code: userCode,
        is_private: false,
        is_public: false,  // Default: not publicly visible/searchable
        accepting_friend_requests: true,
        friends: [],
        friend_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;

    console.log(`✅ User profile created: ${normalized}, code: ${userCode}`);
  } catch (error) {
    console.error('Error setting up profile:', error);
    throw error;
  }
};

/**
 * Get user profile
 */
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return null;
    }
    if (error) throw error;

    return {
      id: data.user_id,
      username: data.username,
      userCode: data.user_code,
      isPrivate: data.is_private,
      isPublic: data.is_public || false,
      acceptingFriendRequests: data.accepting_friend_requests,
      friends: data.friends || [],
      friendCount: data.friend_count || 0,
    };
  } catch (error) {
    console.error('Error getting profile:', error);
    throw error;
  }
};

/**
 * Search users by username or user code
 */
export const searchUsersByUsername = async (searchTerm, currentUserId) => {
  try {
    const normalized = searchTerm.trim();
    let users = [];

    // Check if it looks like a user code
    if (normalized.length === 6 && /^[A-Z0-9]+$/i.test(normalized)) {
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id, username, user_code, accepting_friend_requests')
        .eq('user_code', normalized.toUpperCase())
        .neq('user_id', currentUserId)
        .limit(1);

      if (data?.length > 0) {
        return data.map(u => ({
          id: u.user_id,
          username: u.username,
          userCode: u.user_code,
          acceptingFriendRequests: u.accepting_friend_requests,
        }));
      }
    }

    // Search by username
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, username, user_code, accepting_friend_requests')
      .ilike('username', `${normalized.toLowerCase()}%`)
      .neq('user_id', currentUserId)
      .limit(20);

    if (error) throw error;

    return data.map(u => ({
      id: u.user_id,
      username: u.username,
      userCode: u.user_code,
      acceptingFriendRequests: u.accepting_friend_requests,
    }));
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

/**
 * Send friend request
 */
export const sendFriendRequest = async (fromUserId, toUserId) => {
  try {
    // Check if already exists
    const { data: existing } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .eq('status', 'pending')
      .single();

    if (existing) {
      throw new Error('Friend request already sent');
    }

    const { data, error } = await supabase
      .from('friend_requests')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Friend request sent: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

/**
 * Accept friend request
 */
export const acceptFriendRequest = async (requestId, currentUserId) => {
  try {
    // Get request
    const { data: request, error: fetchError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;
    if (request.to_user_id !== currentUserId) {
      throw new Error('Not authorized');
    }

    // Update request
    await supabase
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    // Add to both users' friends lists
    const { data: user1Profile } = await supabase
      .from('user_profiles')
      .select('friends, friend_count')
      .eq('user_id', request.from_user_id)
      .single();

    const { data: user2Profile } = await supabase
      .from('user_profiles')
      .select('friends, friend_count')
      .eq('user_id', request.to_user_id)
      .single();

    await supabase
      .from('user_profiles')
      .update({
        friends: [...(user1Profile?.friends || []), request.to_user_id],
        friend_count: (user1Profile?.friend_count || 0) + 1,
      })
      .eq('user_id', request.from_user_id);

    await supabase
      .from('user_profiles')
      .update({
        friends: [...(user2Profile?.friends || []), request.from_user_id],
        friend_count: (user2Profile?.friend_count || 0) + 1,
      })
      .eq('user_id', request.to_user_id);

    console.log('✅ Friend request accepted');
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

/**
 * Get pending friend requests
 */
export const getPendingFriendRequests = async (userId) => {
  try {
    // First get the pending requests
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, from_user_id, status, created_at')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching friend requests:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Now fetch sender usernames for each request
    const requests = await Promise.all(
      data.map(async (r) => {
        let senderUsername = 'Unknown';
        try {
          const { data: senderProfile } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('user_id', r.from_user_id)
            .single();

          if (senderProfile?.username) {
            senderUsername = senderProfile.username;
          }
        } catch (e) {
          console.log('Could not fetch sender username:', e);
        }

        return {
          id: r.id,
          from: r.from_user_id,
          senderUsername,
          createdAt: new Date(r.created_at).getTime(),
        };
      })
    );

    console.log(`📬 Found ${requests.length} pending friend request(s)`);
    return requests;
  } catch (error) {
    console.error('Error getting friend requests:', error);
    return [];
  }
};

/**
 * Share item with friends
 */
export const shareWithFriends = async (fromUserId, toUserIds, type, data, name) => {
  try {
    const senderProfile = await getUserProfile(fromUserId);

    const items = toUserIds.map(toUserId => ({
      from_user_id: fromUserId,
      from_username: senderProfile?.username || 'Unknown',
      to_user_id: toUserId,
      type: type,
      name: name,
      data: data,
      status: 'pending',
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('shared_items')
      .insert(items);

    if (error) throw error;

    console.log(`✅ Shared ${type} with ${toUserIds.length} friend(s)`);
  } catch (error) {
    console.error('Error sharing:', error);
    throw error;
  }
};

/**
 * Get received shared items
 */
export const getReceivedSharedItems = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('shared_items')
      .select('*')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      from: item.from_user_id,
      fromUsername: item.from_username,
      type: item.type,
      name: item.name,
      data: item.data,
      createdAt: new Date(item.created_at).getTime(),
    }));
  } catch (error) {
    console.error('Error getting shared items:', error);
    return [];
  }
};

/**
 * Mark shared item as imported
 */
export const markSharedItemImported = async (itemId) => {
  try {
    await supabase
      .from('shared_items')
      .update({ status: 'imported', updated_at: new Date().toISOString() })
      .eq('id', itemId);

    console.log('✅ Marked as imported');
  } catch (error) {
    console.error('Error marking imported:', error);
    throw error;
  }
};

/**
 * Decline shared item
 */
export const declineSharedItem = async (itemId) => {
  try {
    await supabase
      .from('shared_items')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', itemId);

    console.log('✅ Shared item declined');
  } catch (error) {
    console.error('Error declining shared item:', error);
    throw error;
  }
};

/**
 * Decline friend request
 */
export const declineFriendRequest = async (requestId) => {
  try {
    await supabase
      .from('friend_requests')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    console.log('✅ Friend request declined');
  } catch (error) {
    console.error('Error declining friend request:', error);
    throw error;
  }
};

/**
 * Remove friend
 */
export const removeFriend = async (userId, friendId) => {
  try {
    // Get both profiles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('friends, friend_count')
      .eq('user_id', userId)
      .single();

    const { data: friendProfile } = await supabase
      .from('user_profiles')
      .select('friends, friend_count')
      .eq('user_id', friendId)
      .single();

    // Remove from user's friends
    await supabase
      .from('user_profiles')
      .update({
        friends: (userProfile?.friends || []).filter(id => id !== friendId),
        friend_count: Math.max((userProfile?.friend_count || 1) - 1, 0),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // Remove from friend's friends
    await supabase
      .from('user_profiles')
      .update({
        friends: (friendProfile?.friends || []).filter(id => id !== userId),
        friend_count: Math.max((friendProfile?.friend_count || 1) - 1, 0),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', friendId);

    console.log('✅ Friend removed');
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

/**
 * Update privacy settings
 */
export const updatePrivacySettings = async (userId, settings) => {
  try {
    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (settings.isPrivate !== undefined) {
      updates.is_private = settings.isPrivate;
    }
    if (settings.isPublic !== undefined) {
      updates.is_public = settings.isPublic;
    }
    if (settings.acceptingFriendRequests !== undefined) {
      updates.accepting_friend_requests = settings.acceptingFriendRequests;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', userId);

    if (error) throw error;

    console.log('✅ Privacy settings updated');
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    throw error;
  }
};

/**
 * Change username
 */
export const changeUsername = async (userId, newUsername) => {
  try {
    const normalized = newUsername.toLowerCase().trim();

    // Check availability
    const available = await isUsernameAvailable(normalized);
    if (!available) {
      throw new Error('Username is already taken');
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({
        username: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw error;

    console.log(`✅ Username changed to: ${normalized}`);
  } catch (error) {
    console.error('Error changing username:', error);
    throw error;
  }
};

/**
 * Get notification counts
 */
export const getNotificationCounts = async (userId) => {
  try {
    const { count: friendRequests } = await supabase
      .from('friend_requests')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', userId)
      .eq('status', 'pending');

    const { count: sharedItems } = await supabase
      .from('shared_items')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', userId)
      .eq('status', 'pending');

    return {
      friendRequests: friendRequests || 0,
      sharedItems: sharedItems || 0,
      total: (friendRequests || 0) + (sharedItems || 0),
    };
  } catch (error) {
    console.error('Error getting notification counts:', error);
    return { friendRequests: 0, sharedItems: 0, total: 0 };
  }
};

export default {
  isUsernameAvailable,
  setupUserProfile,
  getUserProfile,
  searchUsersByUsername,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getPendingFriendRequests,
  shareWithFriends,
  getReceivedSharedItems,
  markSharedItemImported,
  declineSharedItem,
  updatePrivacySettings,
  changeUsername,
  getNotificationCounts,
};

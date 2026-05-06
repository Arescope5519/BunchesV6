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
        is_private: true,  // Default: accounts are private (non-friends see limited info)
        is_public: false,  // Default: not publicly visible/searchable
        accepting_friend_requests: true,
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
        .select('user_id, username, user_code, accepting_friend_requests, is_private')
        .eq('user_code', normalized.toUpperCase())
        .neq('user_id', currentUserId)
        .limit(1);

      if (data?.length > 0) {
        return data.map(u => ({
          id: u.user_id,
          username: u.username,
          userCode: u.user_code,
          acceptingFriendRequests: u.accepting_friend_requests,
          isPrivate: u.is_private || false,
        }));
      }
    }

    // Search by username
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, username, user_code, accepting_friend_requests, is_private')
      .ilike('username', `${normalized.toLowerCase()}%`)
      .neq('user_id', currentUserId)
      .limit(20);

    if (error) throw error;

    return data.map(u => ({
      id: u.user_id,
      username: u.username,
      userCode: u.user_code,
      acceptingFriendRequests: u.accepting_friend_requests,
      isPrivate: u.is_private || false,
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
    // Check if the target user is accepting friend requests
    const { data: targetProfile } = await supabase
      .from('user_profiles')
      .select('accepting_friend_requests')
      .eq('user_id', toUserId)
      .single();

    if (targetProfile && targetProfile.accepting_friend_requests === false) {
      throw new Error('This person is not accepting requests at this time');
    }

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

    // Update request status
    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating request status:', updateError);
      throw updateError;
    }

    // Only update OUR OWN profile (we can't update sender's due to RLS)
    // The sender will sync their profile when they check for accepted requests
    const { data: myProfile } = await supabase
      .from('user_profiles')
      .select('friends, friend_count')
      .eq('user_id', currentUserId)
      .single();

    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        friends: [...(myProfile?.friends || []), request.from_user_id],
        friend_count: (myProfile?.friend_count || 0) + 1,
      })
      .eq('user_id', currentUserId);

    if (profileError) {
      console.error('Error updating my profile:', profileError);
      throw profileError;
    }

    console.log('✅ Friend request accepted - sender will sync on their next refresh');
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

/**
 * Sync accepted friend requests (for the sender's side)
 * Call this when loading friends to ensure sender sees accepted friends
 */
export const syncAcceptedFriendRequests = async (userId) => {
  try {
    // Find requests I SENT that were accepted
    const { data: acceptedRequests, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, to_user_id')
      .eq('from_user_id', userId)
      .eq('status', 'accepted');

    if (fetchError) {
      console.error('Error fetching accepted requests:', fetchError);
      return;
    }

    if (!acceptedRequests || acceptedRequests.length === 0) {
      return; // No accepted requests to sync
    }

    // Get my current friends list
    const { data: myProfile } = await supabase
      .from('user_profiles')
      .select('friends, friend_count')
      .eq('user_id', userId)
      .single();

    const currentFriends = myProfile?.friends || [];
    const newFriends = [];

    // Find friends that aren't in my list yet
    for (const request of acceptedRequests) {
      if (!currentFriends.includes(request.to_user_id)) {
        newFriends.push(request.to_user_id);
      }
    }

    if (newFriends.length > 0) {
      // Update my profile with the new friends
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          friends: [...currentFriends, ...newFriends],
          friend_count: currentFriends.length + newFriends.length,
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error syncing friends:', updateError);
      } else {
        console.log(`✅ Synced ${newFriends.length} new friend(s) from accepted requests`);
      }
    }

    // Clean up: mark these requests as 'synced' so we don't process them again
    // (Or we could delete them, but marking as synced is safer)
    const requestIds = acceptedRequests.map(r => r.id);
    await supabase
      .from('friend_requests')
      .update({ status: 'synced', updated_at: new Date().toISOString() })
      .in('id', requestIds);

  } catch (error) {
    console.error('Error syncing accepted friend requests:', error);
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

/**
 * Check if current user can view another user's profile
 * Returns true if: profile is public OR users are friends
 */
export const canViewProfile = async (viewerId, targetUserId) => {
  try {
    // Get target user's profile
    const { data: targetProfile, error } = await supabase
      .from('user_profiles')
      .select('is_public, friends')
      .eq('user_id', targetUserId)
      .single();

    if (error) return false;

    // Public profile - anyone can view
    if (targetProfile.is_public) return true;

    // Check if viewer is a friend
    const friends = targetProfile.friends || [];
    return friends.includes(viewerId);
  } catch (error) {
    console.error('Error checking profile access:', error);
    return false;
  }
};

/**
 * Get another user's public profile data
 */
export const getPublicProfile = async (targetUserId, viewerId) => {
  try {
    // First check if viewer can access this profile
    const canView = await canViewProfile(viewerId, targetUserId);

    // Get basic profile info
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('user_id, username, user_code, is_public, friends, friend_count, follower_count, following_count, featured_recipes, bio, avatar_url')
      .eq('user_id', targetUserId)
      .single();

    if (error) throw error;

    const isFriend = (profile.friends || []).includes(viewerId);

    // Get recipe count
    let recipeCount = 0;
    try {
      const { count } = await supabase
        .from('user_recipes_v2')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId)
        .is('deleted_at', null);
      recipeCount = count || 0;
    } catch (e) {
      // Fallback to old table
      const { count } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId)
        .is('deleted_at', null);
      recipeCount = count || 0;
    }

    return {
      id: profile.user_id,
      username: profile.username,
      userCode: profile.user_code,
      isPublic: profile.is_public || false,
      friendCount: profile.friend_count || 0,
      followerCount: profile.follower_count || 0,
      followingCount: profile.following_count || 0,
      recipeCount,
      featuredRecipeIds: profile.featured_recipes || [],
      bio: profile.bio || '',
      avatarUrl: profile.avatar_url || null,
      isFriend,
      canView,
    };
  } catch (error) {
    console.error('Error getting public profile:', error);
    return null;
  }
};

/**
 * Get another user's featured recipes
 */
export const getUserFeaturedRecipes = async (targetUserId) => {
  try {
    // Get featured recipe IDs from profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('featured_recipes')
      .eq('user_id', targetUserId)
      .single();

    if (profileError || !profile?.featured_recipes?.length) {
      return [];
    }

    const featuredIds = profile.featured_recipes;

    // Try V2 tables first - get all user recipes and filter by featured IDs
    const { data: v2Data, error: v2Error } = await supabase
      .from('user_recipes_v2')
      .select(`
        id,
        local_recipe_data,
        global_recipes (
          id,
          title,
          image_url,
          source_url
        )
      `)
      .eq('user_id', targetUserId)
      .is('deleted_at', null);

    if (!v2Error && v2Data) {
      // Match by either cloud ID or local_recipe_data.id
      const matched = v2Data.filter(row => {
        const localId = row.local_recipe_data?.id;
        return featuredIds.includes(row.id) || featuredIds.includes(localId);
      });

      return matched.map(row => ({
        id: row.local_recipe_data?.id || row.id,
        title: row.local_recipe_data?.title || row.global_recipes?.title || 'Untitled',
        imageUrl: row.local_recipe_data?.image_url || row.global_recipes?.image_url || null,
        sourceUrl: row.global_recipes?.source_url || null,
        isCustom: !row.global_recipes?.source_url,
      }));
    }

    // Fallback to old table
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, image_url, source_url, recipe_data')
      .eq('user_id', targetUserId)
      .is('deleted_at', null);

    if (error) throw error;

    // Match by either cloud ID or recipe_data.id
    const matched = (data || []).filter(row => {
      const localId = row.recipe_data?.id;
      return featuredIds.includes(row.id) || featuredIds.includes(localId);
    });

    return matched.map(row => ({
      id: row.recipe_data?.id || row.id,
      title: row.title || 'Untitled',
      imageUrl: row.image_url || null,
      sourceUrl: row.source_url || null,
      isCustom: !row.source_url,
    }));
  } catch (error) {
    console.error('Error getting featured recipes:', error);
    return [];
  }
};

/**
 * Get another user's public/custom recipes (not from external sources)
 */
export const getUserPublicRecipes = async (targetUserId) => {
  try {
    // Try V2 tables first - get recipes without external source (custom recipes)
    const { data: v2Data, error: v2Error } = await supabase
      .from('user_recipes_v2')
      .select(`
        id,
        local_recipe_data,
        global_recipe_id,
        global_recipes (
          id,
          title,
          image_url,
          source_url
        )
      `)
      .eq('user_id', targetUserId)
      .is('deleted_at', null)
      .limit(50);

    if (!v2Error && v2Data) {
      // Filter to custom recipes (those with bunches:// URLs or no source URL)
      return v2Data
        .filter(row => {
          const sourceUrl = row.global_recipes?.source_url || row.local_recipe_data?.source_url;
          return !sourceUrl || sourceUrl.startsWith('bunches://');
        })
        .map(row => ({
          id: row.local_recipe_data?.id || row.id,
          title: row.local_recipe_data?.title || row.global_recipes?.title || 'Untitled',
          imageUrl: row.local_recipe_data?.image_url || row.global_recipes?.image_url || null,
          sourceUrl: row.global_recipes?.source_url || null,
          isCustom: true,
        }));
    }

    // Fallback to old table
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, image_url, source_url')
      .eq('user_id', targetUserId)
      .is('deleted_at', null)
      .or('source_url.is.null,source_url.like.bunches://*')
      .limit(50);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      title: row.title || 'Untitled',
      imageUrl: row.image_url || null,
      sourceUrl: row.source_url || null,
      isCustom: true,
    }));
  } catch (error) {
    console.error('Error getting public recipes:', error);
    return [];
  }
};

/**
 * Get another user's public folders
 */
export const getUserPublicFolders = async (targetUserId) => {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('folders')
      .eq('user_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const folders = data?.folders || [];
    // Filter to only public folders
    return folders.filter(f => {
      if (typeof f === 'string') return false; // Old format - assume private
      return f.isPrivate === false;
    }).map(f => typeof f === 'string' ? { name: f, isPrivate: false } : f);
  } catch (error) {
    console.error('Error getting user public folders:', error);
    return [];
  }
};

/**
 * Get another user's favorite recipes (public ones only)
 */
export const getUserFavorites = async (targetUserId) => {
  try {
    // Try V2 tables first
    const { data: v2Data, error: v2Error } = await supabase
      .from('user_recipes_v2')
      .select(`
        id,
        is_favorite,
        folder,
        folders,
        global_recipes (
          id,
          title,
          image_url,
          source_url
        )
      `)
      .eq('user_id', targetUserId)
      .eq('is_favorite', true)
      .is('deleted_at', null)
      .limit(20);

    if (!v2Error && v2Data && v2Data.length > 0) {
      return v2Data.map(row => ({
        id: row.id,
        title: row.global_recipes?.title || 'Untitled',
        imageUrl: row.global_recipes?.image_url || null,
        sourceUrl: row.global_recipes?.source_url || null,
      }));
    }

    // Fallback to old table
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, image_url, source_url')
      .eq('user_id', targetUserId)
      .eq('is_favorite', true)
      .is('deleted_at', null)
      .limit(20);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      title: row.title || 'Untitled',
      imageUrl: row.image_url || null,
      sourceUrl: row.source_url || null,
    }));
  } catch (error) {
    console.error('Error getting user favorites:', error);
    return [];
  }
};

/**
 * Get recipes from a user's public folder
 */
export const getUserFolderRecipes = async (targetUserId, folderName) => {
  try {
    // Try V2 tables first
    const { data: v2Data, error: v2Error } = await supabase
      .from('user_recipes_v2')
      .select(`
        id,
        folder,
        folders,
        global_recipes (
          id,
          title,
          image_url,
          source_url,
          ingredients,
          instructions
        )
      `)
      .eq('user_id', targetUserId)
      .is('deleted_at', null);

    if (!v2Error && v2Data) {
      // Filter by folder (check folders array)
      const filtered = v2Data.filter(row => {
        const recipeFolders = row.folders || [row.folder || 'All Recipes'];
        return recipeFolders.includes(folderName);
      });

      return filtered.map(row => ({
        id: row.id,
        title: row.global_recipes?.title || 'Untitled',
        imageUrl: row.global_recipes?.image_url || null,
        sourceUrl: row.global_recipes?.source_url || null,
      }));
    }

    // Fallback to old table
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, image_url, source_url')
      .eq('user_id', targetUserId)
      .eq('folder', folderName)
      .is('deleted_at', null);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      title: row.title || 'Untitled',
      imageUrl: row.image_url || null,
      sourceUrl: row.source_url || null,
    }));
  } catch (error) {
    console.error('Error getting folder recipes:', error);
    return [];
  }
};

/**
 * Check if current user is following a target user
 */
export const isFollowing = async (currentUserId, targetUserId) => {
  try {
    const { data, error } = await supabase
      .from('user_followers')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .single();

    if (error && error.code === 'PGRST116') {
      return false;
    }
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
};

/**
 * Follow a user
 */
export const followUser = async (currentUserId, targetUserId) => {
  try {
    const { error } = await supabase
      .from('user_followers')
      .insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      });

    if (error) {
      if (error.code === '23505') {
        return true; // Already following
      }
      throw error;
    }

    console.log(`✅ Now following user ${targetUserId}`);
    return true;
  } catch (error) {
    console.error('Error following user:', error);
    throw error;
  }
};

/**
 * Unfollow a user
 */
export const unfollowUser = async (currentUserId, targetUserId) => {
  try {
    const { error } = await supabase
      .from('user_followers')
      .delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId);

    if (error) throw error;

    console.log(`✅ Unfollowed user ${targetUserId}`);
    return true;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw error;
  }
};

/**
 * Get followers list for a user
 */
export const getUserFollowers = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_followers')
      .select(`
        follower_id,
        created_at
      `)
      .eq('following_id', userId);

    if (error) throw error;

    // Get usernames for followers
    const followerIds = data.map(f => f.follower_id);
    if (followerIds.length === 0) return [];

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, username, avatar_url')
      .in('user_id', followerIds);

    if (profileError) throw profileError;

    const profileMap = {};
    profiles.forEach(p => { profileMap[p.user_id] = p; });

    return data.map(f => ({
      id: f.follower_id,
      username: profileMap[f.follower_id]?.username || 'Unknown',
      avatarUrl: profileMap[f.follower_id]?.avatar_url,
      followedAt: f.created_at,
    }));
  } catch (error) {
    console.error('Error getting followers:', error);
    return [];
  }
};

/**
 * Get following list for a user
 */
export const getUserFollowing = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_followers')
      .select(`
        following_id,
        created_at
      `)
      .eq('follower_id', userId);

    if (error) throw error;

    // Get usernames for following
    const followingIds = data.map(f => f.following_id);
    if (followingIds.length === 0) return [];

    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, username, avatar_url')
      .in('user_id', followingIds);

    if (profileError) throw profileError;

    const profileMap = {};
    profiles.forEach(p => { profileMap[p.user_id] = p; });

    return data.map(f => ({
      id: f.following_id,
      username: profileMap[f.following_id]?.username || 'Unknown',
      avatarUrl: profileMap[f.following_id]?.avatar_url,
      followedAt: f.created_at,
    }));
  } catch (error) {
    console.error('Error getting following:', error);
    return [];
  }
};

export default {
  isUsernameAvailable,
  setupUserProfile,
  getUserProfile,
  searchUsersByUsername,
  sendFriendRequest,
  acceptFriendRequest,
  syncAcceptedFriendRequests,
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
  canViewProfile,
  getPublicProfile,
  getUserFeaturedRecipes,
  getUserPublicRecipes,
  getUserPublicFolders,
  getUserFavorites,
  getUserFolderRecipes,
  isFollowing,
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
};

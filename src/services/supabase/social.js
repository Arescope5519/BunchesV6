/**
 * Supabase Social Features Service
 * Handles usernames, friends, sharing, and notifications
 */

import { supabase } from './config';
import { containsProfanity, containsProfanityAsync } from '../profanityFilter';

import { log } from '../../utils/log';
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

    const check = await containsProfanityAsync(normalized);
    if (!check.safe) {
      throw new Error('Username contains inappropriate language');
    }

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

    log(`✅ User profile created: ${normalized}, code: ${userCode}`);
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

    log(`✅ Friend request sent: ${data.id}`);
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

    log('✅ Friend request accepted - sender will sync on their next refresh');
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
        log(`✅ Synced ${newFriends.length} new friend(s) from accepted requests`);
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
          log('Could not fetch sender username:', e);
        }

        return {
          id: r.id,
          from: r.from_user_id,
          senderUsername,
          createdAt: new Date(r.created_at).getTime(),
        };
      })
    );

    log(`📬 Found ${requests.length} pending friend request(s)`);
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

    log(`✅ Shared ${type} with ${toUserIds.length} friend(s)`);
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

    log('✅ Marked as imported');
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

    log('✅ Shared item declined');
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

    log('✅ Friend request declined');
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

    log('✅ Friend removed');
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

    log('✅ Privacy settings updated');
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

    const check = await containsProfanityAsync(normalized);
    if (!check.safe) {
      throw new Error('Username contains inappropriate language');
    }

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

    log(`✅ Username changed to: ${normalized}`);
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

    log('🔍 Featured IDs from profile:', profile?.featured_recipes);

    if (profileError || !profile?.featured_recipes?.length) {
      log('❌ No featured recipes found in profile');
      return [];
    }

    const featuredIds = profile.featured_recipes;
    log('📋 Looking for featured IDs:', featuredIds);

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

    if (!v2Error && v2Data && v2Data.length > 0) {
      // Match by either cloud ID or local_recipe_data.id
      const matched = v2Data.filter(row => {
        const localId = row.local_recipe_data?.id;
        return featuredIds.includes(row.id) || featuredIds.includes(localId);
      });

      if (matched.length > 0) {
        log('✅ Found featured in V2 table:', matched.length);
        return matched.map(row => ({
          id: row.local_recipe_data?.id || row.id,
          title: row.local_recipe_data?.title || row.global_recipes?.title || 'Untitled',
          imageUrl: row.local_recipe_data?.image_url || row.global_recipes?.image_url || null,
          sourceUrl: row.global_recipes?.source_url || null,
          isCustom: !row.global_recipes?.source_url,
        }));
      }
    }

    // Fallback to old recipes table
    log('📂 Checking old recipes table...');
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, image_url, source_url')
      .eq('user_id', targetUserId)
      .in('id', featuredIds)
      .is('deleted_at', null);

    if (error) {
      console.error('❌ Error querying recipes table:', error);
      throw error;
    }

    log('✅ Found in old recipes table:', data?.length);
    return (data || []).map(row => ({
      id: row.id,
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

const MY_CREATIONS_FOLDER = 'My Creations';

/**
 * Check if a recipe is in the My Creations folder or subfolder
 */
const isInMyCreations = (recipe) => {
  const folders = recipe.folders || (recipe.folder ? [recipe.folder] : []);
  return folders.some(f => f === MY_CREATIONS_FOLDER || f.startsWith(MY_CREATIONS_FOLDER + '/'));
};

/**
 * Get another user's public/custom recipes (from My Creations folder)
 */
export const getUserPublicRecipes = async (targetUserId, folderPath = null) => {
  log('🍳 getUserPublicRecipes called:', { targetUserId, folderPath });
  try {
    // Try V2 tables first
    const { data: v2Data, error: v2Error } = await supabase
      .from('user_recipes_v2')
      .select(`
        id,
        folders,
        folder,
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
      .limit(100);

    log('🍳 V2 query result:', { count: v2Data?.length, error: v2Error });

    if (!v2Error && v2Data && v2Data.length > 0) {
      let filtered = v2Data;

      // Filter to specific folder if provided
      if (folderPath) {
        filtered = v2Data.filter(row => {
          const recipeData = row.local_recipe_data || {};
          // Check top-level folders first, then fall back to local_recipe_data
          const folders = row.folders || recipeData.folders || (row.folder ? [row.folder] : (recipeData.folder ? [recipeData.folder] : []));
          return folders.includes(folderPath);
        });
      }

      return filtered.map(row => ({
        id: row.local_recipe_data?.id || row.id,
        title: row.local_recipe_data?.title || row.global_recipes?.title || 'Untitled',
        imageUrl: row.local_recipe_data?.image_url || row.global_recipes?.image_url || null,
        sourceUrl: row.global_recipes?.source_url || null,
        folders: row.folders || row.local_recipe_data?.folders || [],
        isCustom: !row.global_recipes?.source_url,
      }));
    }

    // Fallback to old table
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, image_url, source_url, recipe_data')
      .eq('user_id', targetUserId)
      .is('deleted_at', null)
      .limit(100);

    if (error) throw error;

    let filtered = data || [];

    // Filter to specific folder if provided
    if (folderPath) {
      filtered = filtered.filter(row => {
        const recipeData = row.recipe_data || {};
        const folders = recipeData.folders || (recipeData.folder ? [recipeData.folder] : []);
        return folders.includes(folderPath);
      });
    }

    return filtered.map(row => ({
      id: row.recipe_data?.id || row.id,
      title: row.title || 'Untitled',
      imageUrl: row.image_url || null,
      sourceUrl: row.source_url || null,
      folders: row.recipe_data?.folders || [],
      isCustom: !row.source_url,
    }));
  } catch (error) {
    console.error('Error getting public recipes:', error);
    return [];
  }
};

/**
 * Get another user's My Creations subfolders
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

    // Return My Creations subfolders (paths that start with "My Creations/")
    return folders
      .filter(f => {
        const name = typeof f === 'string' ? f : f.name;
        return name.startsWith(MY_CREATIONS_FOLDER + '/');
      })
      .map(f => {
        const name = typeof f === 'string' ? f : f.name;
        // Extract the subfolder name (first level after My Creations)
        const subPath = name.substring(MY_CREATIONS_FOLDER.length + 1);
        const firstSlash = subPath.indexOf('/');
        const displayName = firstSlash >= 0 ? subPath.substring(0, firstSlash) : subPath;
        return {
          name: name,
          displayName: displayName,
          fullPath: name,
          isPrivate: typeof f === 'object' ? f.isPrivate : false,
        };
      })
      // Remove duplicates (only show first-level subfolders)
      .filter((f, i, arr) => arr.findIndex(x => x.displayName === f.displayName) === i);
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
  log('📂 getUserFolderRecipes called:', { targetUserId, folderName });
  try {
    // Try V2 tables first
    const { data: v2Data, error: v2Error } = await supabase
      .from('user_recipes_v2')
      .select(`
        id,
        folders,
        folder,
        local_recipe_data,
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

    log('📂 V2 query result:', { v2Data: v2Data?.length, v2Error });

    if (!v2Error && v2Data && v2Data.length > 0) {
      // Filter by folder (check both top-level folders and local_recipe_data.folders)
      const filtered = v2Data.filter(row => {
        const recipeData = row.local_recipe_data || {};
        // Check top-level folders first, then fall back to local_recipe_data
        const recipeFolders = row.folders || recipeData.folders || (row.folder ? [row.folder] : (recipeData.folder ? [recipeData.folder] : ['All Recipes']));
        log('📂 Recipe folders:', recipeFolders, 'looking for:', folderName);
        return recipeFolders.includes(folderName);
      });

      log('📂 Filtered V2 recipes:', filtered.length);
      return filtered.map(row => ({
        id: row.local_recipe_data?.id || row.id,
        title: row.local_recipe_data?.title || row.global_recipes?.title || 'Untitled',
        imageUrl: row.local_recipe_data?.image_url || row.global_recipes?.image_url || null,
        sourceUrl: row.global_recipes?.source_url || null,
        folders: row.folders || row.local_recipe_data?.folders || [],
      }));
    }

    // Fallback to old table
    log('📂 Trying old recipes table...');
    const { data, error } = await supabase
      .from('recipes')
      .select('id, title, image_url, source_url, recipe_data')
      .eq('user_id', targetUserId)
      .is('deleted_at', null);

    log('📂 Old table result:', { data: data?.length, error });
    if (error) throw error;

    // Filter by folder from recipe_data
    return (data || [])
      .filter(row => {
        const recipeData = row.recipe_data || {};
        const recipeFolders = recipeData.folders || (recipeData.folder ? [recipeData.folder] : [row.folder || 'All Recipes']);
        return recipeFolders.includes(folderName);
      })
      .map(row => ({
        id: row.id,
        title: row.title || 'Untitled',
        imageUrl: row.image_url || null,
        sourceUrl: row.source_url || null,
        folders: row.recipe_data?.folders || [],
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

    log(`✅ Now following user ${targetUserId}`);
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

    log(`✅ Unfollowed user ${targetUserId}`);
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

/**
 * Get full recipe data from another user's account
 * Returns a recipe object formatted like a local recipe (parsed ingredients/instructions)
 */
export const getFullPublicRecipe = async (targetUserId, recipeId) => {
  log('📖 getFullPublicRecipe:', { targetUserId, recipeId });

  // Fetch owner's username for display
  let ownerUsername = null;
  try {
    const { data: ownerProfile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('user_id', targetUserId)
      .maybeSingle();
    ownerUsername = ownerProfile?.username || null;
  } catch (e) {
    console.warn('Could not fetch owner username:', e);
  }

  const parseIngredients = (raw) => {
    if (!raw) return { main: [] };
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    if (Array.isArray(raw)) return { main: raw };
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed)) return { main: parsed };
      return { main: [String(parsed)] };
    } catch {
      return { main: String(raw).split('\n').filter(l => l.trim()) };
    }
  };

  const parseInstructions = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return String(raw).split('\n').filter(l => l.trim());
    }
  };

  try {
    // Try V2 tables first - match by cloud id or local id
    const { data: v2Data, error: v2Error } = await supabase
      .from('user_recipes_v2')
      .select(`
        id,
        folders,
        folder,
        local_recipe_data,
        global_recipes (
          id,
          title,
          image_url,
          source_url,
          ingredients,
          instructions,
          author
        )
      `)
      .eq('user_id', targetUserId)
      .is('deleted_at', null);

    if (!v2Error && v2Data && v2Data.length > 0) {
      const match = v2Data.find(row => {
        const localId = row.local_recipe_data?.id;
        return row.id === recipeId || localId === recipeId;
      });

      if (match) {
        const local = match.local_recipe_data || {};
        const global = match.global_recipes || {};
        return {
          id: local.id || match.id,
          title: local.title || global.title || 'Untitled',
          image_url: local.image_url || global.image_url || null,
          imageUrl: local.image_url || global.image_url || null,
          source_url: global.source_url || null,
          sourceUrl: global.source_url || null,
          ingredients: parseIngredients(local.ingredients || global.ingredients),
          instructions: parseInstructions(local.instructions || global.instructions),
          folders: match.folders || local.folders || [],
          folder: match.folder || local.folder || 'All Recipes',
          author: global.author || null,
          createdBy: local.createdBy || { id: targetUserId, username: ownerUsername },
          ownerUserId: targetUserId,
          ownerUsername,
          isReadOnly: true,
        };
      }
    }

    // Fallback to old recipes table
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('id', recipeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching full public recipe:', error);
      return null;
    }
    if (!data) return null;

    const rd = data.recipe_data || {};
    return {
      id: data.id,
      title: data.title || rd.title || 'Untitled',
      image_url: data.image_url || rd.image_url || null,
      imageUrl: data.image_url || rd.image_url || null,
      source_url: data.source_url || null,
      sourceUrl: data.source_url || null,
      ingredients: parseIngredients(rd.ingredients || data.ingredients),
      instructions: parseInstructions(rd.instructions || data.instructions),
      folders: rd.folders || (data.folder ? [data.folder] : []),
      folder: data.folder || rd.folder || 'All Recipes',
      notes: data.notes || rd.notes || null,
      createdBy: rd.createdBy || { id: targetUserId, username: ownerUsername },
      ownerUserId: targetUserId,
      ownerUsername,
      isReadOnly: true,
    };
  } catch (error) {
    console.error('❌ getFullPublicRecipe error:', error);
    return null;
  }
};

/**
 * Report a recipe or user for inappropriate content
 * @param {object} params
 * @param {string} params.reporterId
 * @param {string} params.reportedUserId
 * @param {string} params.contentType - 'recipe' | 'profile' | 'other'
 * @param {string} params.contentId - id of the content being reported
 * @param {string} params.reason - short reason category
 * @param {string} [params.details] - optional user-provided text
 * @returns {Promise<boolean>}
 */
export const submitContentReport = async ({
  reporterId,
  reportedUserId,
  contentType,
  contentId,
  reason,
  details,
}) => {
  try {
    // Rate limit: max 10 reports per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('content_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', reporterId)
      .gte('created_at', oneHourAgo);

    if (recentCount != null && recentCount >= 10) {
      console.warn('🚩 Rate limit hit for reporter:', reporterId);
      return { success: false, rateLimited: true };
    }

    // Duplicate check: prevent same report on same content within 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dupCount } = await supabase
      .from('content_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', reporterId)
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .gte('created_at', oneDayAgo);

    if (dupCount != null && dupCount > 0) {
      log('🚩 Duplicate report from same reporter');
      return { success: false, duplicate: true };
    }

    const { error } = await supabase.from('content_reports').insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      content_type: contentType,
      content_id: contentId,
      reason: reason,
      details: details || null,
      status: 'pending_review',
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('❌ Failed to submit report:', error);
      return { success: false };
    }

    log('🚩 Report submitted:', { contentType, reason });
    return { success: true };
  } catch (err) {
    console.error('❌ submitContentReport error:', err);
    return { success: false };
  }
};

/**
 * Block a user - they can't see your content and you can't see theirs
 */
export const blockUser = async (currentUserId, targetUserId) => {
  try {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return false;

    const { error } = await supabase
      .from('user_blocks')
      .insert({
        blocker_id: currentUserId,
        blocked_id: targetUserId,
      });

    if (error && error.code !== '23505') {
      // 23505 = unique violation (already blocked)
      console.error('❌ Failed to block user:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ blockUser error:', err);
    return false;
  }
};

/**
 * Unblock a user
 */
export const unblockUser = async (currentUserId, targetUserId) => {
  try {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', targetUserId);

    if (error) {
      console.error('❌ Failed to unblock user:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ unblockUser error:', err);
    return false;
  }
};

/**
 * Check if currentUser has blocked targetUser OR is blocked by targetUser
 * @returns {Promise<{blocking: boolean, blockedBy: boolean}>}
 */
export const getBlockStatus = async (currentUserId, targetUserId) => {
  try {
    if (!currentUserId || !targetUserId) {
      return { blocking: false, blockedBy: false };
    }

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocker_id, blocked_id')
      .or(
        `and(blocker_id.eq.${currentUserId},blocked_id.eq.${targetUserId}),` +
        `and(blocker_id.eq.${targetUserId},blocked_id.eq.${currentUserId})`
      );

    if (error) {
      console.error('❌ getBlockStatus error:', error);
      return { blocking: false, blockedBy: false };
    }

    const blocking = data?.some(r => r.blocker_id === currentUserId);
    const blockedBy = data?.some(r => r.blocker_id === targetUserId);
    return { blocking, blockedBy };
  } catch (err) {
    console.error('❌ getBlockStatus error:', err);
    return { blocking: false, blockedBy: false };
  }
};

/**
 * Get list of users the current user has blocked
 */
export const getBlockedUsers = async (currentUserId) => {
  try {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', currentUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ getBlockedUsers error:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Enrich with usernames
    const ids = data.map(row => row.blocked_id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, username, avatar_url')
      .in('user_id', ids);

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

    return data.map(row => ({
      userId: row.blocked_id,
      username: profileMap[row.blocked_id]?.username || 'unknown',
      avatarUrl: profileMap[row.blocked_id]?.avatar_url || null,
      blockedAt: row.created_at,
    }));
  } catch (err) {
    console.error('❌ getBlockedUsers error:', err);
    return [];
  }
};

/**
 * Check if a user is an admin
 */
export const isUserAdmin = async (userId) => {
  try {
    if (!userId) return false;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return false;
    return !!data?.is_admin;
  } catch {
    return false;
  }
};

/**
 * Check if a user has premium (paid) status
 */
export const isUserPremium = async (userId) => {
  try {
    if (!userId) return false;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('is_premium, premium_until, is_admin')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return false;
    if (!data) return false;
    // Admins get all premium features for testing
    if (data.is_admin) return true;
    if (!data.is_premium) return false;
    // Check expiry if set
    if (data.premium_until && new Date(data.premium_until) < new Date()) return false;
    return true;
  } catch {
    return false;
  }
};

/**
 * Admin: get pending reports with reporter and reported user info
 */
export const getPendingReports = async () => {
  try {
    const { data: reports, error } = await supabase
      .from('content_reports')
      .select('*')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ getPendingReports error:', error);
      return [];
    }

    if (!reports || reports.length === 0) return [];

    // Get all user_ids involved so we can enrich with usernames
    const userIds = new Set();
    reports.forEach(r => {
      if (r.reporter_id) userIds.add(r.reporter_id);
      if (r.reported_user_id) userIds.add(r.reported_user_id);
    });

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, username')
      .in('user_id', Array.from(userIds));

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p.username; });

    return reports.map(r => ({
      ...r,
      reporterUsername: profileMap[r.reporter_id] || 'unknown',
      reportedUsername: profileMap[r.reported_user_id] || 'unknown',
    }));
  } catch (err) {
    console.error('❌ getPendingReports error:', err);
    return [];
  }
};

/**
 * Admin: resolve a report (dismiss, delete content, or ban user)
 * @param {string} reportId
 * @param {string} resolution - 'dismissed' | 'content_removed' | 'user_banned'
 * @param {string} [notes] - optional reviewer notes
 */
export const resolveReport = async (reportId, resolution, notes = null) => {
  try {
    const { error } = await supabase
      .from('content_reports')
      .update({
        status: resolution,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: notes,
      })
      .eq('id', reportId);

    if (error) {
      console.error('❌ resolveReport error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ resolveReport error:', err);
    return false;
  }
};

/**
 * Admin: ban a user (they can no longer sign in / their content is hidden)
 */
export const banUser = async (userId, reason = null) => {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason: reason,
        is_public: false,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('❌ banUser error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ banUser error:', err);
    return false;
  }
};

/**
 * Admin: soft-delete a recipe by id (works for both recipes and user_recipes_v2)
 */
export const adminDeleteRecipe = async (recipeId) => {
  try {
    const now = new Date().toISOString();
    // Try both tables; ignore errors
    await supabase.from('recipes').update({ deleted_at: now }).eq('id', recipeId);
    await supabase.from('user_recipes_v2').update({ deleted_at: now }).eq('id', recipeId);
    return true;
  } catch (err) {
    console.error('❌ adminDeleteRecipe error:', err);
    return false;
  }
};

// ========================================================================
// MEAL PLANNING (Premium feature)
// ========================================================================

/**
 * Get the Monday of the week containing the given date (ISO format)
 */
export const getWeekStart = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
};

/**
 * Load a user's meal plan for a specific week
 * @param {string} userId
 * @param {string} weekStartDate - "YYYY-MM-DD" (Monday)
 * @returns {Promise<object|null>}
 */
export const getMealPlan = async (userId, weekStartDate) => {
  try {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', weekStartDate)
      .maybeSingle();

    if (error) {
      console.error('❌ getMealPlan error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('❌ getMealPlan error:', err);
    return null;
  }
};

/**
 * Save (upsert) a meal plan
 * @param {string} userId
 * @param {string} weekStartDate - "YYYY-MM-DD" (Monday)
 * @param {object} meals - { "YYYY-MM-DD": { breakfast: [recipeIds], lunch: [], dinner: [] } }
 */
export const saveMealPlan = async (userId, weekStartDate, meals) => {
  try {
    const { error } = await supabase
      .from('meal_plans')
      .upsert({
        user_id: userId,
        week_start_date: weekStartDate,
        meals,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_start_date' });

    if (error) {
      console.error('❌ saveMealPlan error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ saveMealPlan error:', err);
    return false;
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
  getFullPublicRecipe,
  submitContentReport,
  blockUser,
  unblockUser,
  getBlockStatus,
  getBlockedUsers,
  isUserAdmin,
  isUserPremium,
  getPendingReports,
  resolveReport,
  banUser,
  adminDeleteRecipe,
  getWeekStart,
  getMealPlan,
  saveMealPlan,
};

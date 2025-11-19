/**
 * Social Features Service
 * Handles usernames, friends, sharing, and notifications
 */

import firestore from '@react-native-firebase/firestore';

// Collections
const USERS_COLLECTION = 'users';
const USERNAMES_COLLECTION = 'usernames'; // For uniqueness lookup
const FRIEND_REQUESTS_COLLECTION = 'friend_requests';
const SHARED_ITEMS_COLLECTION = 'shared_items';

/**
 * Check if a username is available
 * @param {string} username - Desired username
 * @returns {Promise<boolean>} True if available
 */
export const isUsernameAvailable = async (username) => {
  try {
    const normalizedUsername = username.toLowerCase().trim();
    const doc = await firestore()
      .collection(USERNAMES_COLLECTION)
      .doc(normalizedUsername)
      .get();

    return !doc.exists;
  } catch (error) {
    console.error('Error checking username:', error);
    throw error;
  }
};

/**
 * Set up user profile with username (first-time sign-in)
 * @param {string} userId - User's UID
 * @param {string} username - Chosen username
 * @param {string} displayName - User's display name
 * @returns {Promise<void>}
 */
export const setupUserProfile = async (userId, username, displayName) => {
  try {
    const normalizedUsername = username.toLowerCase().trim();

    // Check availability one more time
    const available = await isUsernameAvailable(normalizedUsername);
    if (!available) {
      throw new Error('Username is already taken');
    }

    const batch = firestore().batch();

    // Create user profile
    const userRef = firestore().collection(USERS_COLLECTION).doc(userId);
    batch.set(userRef, {
      username: normalizedUsername,
      displayName: displayName || username,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      // Privacy settings
      isPrivate: false, // If true, only friends can share to them
      acceptingFriendRequests: true,
      // Social data
      friends: [],
      friendCount: 0,
    }, { merge: true });

    // Reserve username in lookup collection
    const usernameRef = firestore().collection(USERNAMES_COLLECTION).doc(normalizedUsername);
    batch.set(usernameRef, {
      userId: userId,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    console.log(`✅ User profile created with username: ${normalizedUsername}`);
  } catch (error) {
    console.error('Error setting up user profile:', error);
    throw error;
  }
};

/**
 * Get user profile
 * @param {string} userId - User's UID
 * @returns {Promise<Object|null>} User profile or null
 */
export const getUserProfile = async (userId) => {
  try {
    const doc = await firestore()
      .collection(USERS_COLLECTION)
      .doc(userId)
      .get();

    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

/**
 * Search for users by username
 * @param {string} searchTerm - Username to search for
 * @param {string} currentUserId - Current user's ID (to exclude from results)
 * @returns {Promise<Array>} Array of matching users
 */
export const searchUsersByUsername = async (searchTerm, currentUserId) => {
  try {
    const normalizedSearch = searchTerm.toLowerCase().trim();

    // Search for usernames that start with the search term
    const snapshot = await firestore()
      .collection(USERS_COLLECTION)
      .where('username', '>=', normalizedSearch)
      .where('username', '<=', normalizedSearch + '\uf8ff')
      .limit(20)
      .get();

    const users = [];
    snapshot.forEach(doc => {
      if (doc.id !== currentUserId) {
        const data = doc.data();
        users.push({
          id: doc.id,
          username: data.username,
          displayName: data.displayName,
          acceptingFriendRequests: data.acceptingFriendRequests,
        });
      }
    });

    return users;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

/**
 * Send a friend request
 * @param {string} fromUserId - Sender's user ID
 * @param {string} toUserId - Recipient's user ID
 * @returns {Promise<string>} Request ID
 */
export const sendFriendRequest = async (fromUserId, toUserId) => {
  try {
    // Check if recipient is accepting friend requests
    const recipientProfile = await getUserProfile(toUserId);
    if (!recipientProfile) {
      throw new Error('User not found');
    }
    if (!recipientProfile.acceptingFriendRequests) {
      throw new Error('User is not accepting friend requests');
    }

    // Check if already friends
    if (recipientProfile.friends && recipientProfile.friends.includes(fromUserId)) {
      throw new Error('Already friends with this user');
    }

    // Check if request already exists
    const existingRequest = await firestore()
      .collection(FRIEND_REQUESTS_COLLECTION)
      .where('from', '==', fromUserId)
      .where('to', '==', toUserId)
      .where('status', '==', 'pending')
      .get();

    if (!existingRequest.empty) {
      throw new Error('Friend request already sent');
    }

    // Check for reverse request (they sent to us)
    const reverseRequest = await firestore()
      .collection(FRIEND_REQUESTS_COLLECTION)
      .where('from', '==', toUserId)
      .where('to', '==', fromUserId)
      .where('status', '==', 'pending')
      .get();

    if (!reverseRequest.empty) {
      // Auto-accept since both want to be friends
      const requestId = reverseRequest.docs[0].id;
      await acceptFriendRequest(requestId, fromUserId);
      return requestId;
    }

    // Create new request
    const requestRef = await firestore()
      .collection(FRIEND_REQUESTS_COLLECTION)
      .add({
        from: fromUserId,
        to: toUserId,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

    console.log(`✅ Friend request sent: ${requestRef.id}`);
    return requestRef.id;
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

/**
 * Accept a friend request
 * @param {string} requestId - Request ID
 * @param {string} currentUserId - Current user's ID (must be the recipient)
 * @returns {Promise<void>}
 */
export const acceptFriendRequest = async (requestId, currentUserId) => {
  try {
    const requestDoc = await firestore()
      .collection(FRIEND_REQUESTS_COLLECTION)
      .doc(requestId)
      .get();

    if (!requestDoc.exists) {
      throw new Error('Friend request not found');
    }

    const request = requestDoc.data();
    if (request.to !== currentUserId) {
      throw new Error('Not authorized to accept this request');
    }

    const batch = firestore().batch();

    // Update request status
    batch.update(requestDoc.ref, {
      status: 'accepted',
      acceptedAt: firestore.FieldValue.serverTimestamp(),
    });

    // Add each user to the other's friends list
    const user1Ref = firestore().collection(USERS_COLLECTION).doc(request.from);
    const user2Ref = firestore().collection(USERS_COLLECTION).doc(request.to);

    batch.update(user1Ref, {
      friends: firestore.FieldValue.arrayUnion(request.to),
      friendCount: firestore.FieldValue.increment(1),
    });

    batch.update(user2Ref, {
      friends: firestore.FieldValue.arrayUnion(request.from),
      friendCount: firestore.FieldValue.increment(1),
    });

    await batch.commit();
    console.log(`✅ Friend request accepted`);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

/**
 * Decline a friend request
 * @param {string} requestId - Request ID
 * @param {string} currentUserId - Current user's ID
 * @returns {Promise<void>}
 */
export const declineFriendRequest = async (requestId, currentUserId) => {
  try {
    const requestDoc = await firestore()
      .collection(FRIEND_REQUESTS_COLLECTION)
      .doc(requestId)
      .get();

    if (!requestDoc.exists) {
      throw new Error('Friend request not found');
    }

    const request = requestDoc.data();
    if (request.to !== currentUserId) {
      throw new Error('Not authorized to decline this request');
    }

    await requestDoc.ref.update({
      status: 'declined',
      declinedAt: firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Friend request declined`);
  } catch (error) {
    console.error('Error declining friend request:', error);
    throw error;
  }
};

/**
 * Remove a friend
 * @param {string} userId - Current user's ID
 * @param {string} friendId - Friend to remove
 * @returns {Promise<void>}
 */
export const removeFriend = async (userId, friendId) => {
  try {
    const batch = firestore().batch();

    const userRef = firestore().collection(USERS_COLLECTION).doc(userId);
    const friendRef = firestore().collection(USERS_COLLECTION).doc(friendId);

    batch.update(userRef, {
      friends: firestore.FieldValue.arrayRemove(friendId),
      friendCount: firestore.FieldValue.increment(-1),
    });

    batch.update(friendRef, {
      friends: firestore.FieldValue.arrayRemove(userId),
      friendCount: firestore.FieldValue.increment(-1),
    });

    await batch.commit();
    console.log(`✅ Friend removed`);
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

/**
 * Get pending friend requests for a user
 * @param {string} userId - User's ID
 * @returns {Promise<Array>} Array of pending requests
 */
export const getPendingFriendRequests = async (userId) => {
  try {
    const snapshot = await firestore()
      .collection(FRIEND_REQUESTS_COLLECTION)
      .where('to', '==', userId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const requests = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      // Get sender's profile
      const senderProfile = await getUserProfile(data.from);
      requests.push({
        id: doc.id,
        ...data,
        senderUsername: senderProfile?.username || 'Unknown',
        senderDisplayName: senderProfile?.displayName || 'Unknown',
        createdAt: data.createdAt?.toMillis() || Date.now(),
      });
    }

    return requests;
  } catch (error) {
    console.error('Error getting friend requests:', error);
    throw error;
  }
};

/**
 * Get friends list with profiles
 * @param {string} userId - User's ID
 * @returns {Promise<Array>} Array of friend profiles
 */
export const getFriendsList = async (userId) => {
  try {
    const userProfile = await getUserProfile(userId);
    if (!userProfile || !userProfile.friends || userProfile.friends.length === 0) {
      return [];
    }

    const friends = [];
    for (const friendId of userProfile.friends) {
      const friendProfile = await getUserProfile(friendId);
      if (friendProfile) {
        friends.push({
          id: friendId,
          username: friendProfile.username,
          displayName: friendProfile.displayName,
        });
      }
    }

    return friends;
  } catch (error) {
    console.error('Error getting friends list:', error);
    throw error;
  }
};

/**
 * Share recipe or cookbook with friends
 * @param {string} fromUserId - Sender's user ID
 * @param {Array<string>} toUserIds - Array of recipient user IDs
 * @param {string} type - 'recipe' or 'cookbook'
 * @param {Object} data - Recipe or cookbook data
 * @param {string} name - Name/title of shared item
 * @returns {Promise<void>}
 */
export const shareWithFriends = async (fromUserId, toUserIds, type, data, name) => {
  try {
    const senderProfile = await getUserProfile(fromUserId);

    const batch = firestore().batch();

    for (const toUserId of toUserIds) {
      // Check if recipient allows sharing from this user
      const recipientProfile = await getUserProfile(toUserId);
      if (recipientProfile?.isPrivate) {
        // Check if they're friends
        if (!recipientProfile.friends || !recipientProfile.friends.includes(fromUserId)) {
          console.log(`Skipping ${toUserId} - private account and not friends`);
          continue;
        }
      }

      const shareRef = firestore().collection(SHARED_ITEMS_COLLECTION).doc();
      batch.set(shareRef, {
        from: fromUserId,
        fromUsername: senderProfile?.username || 'Unknown',
        fromDisplayName: senderProfile?.displayName || 'Unknown',
        to: toUserId,
        type: type,
        name: name,
        data: data,
        status: 'pending', // pending, imported, declined
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(`✅ Shared ${type} with ${toUserIds.length} friend(s)`);
  } catch (error) {
    console.error('Error sharing with friends:', error);
    throw error;
  }
};

/**
 * Get shared items received by user
 * @param {string} userId - User's ID
 * @returns {Promise<Array>} Array of shared items
 */
export const getReceivedSharedItems = async (userId) => {
  try {
    const snapshot = await firestore()
      .collection(SHARED_ITEMS_COLLECTION)
      .where('to', '==', userId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      items.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toMillis() || Date.now(),
      });
    });

    return items;
  } catch (error) {
    console.error('Error getting shared items:', error);
    throw error;
  }
};

/**
 * Mark shared item as imported
 * @param {string} itemId - Shared item ID
 * @returns {Promise<void>}
 */
export const markSharedItemImported = async (itemId) => {
  try {
    await firestore()
      .collection(SHARED_ITEMS_COLLECTION)
      .doc(itemId)
      .update({
        status: 'imported',
        importedAt: firestore.FieldValue.serverTimestamp(),
      });
    console.log(`✅ Marked shared item as imported`);
  } catch (error) {
    console.error('Error marking item imported:', error);
    throw error;
  }
};

/**
 * Decline a shared item
 * @param {string} itemId - Shared item ID
 * @returns {Promise<void>}
 */
export const declineSharedItem = async (itemId) => {
  try {
    await firestore()
      .collection(SHARED_ITEMS_COLLECTION)
      .doc(itemId)
      .update({
        status: 'declined',
        declinedAt: firestore.FieldValue.serverTimestamp(),
      });
    console.log(`✅ Declined shared item`);
  } catch (error) {
    console.error('Error declining shared item:', error);
    throw error;
  }
};

/**
 * Update privacy settings
 * @param {string} userId - User's ID
 * @param {Object} settings - Settings to update
 * @returns {Promise<void>}
 */
export const updatePrivacySettings = async (userId, settings) => {
  try {
    await firestore()
      .collection(USERS_COLLECTION)
      .doc(userId)
      .update({
        ...settings,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    console.log(`✅ Privacy settings updated`);
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    throw error;
  }
};

/**
 * Update user's display name
 * @param {string} userId - User's ID
 * @param {string} displayName - New display name
 * @returns {Promise<void>}
 */
export const updateDisplayName = async (userId, displayName) => {
  try {
    await firestore()
      .collection(USERS_COLLECTION)
      .doc(userId)
      .update({
        displayName: displayName.trim(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    console.log(`✅ Display name updated`);
  } catch (error) {
    console.error('Error updating display name:', error);
    throw error;
  }
};

/**
 * Get notification counts (friend requests + shared items)
 * @param {string} userId - User's ID
 * @returns {Promise<Object>} { friendRequests: number, sharedItems: number, total: number }
 */
export const getNotificationCounts = async (userId) => {
  try {
    // Count pending friend requests
    const requestsSnapshot = await firestore()
      .collection(FRIEND_REQUESTS_COLLECTION)
      .where('to', '==', userId)
      .where('status', '==', 'pending')
      .get();

    // Count pending shared items
    const sharedSnapshot = await firestore()
      .collection(SHARED_ITEMS_COLLECTION)
      .where('to', '==', userId)
      .where('status', '==', 'pending')
      .get();

    const friendRequests = requestsSnapshot.size;
    const sharedItems = sharedSnapshot.size;

    return {
      friendRequests,
      sharedItems,
      total: friendRequests + sharedItems,
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
  getFriendsList,
  shareWithFriends,
  getReceivedSharedItems,
  markSharedItemImported,
  declineSharedItem,
  updatePrivacySettings,
  updateDisplayName,
  getNotificationCounts,
};

/**
 * Social Features Service
 * Handles usernames, friends, sharing, and notifications
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { getFirebaseFirestore } from './config';

// Collections
const USERS_COLLECTION = 'users';
const USERNAMES_COLLECTION = 'usernames'; // For uniqueness lookup
const FRIEND_REQUESTS_COLLECTION = 'friend_requests';
const SHARED_ITEMS_COLLECTION = 'shared_items';

/**
 * Remove undefined values from an object (Firestore doesn't allow undefined)
 * @param {Object} obj - Object to clean
 * @returns {Object} Object without undefined values
 */
const removeUndefinedFields = (obj) => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' ? removeUndefinedFields(value) : value;
    }
  }
  return cleaned;
};

/**
 * Generate a random user code (6 characters)
 * @returns {string} Random alphanumeric code
 */
const generateUserCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0,O,1,I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Check if a username is available
 * @param {string} username - Desired username
 * @returns {Promise<boolean>} True if available
 */
export const isUsernameAvailable = async (username) => {
  try {
    const db = getFirebaseFirestore();
    const normalizedUsername = username.toLowerCase().trim();
    const usernameRef = doc(db, USERNAMES_COLLECTION, normalizedUsername);
    const docSnap = await getDoc(usernameRef);

    return !docSnap.exists();
  } catch (error) {
    console.error('Error checking username:', error);
    throw error;
  }
};

/**
 * Set up user profile with username (first-time sign-in)
 * @param {string} userId - User's UID
 * @param {string} username - Chosen username
 * @returns {Promise<void>}
 */
export const setupUserProfile = async (userId, username) => {
  try {
    const db = getFirebaseFirestore();
    const normalizedUsername = username.toLowerCase().trim();

    // Check availability one more time
    const available = await isUsernameAvailable(normalizedUsername);
    if (!available) {
      throw new Error('Username is already taken');
    }

    const batch = writeBatch(db);

    // Generate unique user code
    const userCode = generateUserCode();

    // Create user profile
    const userRef = doc(db, USERS_COLLECTION, userId);
    batch.set(userRef, {
      username: normalizedUsername,
      userCode: userCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Privacy settings
      isPrivate: false, // If true, only friends can share to them
      acceptingFriendRequests: true,
      // Social data
      friends: [],
      friendCount: 0,
    }, { merge: true });

    // Reserve username in lookup collection
    const usernameRef = doc(db, USERNAMES_COLLECTION, normalizedUsername);
    batch.set(usernameRef, {
      userId: userId,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    console.log(`✅ User profile created with username: ${normalizedUsername}, code: ${userCode}`);
  } catch (error) {
    console.error('Error setting up user profile:', error);
    throw error;
  }
};

/**
 * Change username
 * @param {string} userId - User's UID
 * @param {string} oldUsername - Current username
 * @param {string} newUsername - New username
 * @returns {Promise<void>}
 */
export const changeUsername = async (userId, oldUsername, newUsername) => {
  try {
    const db = getFirebaseFirestore();
    const normalizedOld = oldUsername.toLowerCase().trim();
    const normalizedNew = newUsername.toLowerCase().trim();

    if (normalizedOld === normalizedNew) {
      return; // No change needed
    }

    // Check if new username is available
    const available = await isUsernameAvailable(normalizedNew);
    if (!available) {
      throw new Error('Username is already taken');
    }

    const batch = writeBatch(db);

    // Update user profile
    const userRef = doc(db, USERS_COLLECTION, userId);
    batch.update(userRef, {
      username: normalizedNew,
      updatedAt: serverTimestamp(),
    });

    // Release old username
    const oldUsernameRef = doc(db, USERNAMES_COLLECTION, normalizedOld);
    batch.delete(oldUsernameRef);

    // Reserve new username
    const newUsernameRef = doc(db, USERNAMES_COLLECTION, normalizedNew);
    batch.set(newUsernameRef, {
      userId: userId,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    console.log(`✅ Username changed from ${normalizedOld} to ${normalizedNew}`);
  } catch (error) {
    console.error('Error changing username:', error);
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
    const db = getFirebaseFirestore();
    const userRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

/**
 * Ensure user has a user code (migration for existing accounts)
 * @param {string} userId - User's UID
 * @returns {Promise<string>} User code (existing or newly generated)
 */
export const ensureUserCode = async (userId) => {
  try {
    const db = getFirebaseFirestore();
    const userRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      throw new Error('User not found');
    }

    const data = docSnap.data();

    // If user already has a code, return it
    if (data.userCode) {
      return data.userCode;
    }

    // Generate a new user code for existing account
    const userCode = generateUserCode();
    await updateDoc(userRef, {
      userCode: userCode,
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Generated user code for existing account: ${userCode}`);
    return userCode;
  } catch (error) {
    console.error('Error ensuring user code:', error);
    throw error;
  }
};

/**
 * Search for users by username or user code
 * @param {string} searchTerm - Username or user code to search for
 * @param {string} currentUserId - Current user's ID (to exclude from results)
 * @returns {Promise<Array>} Array of matching users
 */
export const searchUsersByUsername = async (searchTerm, currentUserId) => {
  try {
    const db = getFirebaseFirestore();
    const normalizedSearch = searchTerm.trim();
    const users = [];

    // Check if it looks like a user code (6 chars, uppercase)
    if (normalizedSearch.length === 6 && /^[A-Z0-9]+$/.test(normalizedSearch.toUpperCase())) {
      // Search by user code
      const codeQuery = query(
        collection(db, USERS_COLLECTION),
        where('userCode', '==', normalizedSearch.toUpperCase()),
        limit(1)
      );
      const codeSnapshot = await getDocs(codeQuery);

      codeSnapshot.forEach(docSnap => {
        if (docSnap.id !== currentUserId) {
          const data = docSnap.data();
          users.push({
            id: docSnap.id,
            username: data.username,
            userCode: data.userCode,
            acceptingFriendRequests: data.acceptingFriendRequests,
          });
        }
      });

      if (users.length > 0) {
        return users;
      }
    }

    // Search for usernames that start with the search term
    const usernameQuery = query(
      collection(db, USERS_COLLECTION),
      where('username', '>=', normalizedSearch.toLowerCase()),
      where('username', '<=', normalizedSearch.toLowerCase() + '\uf8ff'),
      limit(20)
    );
    const snapshot = await getDocs(usernameQuery);

    snapshot.forEach(docSnap => {
      if (docSnap.id !== currentUserId) {
        const data = docSnap.data();
        users.push({
          id: docSnap.id,
          username: data.username,
          userCode: data.userCode,
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
    const db = getFirebaseFirestore();

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
    const existingQuery = query(
      collection(db, FRIEND_REQUESTS_COLLECTION),
      where('from', '==', fromUserId),
      where('to', '==', toUserId),
      where('status', '==', 'pending')
    );
    const existingRequest = await getDocs(existingQuery);

    if (!existingRequest.empty) {
      throw new Error('Friend request already sent');
    }

    // Check for reverse request (they sent to us)
    const reverseQuery = query(
      collection(db, FRIEND_REQUESTS_COLLECTION),
      where('from', '==', toUserId),
      where('to', '==', fromUserId),
      where('status', '==', 'pending')
    );
    const reverseRequest = await getDocs(reverseQuery);

    if (!reverseRequest.empty) {
      // Auto-accept since both want to be friends
      const requestId = reverseRequest.docs[0].id;
      await acceptFriendRequest(requestId, fromUserId);
      return requestId;
    }

    // Create new request
    const requestRef = await addDoc(collection(db, FRIEND_REQUESTS_COLLECTION), {
      from: fromUserId,
      to: toUserId,
      status: 'pending',
      createdAt: serverTimestamp(),
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
    const db = getFirebaseFirestore();
    const requestRef = doc(db, FRIEND_REQUESTS_COLLECTION, requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Friend request not found');
    }

    const request = requestDoc.data();
    if (request.to !== currentUserId) {
      throw new Error('Not authorized to accept this request');
    }

    const batch = writeBatch(db);

    // Update request status
    batch.update(requestRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
    });

    // Add each user to the other's friends list
    const user1Ref = doc(db, USERS_COLLECTION, request.from);
    const user2Ref = doc(db, USERS_COLLECTION, request.to);

    batch.update(user1Ref, {
      friends: arrayUnion(request.to),
      friendCount: increment(1),
    });

    batch.update(user2Ref, {
      friends: arrayUnion(request.from),
      friendCount: increment(1),
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
    const db = getFirebaseFirestore();
    const requestRef = doc(db, FRIEND_REQUESTS_COLLECTION, requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Friend request not found');
    }

    const request = requestDoc.data();
    if (request.to !== currentUserId) {
      throw new Error('Not authorized to decline this request');
    }

    await updateDoc(requestRef, {
      status: 'declined',
      declinedAt: serverTimestamp(),
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
    const db = getFirebaseFirestore();
    const batch = writeBatch(db);

    const userRef = doc(db, USERS_COLLECTION, userId);
    const friendRef = doc(db, USERS_COLLECTION, friendId);

    batch.update(userRef, {
      friends: arrayRemove(friendId),
      friendCount: increment(-1),
    });

    batch.update(friendRef, {
      friends: arrayRemove(userId),
      friendCount: increment(-1),
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
    const db = getFirebaseFirestore();
    console.log('📥 Getting pending friend requests for:', userId);

    // Query without orderBy to avoid needing a composite index
    const requestsQuery = query(
      collection(db, FRIEND_REQUESTS_COLLECTION),
      where('to', '==', userId),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(requestsQuery);

    console.log(`📥 Found ${snapshot.size} pending requests`);

    const requests = [];
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      console.log('📥 Request data:', { id: docSnap.id, from: data.from, to: data.to, status: data.status });

      // Get sender's profile
      const senderProfile = await getUserProfile(data.from);
      requests.push({
        id: docSnap.id,
        ...data,
        senderUsername: senderProfile?.username || 'Unknown',
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
      });
    }

    // Sort by createdAt in memory
    requests.sort((a, b) => b.createdAt - a.createdAt);

    console.log(`📥 Returning ${requests.length} requests:`, requests);
    return requests;
  } catch (error) {
    console.error('❌ Error getting friend requests:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
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
          userCode: friendProfile.userCode,
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
    const db = getFirebaseFirestore();
    const senderProfile = await getUserProfile(fromUserId);

    // Clean data to remove undefined values (Firestore doesn't allow them)
    const cleanedData = removeUndefinedFields(data);

    const batch = writeBatch(db);

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

      const shareRef = doc(collection(db, SHARED_ITEMS_COLLECTION));
      batch.set(shareRef, {
        from: fromUserId,
        fromUsername: senderProfile?.username || 'Unknown',
        to: toUserId,
        type: type,
        name: name,
        data: cleanedData,
        status: 'pending', // pending, imported, declined
        createdAt: serverTimestamp(),
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
    const db = getFirebaseFirestore();
    console.log('🔍 Fetching shared items for user:', userId);

    const sharedQuery = query(
      collection(db, SHARED_ITEMS_COLLECTION),
      where('to', '==', userId),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(sharedQuery);

    const items = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      console.log('📦 Found shared item:', docSnap.id, data);
      items.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
      });
    });

    // Sort by createdAt in memory to avoid composite index requirement
    items.sort((a, b) => b.createdAt - a.createdAt);

    console.log(`✅ Found ${items.length} shared items`);
    return items;
  } catch (error) {
    console.error('❌ Error getting shared items:', error);
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
    const db = getFirebaseFirestore();
    const itemRef = doc(db, SHARED_ITEMS_COLLECTION, itemId);

    await updateDoc(itemRef, {
      status: 'imported',
      importedAt: serverTimestamp(),
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
    const db = getFirebaseFirestore();
    const itemRef = doc(db, SHARED_ITEMS_COLLECTION, itemId);

    await updateDoc(itemRef, {
      status: 'declined',
      declinedAt: serverTimestamp(),
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
    const db = getFirebaseFirestore();
    const userRef = doc(db, USERS_COLLECTION, userId);

    await updateDoc(userRef, {
      ...settings,
      updatedAt: serverTimestamp(),
    });
    console.log(`✅ Privacy settings updated`);
  } catch (error) {
    console.error('Error updating privacy settings:', error);
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
    const db = getFirebaseFirestore();

    // Count pending friend requests
    const requestsQuery = query(
      collection(db, FRIEND_REQUESTS_COLLECTION),
      where('to', '==', userId),
      where('status', '==', 'pending')
    );
    const requestsSnapshot = await getDocs(requestsQuery);

    // Count pending shared items
    const sharedQuery = query(
      collection(db, SHARED_ITEMS_COLLECTION),
      where('to', '==', userId),
      where('status', '==', 'pending')
    );
    const sharedSnapshot = await getDocs(sharedQuery);

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
  changeUsername,
  getUserProfile,
  ensureUserCode,
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
  getNotificationCounts,
};

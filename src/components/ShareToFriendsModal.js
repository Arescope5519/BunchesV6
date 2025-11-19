/**
 * Share to Friends Modal
 * Select friends to share a recipe or cookbook with
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import colors from '../constants/colors';

export const ShareToFriendsModal = ({
  visible,
  onClose,
  onShare,
  friends,
  itemName,
  itemType, // 'recipe' or 'cookbook'
}) => {
  const [selectedFriends, setSelectedFriends] = useState(new Set());

  const toggleFriend = (friendId) => {
    setSelectedFriends(prev => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleShare = () => {
    if (selectedFriends.size === 0) return;
    onShare(Array.from(selectedFriends));
    setSelectedFriends(new Set());
    onClose();
  };

  const handleClose = () => {
    setSelectedFriends(new Set());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Share {itemType === 'recipe' ? 'Recipe' : 'Cookbook'}</Text>
              <Text style={styles.itemName} numberOfLines={1}>{itemName}</Text>
            </View>
            <TouchableOpacity
              onPress={handleShare}
              disabled={selectedFriends.size === 0}
            >
              <Text style={[
                styles.shareButton,
                selectedFriends.size === 0 && styles.shareButtonDisabled
              ]}>
                Share
              </Text>
            </TouchableOpacity>
          </View>

          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No friends yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add friends to share recipes with them
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.selectLabel}>
                Select friends ({selectedFriends.size} selected)
              </Text>
              <ScrollView style={styles.friendsList}>
                {friends.map(friend => {
                  const isSelected = selectedFriends.has(friend.id);
                  return (
                    <TouchableOpacity
                      key={friend.id}
                      style={[
                        styles.friendItem,
                        isSelected && styles.friendItemSelected
                      ]}
                      onPress={() => toggleFriend(friend.id)}
                    >
                      <View style={styles.checkbox}>
                        {isSelected && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={styles.displayName}>{friend.displayName}</Text>
                        <Text style={styles.username}>@{friend.username}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  itemName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cancelButton: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  shareButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  shareButtonDisabled: {
    color: colors.textSecondary,
    opacity: 0.5,
  },
  selectLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    padding: 16,
    paddingBottom: 8,
  },
  friendsList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  friendItemSelected: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  username: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
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
});

export default ShareToFriendsModal;

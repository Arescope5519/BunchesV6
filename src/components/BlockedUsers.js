/**
 * FILENAME: src/components/BlockedUsers.js
 * PURPOSE: List and manage users the current user has blocked.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import colors from '../constants/colors';
import { getBlockedUsers, unblockUser } from '../services/supabase/social';

const BlockedUsers = ({ visible, onClose, currentUserId }) => {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const list = await getBlockedUsers(currentUserId);
      setBlocked(list);
    } catch (err) {
      console.error('Failed to load blocked users:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleUnblock = (item) => {
    Alert.alert(
      `Unblock @${item.username}?`,
      'They will be able to see your public content and interact with you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingId(item.userId);
            try {
              const ok = await unblockUser(currentUserId, item.userId);
              if (ok) {
                setBlocked(prev => prev.filter(b => b.userId !== item.userId));
              } else {
                Alert.alert('Error', 'Could not unblock user. Try again.');
              }
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString();
    } catch { return ''; }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Blocked Users</Text>
          <View style={{ width: 60 }} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : blocked.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No blocked users</Text>
            <Text style={styles.emptyText}>
              You haven't blocked anyone. Blocked users will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          >
            <Text style={styles.count}>
              {blocked.length} blocked user{blocked.length !== 1 ? 's' : ''}
            </Text>
            {blocked.map(item => (
              <View key={item.userId} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.username || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.username}>@{item.username}</Text>
                  <Text style={styles.date}>
                    Blocked {formatDate(item.blockedAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.unblockButton}
                  onPress={() => handleUnblock(item)}
                  disabled={unblockingId === item.userId}
                >
                  {unblockingId === item.userId ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.unblockButtonText}>Unblock</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.primary,
    paddingTop: 20,
  },
  closeButton: { color: '#fff', fontSize: 16, fontWeight: '600' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  list: { flex: 1, padding: 16 },
  count: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  username: { fontSize: 15, fontWeight: '600', color: colors.text },
  date: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  unblockButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  unblockButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default BlockedUsers;

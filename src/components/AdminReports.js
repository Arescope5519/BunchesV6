/**
 * FILENAME: src/components/AdminReports.js
 * PURPOSE: Admin review UI for content_reports table
 *
 * Only visible to users with user_profiles.is_admin = true.
 * Shows pending reports, lets admin preview the content and resolve.
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
import {
  getPendingReports,
  resolveReport,
  banUser,
  adminDeleteRecipe,
  getFullPublicRecipe,
} from '../services/supabase/social';

const AdminReports = ({ visible, onClose, onOpenRecipe, onOpenProfile }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [actioning, setActioning] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPendingReports();
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadReports();
  }, [visible, loadReports]);

  const formatReason = (reason) => {
    const map = {
      inappropriate: 'Inappropriate content',
      hate_harassment: 'Hate or harassment',
      spam: 'Spam or misleading',
      other: 'Other',
    };
    return map[reason] || reason;
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch { return iso; }
  };

  const previewContent = async (report) => {
    if (report.content_type === 'recipe') {
      const recipe = await getFullPublicRecipe(report.reported_user_id, report.content_id);
      if (recipe) {
        onOpenRecipe?.(recipe);
      } else {
        Alert.alert('Content Not Found', 'This recipe may have already been deleted.');
      }
    } else if (report.content_type === 'profile') {
      onOpenProfile?.(report.reported_user_id);
    }
  };

  const doAction = async (report, action) => {
    setActioning(true);
    try {
      let ok = false;
      if (action === 'dismiss') {
        ok = await resolveReport(report.id, 'dismissed');
      } else if (action === 'delete') {
        if (report.content_type === 'recipe') {
          await adminDeleteRecipe(report.content_id);
        }
        ok = await resolveReport(report.id, 'content_removed');
      } else if (action === 'ban') {
        await banUser(report.reported_user_id, `Ban issued from report ${report.id}`);
        ok = await resolveReport(report.id, 'user_banned');
      }

      if (ok) {
        Alert.alert('Done', 'Report resolved.');
        setSelectedReport(null);
        await loadReports();
      } else {
        Alert.alert('Error', 'Failed to resolve report.');
      }
    } finally {
      setActioning(false);
    }
  };

  const confirmAction = (report, action) => {
    const messages = {
      dismiss: {
        title: 'Dismiss Report',
        body: 'Mark this report as reviewed with no action taken?',
      },
      delete: {
        title: 'Delete Content',
        body: `This will delete the reported ${report.content_type}. Continue?`,
      },
      ban: {
        title: 'Ban User',
        body: `This will ban @${report.reportedUsername}. They will not be able to sign in. Continue?`,
      },
    };
    const m = messages[action];

    Alert.alert(m.title, m.body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: action === 'dismiss' ? 'default' : 'destructive',
        onPress: () => doAction(report, action),
      },
    ]);
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
          <Text style={styles.title}>Moderation Queue</Text>
          <TouchableOpacity onPress={loadReports}>
            <Text style={styles.refreshButton}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : reports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>No pending reports</Text>
            <Text style={styles.emptyText}>All caught up!</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={loadReports} />}
          >
            <Text style={styles.count}>{reports.length} pending report{reports.length !== 1 ? 's' : ''}</Text>
            {reports.map(report => (
              <TouchableOpacity
                key={report.id}
                style={styles.reportCard}
                onPress={() => setSelectedReport(report)}
              >
                <View style={styles.reportHeader}>
                  <Text style={styles.reportType}>
                    {report.content_type === 'recipe' ? '🍳 Recipe' : '👤 Profile'}
                  </Text>
                  <Text style={styles.reportDate}>{formatDate(report.created_at)}</Text>
                </View>
                <Text style={styles.reportReason}>{formatReason(report.reason)}</Text>
                <Text style={styles.reportUsers}>
                  @{report.reporterUsername} → @{report.reportedUsername}
                </Text>
                {report.details && (
                  <Text style={styles.reportDetails} numberOfLines={2}>
                    "{report.details}"
                  </Text>
                )}
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Detail modal for a specific report */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !actioning && setSelectedReport(null)}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setSelectedReport(null)}
              disabled={actioning}
            >
              <Text style={[styles.closeButton, actioning && { opacity: 0.4 }]}>{'< Back'}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Report Details</Text>
            <View style={{ width: 60 }} />
          </View>

          {selectedReport && (
            <ScrollView style={styles.detailContent}>
              <Text style={styles.detailLabel}>Reported {selectedReport.content_type}</Text>
              <Text style={styles.detailValue}>ID: {selectedReport.content_id}</Text>

              <Text style={styles.detailLabel}>Reporter</Text>
              <Text style={styles.detailValue}>@{selectedReport.reporterUsername}</Text>

              <Text style={styles.detailLabel}>Reported User</Text>
              <Text style={styles.detailValue}>@{selectedReport.reportedUsername}</Text>

              <Text style={styles.detailLabel}>Reason</Text>
              <Text style={styles.detailValue}>{formatReason(selectedReport.reason)}</Text>

              {selectedReport.details && (
                <>
                  <Text style={styles.detailLabel}>Additional details</Text>
                  <Text style={styles.detailValue}>{selectedReport.details}</Text>
                </>
              )}

              <Text style={styles.detailLabel}>Submitted</Text>
              <Text style={styles.detailValue}>{formatDate(selectedReport.created_at)}</Text>

              <View style={styles.actionSection}>
                <TouchableOpacity
                  style={styles.previewButton}
                  onPress={() => previewContent(selectedReport)}
                  disabled={actioning}
                >
                  <Text style={styles.previewButtonText}>👁 Preview Content</Text>
                </TouchableOpacity>

                <Text style={styles.actionsHeader}>Actions</Text>

                <TouchableOpacity
                  style={[styles.actionButton, styles.dismissButton]}
                  onPress={() => confirmAction(selectedReport, 'dismiss')}
                  disabled={actioning}
                >
                  <Text style={styles.actionButtonText}>Dismiss (no action)</Text>
                </TouchableOpacity>

                {selectedReport.content_type === 'recipe' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => confirmAction(selectedReport, 'delete')}
                    disabled={actioning}
                  >
                    <Text style={styles.actionButtonText}>Delete recipe</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.banButton]}
                  onPress={() => confirmAction(selectedReport, 'ban')}
                  disabled={actioning}
                >
                  <Text style={styles.actionButtonText}>Ban @{selectedReport.reportedUsername}</Text>
                </TouchableOpacity>

                {actioning && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
    backgroundColor: colors.primary,
    paddingTop: 20,
  },
  closeButton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    color: '#fff',
    fontSize: 14,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  list: { flex: 1, padding: 16 },
  count: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reportType: { fontSize: 14, fontWeight: '600', color: colors.primary },
  reportDate: { fontSize: 11, color: colors.textSecondary },
  reportReason: { fontSize: 15, color: colors.text, marginBottom: 4 },
  reportUsers: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  reportDetails: { fontSize: 13, color: colors.text, fontStyle: 'italic' },
  detailContent: { flex: 1, padding: 20 },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  detailValue: { fontSize: 15, color: colors.text, marginTop: 4 },
  actionSection: { marginTop: 30, marginBottom: 40 },
  previewButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  previewButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  actionsHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  actionButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  dismissButton: { backgroundColor: '#95a5a6' },
  deleteButton: { backgroundColor: '#e67e22' },
  banButton: { backgroundColor: colors.error || '#e74c3c' },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

export default AdminReports;

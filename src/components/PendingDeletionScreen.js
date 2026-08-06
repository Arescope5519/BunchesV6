/**
 * FILENAME: src/components/PendingDeletionScreen.js
 * PURPOSE: Shown instead of the app when the signed-in account is
 * scheduled for deletion.
 *
 * Blocking rather than warning is deliberate: the account still has all
 * its data, so letting someone keep cooking in it would mean building up
 * recipes that are silently destroyed on the purge date.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import colors from '../constants/colors';
import { APP_NAME, SUPPORT_EMAIL } from '../constants/app';
import { cancelAccountDeletion, daysUntilPurge } from '../services/supabase/account';

const PendingDeletionScreen = ({ purgeAfter, onRestored, onSignOut }) => {
  const [restoring, setRestoring] = useState(false);
  const days = daysUntilPurge(purgeAfter);

  const dateLabel = purgeAfter
    ? purgeAfter.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'soon';

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await cancelAccountDeletion();
      onRestored?.();
    } catch (err) {
      console.error('Restore failed:', err);
      Alert.alert(
        'Could Not Restore',
        `Something went wrong restoring your account. Please try again, or contact ${SUPPORT_EMAIL}.`
      );
      setRestoring(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="time-outline" size={48} color={colors.primary} />

        <Text style={styles.title}>Account scheduled for deletion</Text>

        <Text style={styles.body}>
          Your {APP_NAME} account and everything in it will be permanently
          deleted on <Text style={styles.bold}>{dateLabel}</Text>
          {days > 0 ? ` - ${days} ${days === 1 ? 'day' : 'days'} from now.` : '.'}
        </Text>

        <Text style={styles.body}>
          Nothing has been deleted yet. Restore your account now and your
          recipes, cookbooks and friends come back exactly as you left them.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, restoring && styles.buttonDisabled]}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Restore My Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSignOut}
          disabled={restoring}
        >
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Signing out changes nothing. Deletion still goes ahead on{' '}
          {dateLabel} unless you restore the account before then.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  bold: { fontWeight: '700' },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  secondaryButton: { paddingVertical: 14, alignSelf: 'stretch', alignItems: 'center' },
  secondaryButtonText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default PendingDeletionScreen;

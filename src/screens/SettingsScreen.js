/**
 * FILENAME: src/screens/SettingsScreen.js
 * PURPOSE: App settings and preferences
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import colors from '../constants/colors';
import { cleanupDeletedRecipes, checkFirestoreRecipes } from '../utils/cleanupFirestore';

export const SettingsScreen = ({
  onClose,
  onClearAllData,
  recipeCount,
  user,
  onSignOut,
  onSignIn,
  profile,
  onOpenSocial,
  onUpdatePrivacySettings,
}) => {
  const [cleaningFirestore, setCleaningFirestore] = useState(false);
  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all recipes, cookbooks, and grocery list items. This action cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: onClearAllData,
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your data is safely synced to the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: onSignOut,
        },
      ]
    );
  };

  const handleCleanupFirestore = async () => {
    if (!user) {
      Alert.alert('Not Signed In', 'You must be signed in to clean Firestore.');
      return;
    }

    Alert.alert(
      'Clean Firestore Database',
      'This will compare your local recipes with Firestore and remove any that were deleted locally but are stuck in the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check & Clean',
          onPress: async () => {
            setCleaningFirestore(true);
            try {
              // First check what's there
              const { allRecipes, deletedRecipes, stuckRecipes } = await checkFirestoreRecipes(user.uid);

              const totalToClean = deletedRecipes.length + stuckRecipes.length;

              if (totalToClean === 0) {
                Alert.alert('✅ Clean!', `Firestore has ${allRecipes.length} recipes and they all match your local data. Nothing to clean!`);
                setCleaningFirestore(false);
                return;
              }

              // Found recipes to clean
              let message = `Found ${totalToClean} recipe${totalToClean !== 1 ? 's' : ''} to remove:\n\n`;
              if (deletedRecipes.length > 0) {
                message += `• ${deletedRecipes.length} soft-deleted (in Recently Deleted)\n`;
              }
              if (stuckRecipes.length > 0) {
                message += `• ${stuckRecipes.length} permanently deleted locally but stuck in cloud\n`;
              }
              message += `\nThis will clean them from Firestore.`;

              Alert.alert(
                'Found Items to Clean',
                message,
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => setCleaningFirestore(false) },
                  {
                    text: 'Clean Now',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const count = await cleanupDeletedRecipes(user.uid);
                        Alert.alert(
                          '✅ Cleanup Complete',
                          `Removed ${count} recipe${count !== 1 ? 's' : ''} from Firestore.\n\nYou now have ${allRecipes.length - count} active recipes in the cloud.`
                        );
                      } catch (error) {
                        console.error('Cleanup error:', error);
                        Alert.alert('Error', 'Failed to clean Firestore. Check your internet connection.');
                      } finally {
                        setCleaningFirestore(false);
                      }
                    },
                  },
                ]
              );
            } catch (error) {
              console.error('Cleanup error:', error);
              Alert.alert('Error', 'Failed to clean Firestore. Check your internet connection.');
              setCleaningFirestore(false);
            }
          },
        },
      ]
    );
  };

  const handlePrivateToggle = async (value) => {
    if (!onUpdatePrivacySettings) return;
    await onUpdatePrivacySettings({ isPrivate: value });
  };

  const handleAcceptingRequestsToggle = async (value) => {
    if (!onUpdatePrivacySettings) return;
    await onUpdatePrivacySettings({ acceptingFriendRequests: value });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" hidden={true} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Account Section */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.infoCard}>
              <View style={styles.accountHeader}>
                <Text style={styles.accountLabel}>Signed in as</Text>
                <View style={styles.accountBadge}>
                  <Text style={styles.accountBadgeText}>☁️ Cloud Sync Active</Text>
                </View>
              </View>
              {user.displayName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>{user.displayName}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
              {profile?.createdAt && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Member as of:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(profile.createdAt.toMillis ? profile.createdAt.toMillis() : profile.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
              >
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.infoCard}>
              <View style={styles.accountBadge}>
                <Text style={styles.localModeText}>📱 Local Mode</Text>
              </View>
              <Text style={styles.localModeDescription}>
                Sign in with Google to enable cloud sync and access your recipes from any device.
              </Text>
              {onSignIn && (
                <TouchableOpacity
                  style={styles.signInButton}
                  onPress={onSignIn}
                >
                  <Text style={styles.signInButtonText}>🔐 Sign In with Google</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Social Section */}
        {user && profile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social</Text>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={onOpenSocial}
            >
              <View style={styles.profileButtonContent}>
                <View>
                  <Text style={styles.profileButtonTitle}>Friends & Profile</Text>
                  <Text style={styles.profileButtonSubtitle}>
                    @{profile.username} · {profile.userCode}
                  </Text>
                </View>
                <Text style={styles.profileButtonArrow}>→</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Privacy Settings */}
        {user && profile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.infoCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Private Account</Text>
                  <Text style={styles.settingDescription}>
                    Only friends can share recipes with you
                  </Text>
                </View>
                <Switch
                  value={profile.isPrivate || false}
                  onValueChange={handlePrivateToggle}
                  trackColor={{ false: '#D1D5DB', true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.settingRow, styles.settingRowBorder]}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Accepting Friend Requests</Text>
                  <Text style={styles.settingDescription}>
                    Allow others to send you friend requests
                  </Text>
                </View>
                <Switch
                  value={profile.acceptingFriendRequests || false}
                  onValueChange={handleAcceptingRequestsToggle}
                  trackColor={{ false: '#D1D5DB', true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        )}

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>6.05</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Recipes</Text>
              <Text style={styles.infoValue}>{recipeCount}</Text>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>

          {/* Cleanup Firestore Button - Only show if signed in */}
          {user && (
            <TouchableOpacity
              style={[styles.cleanupButton, cleaningFirestore && styles.buttonDisabled]}
              onPress={handleCleanupFirestore}
              disabled={cleaningFirestore}
            >
              {cleaningFirestore ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.dangerButtonText}>🧹 Clean Firestore Database</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.dangerButton, user && { marginTop: 12 }]}
            onPress={handleClearAllData}
          >
            <Text style={styles.dangerButtonText}>🗑️ Clear All Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
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
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  closeButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 15,
    color: colors.text,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  aboutText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  featureItem: {
    fontSize: 15,
    color: colors.text,
    paddingVertical: 6,
    lineHeight: 22,
  },
  dangerButton: {
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cleanupButton: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  bottomSpacer: {
    height: 40,
  },
  accountHeader: {
    marginBottom: 12,
  },
  accountLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  accountBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  accountBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  signOutButton: {
    marginTop: 16,
    backgroundColor: colors.error,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  localModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  localModeDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  signInButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  profileButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  profileButtonSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  profileButtonArrow: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
    paddingTop: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

export default SettingsScreen;

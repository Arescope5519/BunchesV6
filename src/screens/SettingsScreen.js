/**
 * FILENAME: src/screens/SettingsScreen.js
 * PURPOSE: App settings and preferences
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
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
  friends,
  onChangeUsername,
  checkUsernameAvailable,
  recipes,
  folders,
  onRestoreBackup,
}) => {
  const [cleaningFirestore, setCleaningFirestore] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  const validateUsername = (value) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    return cleaned.substring(0, 20);
  };

  // Check username availability with debounce
  useEffect(() => {
    if (!editingUsername || !newUsername || newUsername.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    if (newUsername.toLowerCase() === profile?.username?.toLowerCase()) {
      setUsernameAvailable(null); // Same as current, no need to check
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const available = await checkUsernameAvailable(newUsername);
        setUsernameAvailable(available);
      } catch (err) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newUsername, editingUsername, profile?.username, checkUsernameAvailable]);

  const handleSaveUsername = async () => {
    const trimmedUsername = newUsername.trim().toLowerCase();

    if (!trimmedUsername || trimmedUsername === profile?.username) {
      setEditingUsername(false);
      return;
    }

    if (trimmedUsername.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    if (usernameAvailable === false) {
      Alert.alert('Error', 'Username is already taken');
      return;
    }

    if (usernameAvailable === null) {
      Alert.alert('Error', 'Unable to verify username availability');
      return;
    }

    setSavingUsername(true);
    try {
      await onChangeUsername(trimmedUsername);
      setEditingUsername(false);
      setNewUsername('');
      setUsernameAvailable(null);
    } catch (error) {
      console.error('Failed to change username:', error);
    } finally {
      setSavingUsername(false);
    }
  };

  // Helper to convert local image to base64
  const imageToBase64 = async (imageUri) => {
    if (!imageUri) return null;

    // Skip remote URLs - we can't backup those
    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      return imageUri; // Keep the URL as-is
    }

    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        return null;
      }

      // Read as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Determine mime type from extension
      const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.log('Could not read image:', imageUri, error);
      return null;
    }
  };

  // Create a backup of all recipes
  const handleExportBackup = async () => {
    if (!recipes || recipes.length === 0) {
      Alert.alert('No Recipes', 'You have no recipes to backup.');
      return;
    }

    setIsExporting(true);
    try {
      // Filter out deleted recipes
      const activeRecipes = recipes.filter(r => !r.deletedAt);

      if (activeRecipes.length === 0) {
        Alert.alert('No Recipes', 'You have no active recipes to backup.');
        setIsExporting(false);
        return;
      }

      // Process recipes with images
      const recipesWithImages = await Promise.all(
        activeRecipes.map(async (recipe) => {
          const imageData = await imageToBase64(recipe.image_url);
          return {
            title: recipe.title,
            folder: recipe.folder,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            prep_time: recipe.prep_time,
            cook_time: recipe.cook_time,
            servings: recipe.servings,
            notes: recipe.notes,
            image_url: imageData, // Now contains base64 or original URL
            source_url: recipe.source_url,
          };
        })
      );

      const backupData = {
        type: 'bunches_backup',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        recipeCount: recipesWithImages.length,
        folders: folders || [],
        recipes: recipesWithImages,
      };

      // Create filename with date
      const date = new Date();
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const fileName = `bunches-backup-${dateStr}.json`;

      // Try documentDirectory first, then cacheDirectory as fallback
      let baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;

      if (!baseDir) {
        // Last resort - try to get a temp directory
        try {
          const tempDir = `${FileSystem.documentDirectory || ''}`;
          if (tempDir) {
            baseDir = tempDir;
          }
        } catch (e) {
          // ignore
        }
      }

      if (!baseDir) {
        Alert.alert('Error', 'Could not access storage on this device. Try restarting the app.');
        setIsExporting(false);
        return;
      }

      const filePath = `${baseDir}${fileName}`;

      // Write to file
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backupData), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Save Bunches Backup',
        });

        Alert.alert(
          '✅ Backup Created',
          `Backup of ${recipesWithImages.length} recipe${recipesWithImages.length !== 1 ? 's' : ''} with images has been created.\n\nSave the file somewhere safe to restore later.`
        );
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Backup error:', error);
      Alert.alert('Error', `Failed to create backup: ${error.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Restore recipes from backup file
  const handleRestoreBackup = async () => {
    try {
      // Open document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return; // User cancelled
      }

      const file = result.assets[0];

      // Read the file
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Parse JSON
      const backupData = JSON.parse(fileContent);

      // Validate backup data
      if (!backupData.type || backupData.type !== 'bunches_backup') {
        Alert.alert('Invalid Backup', 'This does not appear to be a valid Bunches backup file.');
        return;
      }

      if (!backupData.recipes || !Array.isArray(backupData.recipes)) {
        Alert.alert('Invalid Backup', 'No recipes found in this backup.');
        return;
      }

      const recipeCount = backupData.recipes.length;
      const backupDate = backupData.exportedAt
        ? new Date(backupData.exportedAt).toLocaleDateString()
        : 'Unknown date';

      Alert.alert(
        'Restore Backup',
        `This backup contains ${recipeCount} recipe${recipeCount !== 1 ? 's' : ''} from ${backupDate}.\n\nThis will add these recipes to your collection. Existing recipes will not be affected.\n\nImages will be restored if they were included in the backup.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              try {
                if (onRestoreBackup) {
                  await onRestoreBackup(backupData);
                  Alert.alert('✅ Restored', `Successfully restored ${recipeCount} recipe${recipeCount !== 1 ? 's' : ''}.`);
                }
              } catch (error) {
                console.error('Restore error:', error);
                Alert.alert('Error', 'Failed to restore backup. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Restore error:', error);
      if (error.message?.includes('JSON')) {
        Alert.alert('Invalid File', 'Could not read backup file. Make sure you selected a valid Bunches backup file.');
      } else {
        Alert.alert('Error', 'Failed to open backup file. Please try again.');
      }
    }
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

        {/* Social Profile Section */}
        {user && profile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social Profile</Text>
            <View style={styles.infoCard}>
              {/* Username */}
              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>Username</Text>
                {editingUsername ? (
                  <View style={styles.editNameContainer}>
                    <View style={styles.usernameInputRow}>
                      <Text style={styles.atSymbol}>@</Text>
                      <TextInput
                        style={styles.usernameEditInput}
                        value={newUsername}
                        onChangeText={(text) => setNewUsername(validateUsername(text))}
                        placeholder="newusername"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={20}
                        autoFocus
                      />
                      {checkingUsername && (
                        <ActivityIndicator size="small" color={colors.primary} />
                      )}
                      {!checkingUsername && usernameAvailable === true && (
                        <Text style={styles.availableIcon}>✓</Text>
                      )}
                      {!checkingUsername && usernameAvailable === false && (
                        <Text style={styles.unavailableIcon}>✗</Text>
                      )}
                    </View>
                    {newUsername.length > 0 && newUsername.length < 3 && (
                      <Text style={styles.usernameHint}>At least 3 characters</Text>
                    )}
                    {usernameAvailable === false && (
                      <Text style={styles.unavailableText}>Username is taken</Text>
                    )}
                    {usernameAvailable === true && (
                      <Text style={styles.availableText}>Username is available!</Text>
                    )}
                    <View style={styles.editNameActions}>
                      <TouchableOpacity
                        onPress={handleSaveUsername}
                        style={[
                          styles.saveNameButton,
                          (!usernameAvailable || savingUsername) && styles.buttonDisabled
                        ]}
                        disabled={!usernameAvailable || savingUsername}
                      >
                        {savingUsername ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.saveNameButtonText}>Save</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingUsername(false);
                          setNewUsername('');
                          setUsernameAvailable(null);
                        }}
                        style={styles.cancelNameButton}
                      >
                        <Text style={styles.cancelNameButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.displayNameRow}>
                    <Text style={styles.profileValue}>@{profile?.username || 'Not set'}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setNewUsername(profile?.username || '');
                        setEditingUsername(true);
                      }}
                      style={styles.editButton}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* User Code */}
              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>User Code</Text>
                <Text style={styles.profileValue}>{profile?.userCode || 'Not set'}</Text>
                <Text style={styles.profileHint}>Friends can also find you with this code</Text>
              </View>

              {/* Friends Count */}
              <View style={styles.profileItem}>
                <Text style={styles.profileLabel}>Friends</Text>
                <Text style={styles.profileValue}>{friends?.length || 0}</Text>
              </View>
            </View>
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

        {/* Backup & Restore Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup & Restore</Text>
          <View style={styles.infoCard}>
            <Text style={styles.backupDescription}>
              Create a backup of all your recipes to save locally or restore from a previous backup.
            </Text>
            <TouchableOpacity
              style={[styles.backupButton, isExporting && styles.buttonDisabled]}
              onPress={handleExportBackup}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.backupButtonText}>📤 Export Backup</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestoreBackup}
            >
              <Text style={styles.restoreButtonText}>📥 Restore from Backup</Text>
            </TouchableOpacity>
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
  profileItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  profileValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  profileHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  displayNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  editNameContainer: {
    marginTop: 8,
  },
  usernameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  atSymbol: {
    fontSize: 16,
    color: colors.text,
    marginRight: 4,
  },
  usernameEditInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },
  availableIcon: {
    color: '#4CAF50',
    fontSize: 20,
    marginLeft: 8,
  },
  unavailableIcon: {
    color: '#f44336',
    fontSize: 20,
    marginLeft: 8,
  },
  usernameHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  unavailableText: {
    fontSize: 12,
    color: '#f44336',
    marginTop: 4,
  },
  availableText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  editNameActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  saveNameButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveNameButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelNameButton: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelNameButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Backup & Restore styles
  backupDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  backupButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  backupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  restoreButton: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  restoreInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 120,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalRestoreButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  modalRestoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default SettingsScreen;

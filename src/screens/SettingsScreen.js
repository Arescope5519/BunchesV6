/**
 * FILENAME: src/screens/SettingsScreen.js
 * PURPOSE: App settings and preferences
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import colors from '../constants/colors';

export const SettingsScreen = ({ onClose, onClearAllData, recipeCount }) => {
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
        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>6.03</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Recipes</Text>
              <Text style={styles.infoValue}>{recipeCount}</Text>
            </View>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.aboutText}>
              Bunches is your personal recipe collection app. Extract recipes from websites, create your own, organize them into cookbooks, and build grocery lists.
            </Text>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.card}>
            <Text style={styles.featureItem}>📥 Import recipes from URLs</Text>
            <Text style={styles.featureItem}>✏️ Create recipes manually</Text>
            <Text style={styles.featureItem}>📖 Organize into cookbooks</Text>
            <Text style={styles.featureItem}>🔍 Search by ingredients</Text>
            <Text style={styles.featureItem}>🛒 Build grocery lists</Text>
            <Text style={styles.featureItem}>⭐ Mark favorites</Text>
            <Text style={styles.featureItem}>📤 Share recipes & cookbooks</Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.dangerButton}
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
  bottomSpacer: {
    height: 40,
  },
});

export default SettingsScreen;

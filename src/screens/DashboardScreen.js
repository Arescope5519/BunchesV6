/**
 * FILENAME: src/screens/DashboardScreen.js
 * PURPOSE: Main dashboard with navigation tiles
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import colors from '../constants/colors';

export const DashboardScreen = ({
  onNavigate,
  recipeCount,
  groceryCount,
}) => {
  const tiles = [
    {
      id: 'recipes',
      title: 'My Recipes',
      icon: '📚',
      description: 'Browse and manage your cookbooks',
      color: colors.primary,
      badge: recipeCount,
    },
    {
      id: 'create',
      title: 'Create Recipe',
      icon: '✏️',
      description: 'Add a recipe manually',
      color: '#10b981',
    },
    {
      id: 'import',
      title: 'Import Recipe',
      icon: '📥',
      description: 'Import from URL or code',
      color: '#8b5cf6',
    },
    {
      id: 'search',
      title: 'Search Ingredients',
      icon: '🔍',
      description: 'Find recipes by ingredients',
      color: '#f59e0b',
    },
    {
      id: 'grocery',
      title: 'Grocery List',
      icon: '🛒',
      description: 'Your shopping list',
      color: '#ef4444',
      badge: groceryCount,
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: '⚙️',
      description: 'App preferences',
      color: '#6b7280',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bunches</Text>
        <Text style={styles.headerSubtitle}>Your Recipe Collection</Text>
      </View>

      {/* Navigation Tiles */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.tilesContainer}
      >
        {tiles.map((tile) => (
          <TouchableOpacity
            key={tile.id}
            style={[styles.tile, { backgroundColor: tile.color }]}
            onPress={() => onNavigate(tile.id)}
            activeOpacity={0.8}
          >
            <View style={styles.tileContent}>
              <View style={styles.tileTop}>
                <Text style={styles.tileIcon}>{tile.icon}</Text>
                {tile.badge > 0 && (
                  <View style={styles.tileBadge}>
                    <Text style={styles.tileBadgeText}>{tile.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.tileTitle}>{tile.title}</Text>
              <Text style={styles.tileDescription}>{tile.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  scrollView: {
    flex: 1,
  },
  tilesContainer: {
    padding: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  tileContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  tileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tileIcon: {
    fontSize: 48,
  },
  tileBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tileBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  tileDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
});

export default DashboardScreen;

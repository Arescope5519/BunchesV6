/**
 * FILENAME: src/components/KitchenScreen.js
 * PURPOSE: Multi-tab kitchen hub - cook schedule, eat schedule, shop list, fridge.
 *
 * Free users default to Shop tab (existing grocery list). Premium tabs
 * (Cook/Eat/Fridge) show upgrade prompt for free users.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import colors from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { GroceryList } from './GroceryList';
import CookSchedule from './CookSchedule';
import EatSchedule from './EatSchedule';
import FridgeView from './FridgeView';

const TABS = [
  { key: 'cook',   label: 'Cook',   icon: 'flame',      premium: true },
  { key: 'eat',    label: 'Eat',    icon: 'restaurant', premium: true },
  { key: 'shop',   label: 'Shop',   icon: 'cart',       premium: false },
  { key: 'fridge', label: 'Fridge', icon: 'snow',       premium: true },
];

const showPremiumPrompt = () => {
  Alert.alert(
    'Premium Feature',
    'Cook planning, meal tracking, and fridge inventory are premium features. Upgrade to plan your week and reduce food waste.',
    [
      { text: 'Not Now', style: 'cancel' },
      { text: 'Learn More', onPress: () => Alert.alert('Coming Soon', 'Subscriptions launch soon. Stay tuned!') },
    ]
  );
};

const KitchenScreen = ({
  isPremium,
  userId,
  recipes,
  onOpenRecipe,
  // Grocery list props
  groceryList,
  onToggleItem,
  onRemoveItem,
  onClearChecked,
  onClearAll,
  onAddCustomItem,
  onAddItemsToGroceryList,
}) => {
  // Free users default to Shop tab; premium users can default to Cook
  const [activeTab, setActiveTab] = useState(isPremium ? 'cook' : 'shop');

  useEffect(() => {
    // If user's premium status changes mid-session, keep them on their current tab
    if (!isPremium && activeTab !== 'shop') {
      // No-op: allow them to see the premium tabs and get prompted
    }
  }, [isPremium, activeTab]);

  const handleTabPress = (tab) => {
    if (tab.premium && !isPremium) {
      showPremiumPrompt();
      return;
    }
    setActiveTab(tab.key);
  };

  const renderTab = () => {
    if (activeTab === 'shop') {
      return (
        <GroceryList
          visible={true}
          onClose={() => {}}
          groceryList={groceryList}
          onToggleItem={onToggleItem}
          onRemoveItem={onRemoveItem}
          onClearChecked={onClearChecked}
          onClearAll={onClearAll}
          onAddCustomItem={onAddCustomItem}
          embedded={true}
        />
      );
    }

    // Premium tabs: gate by subscription
    if (!isPremium) {
      return (
        <View style={styles.premiumGate}>
          <Text style={styles.premiumIcon}>🔒</Text>
          <Text style={styles.premiumTitle}>Premium Feature</Text>
          <Text style={styles.premiumText}>
            Upgrade to unlock cook planning, meal tracking, and fridge inventory.
          </Text>
          <TouchableOpacity style={styles.premiumButton} onPress={showPremiumPrompt}>
            <Text style={styles.premiumButtonText}>Learn More</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeTab === 'cook') {
      return (
        <CookSchedule
          userId={userId}
          recipes={recipes}
          onOpenRecipe={onOpenRecipe}
          onAddItemsToGroceryList={onAddItemsToGroceryList}
        />
      );
    }
    if (activeTab === 'eat') {
      return (
        <EatSchedule
          userId={userId}
          recipes={recipes}
          onOpenRecipe={onOpenRecipe}
        />
      );
    }
    if (activeTab === 'fridge') {
      return (
        <FridgeView
          userId={userId}
          recipes={recipes}
          onOpenRecipe={onOpenRecipe}
        />
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Top tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => {
          const active = tab.key === activeTab;
          const showLock = tab.premium && !isPremium;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => handleTabPress(tab)}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={active ? '#fff' : 'rgba(255,255,255,0.6)'}
                style={{ marginBottom: 4 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {showLock && (
                  <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.8)" style={{ marginLeft: 3 }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>{renderTab()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryDark,
    height: 100,
    paddingTop: 38, // clear the status bar
  },
  tab: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accent || '#E9B44C',
  },
  tabIcon: {
    fontSize: 22,
    marginBottom: 4,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  tabContent: { flex: 1 },
  premiumGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  premiumIcon: { fontSize: 60, marginBottom: 16 },
  premiumTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 12 },
  premiumText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  premiumButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  premiumButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default KitchenScreen;

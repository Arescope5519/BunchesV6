/**
 * GroceryListView.js - Grocery List Component
 * BunchesV6 - Recipe Manager
 * 
 * Features:
 * - Display grocery list items
 * - Check off completed items
 * - Delete individual items
 * - Clear checked items
 * - Group items by recipe
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import colors from '../constants/colors';

export default function GroceryListView({
  items = [],
  onToggleItem,
  onDeleteItem,
  onClearChecked,
  onClearAll,
}) {
  const [expandedSections, setExpandedSections] = useState(new Set());

  // Group items by recipe
  const groupedItems = items.reduce((groups, item) => {
    const key = item.recipeTitle || 'Manually Added';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});

  const toggleSection = (section) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleClearChecked = () => {
    const checkedCount = items.filter(item => item.checked).length;
    if (checkedCount === 0) {
      Alert.alert('No Items', 'No checked items to clear');
      return;
    }
    
    Alert.alert(
      'Clear Checked Items',
      `Remove ${checkedCount} checked item${checkedCount > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: onClearChecked },
      ]
    );
  };

  const handleClearAll = () => {
    if (items.length === 0) {
      Alert.alert('No Items', 'Grocery list is already empty');
      return;
    }
    
    Alert.alert(
      'Clear All Items',
      `Remove all ${items.length} item${items.length > 1 ? 's' : ''} from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: onClearAll },
      ]
    );
  };

  const handleDeleteItem = (item) => {
    Alert.alert(
      'Delete Item',
      `Remove "${item.text}" from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteItem(item.id) },
      ]
    );
  };

  const uncheckedCount = items.filter(item => !item.checked).length;
  const checkedCount = items.filter(item => item.checked).length;

  if (items.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateIcon}>🛒</Text>
        <Text style={styles.emptyStateText}>Your grocery list is empty</Text>
        <Text style={styles.emptyStateSubtext}>
          Add items from your recipes or create them manually
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} to get
          {checkedCount > 0 && ` • ${checkedCount} checked`}
        </Text>
        <View style={styles.summaryActions}>
          {checkedCount > 0 && (
            <TouchableOpacity onPress={handleClearChecked} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear Checked</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleClearAll} style={styles.clearAllButton}>
            <Text style={styles.clearAllButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Grouped Items */}
      <ScrollView style={styles.itemsList}>
        {Object.entries(groupedItems).map(([recipe, recipeItems]) => {
          const isExpanded = expandedSections.has(recipe) || expandedSections.size === 0;
          const uncheckedInSection = recipeItems.filter(item => !item.checked).length;
          const checkedInSection = recipeItems.filter(item => item.checked).length;
          
          return (
            <View key={recipe} style={styles.section}>
              <TouchableOpacity
                onPress={() => toggleSection(recipe)}
                style={styles.sectionHeader}
              >
                <Text style={styles.sectionTitle}>
                  {recipe} ({uncheckedInSection}/{recipeItems.length})
                </Text>
                <Text style={styles.expandIcon}>
                  {isExpanded ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>
              
              {isExpanded && (
                <View style={styles.sectionItems}>
                  {/* Unchecked items first */}
                  {recipeItems.filter(item => !item.checked).map(item => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => onToggleItem(item.id)}
                      onLongPress={() => handleDeleteItem(item)}
                      style={styles.item}
                    >
                      <View style={styles.checkbox}>
                        <Text style={styles.checkboxEmpty}>☐</Text>
                      </View>
                      <View style={styles.itemContent}>
                        <Text style={styles.itemText}>{item.text}</Text>
                        {item.section && (
                          <Text style={styles.itemSection}>{item.section}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  {/* Checked items */}
                  {recipeItems.filter(item => item.checked).map(item => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => onToggleItem(item.id)}
                      onLongPress={() => handleDeleteItem(item)}
                      style={[styles.item, styles.itemChecked]}
                    >
                      <View style={styles.checkbox}>
                        <Text style={styles.checkboxFilled}>☑</Text>
                      </View>
                      <View style={styles.itemContent}>
                        <Text style={[styles.itemText, styles.itemTextChecked]}>
                          {item.text}
                        </Text>
                        {item.section && (
                          <Text style={[styles.itemSection, styles.itemTextChecked]}>
                            {item.section}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  summaryActions: {
    flexDirection: 'row',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  clearButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  clearAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearAllButtonText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '500',
  },
  itemsList: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.lightPrimary,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.primary,
  },
  expandIcon: {
    fontSize: 12,
    color: colors.primary,
  },
  sectionItems: {
    paddingVertical: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemChecked: {
    backgroundColor: '#f9f9f9',
  },
  checkbox: {
    marginRight: 12,
    paddingTop: 2,
  },
  checkboxEmpty: {
    fontSize: 20,
    color: colors.primary,
  },
  checkboxFilled: {
    fontSize: 20,
    color: colors.success,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 2,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  itemSection: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 20,
  },
});

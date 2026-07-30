/**
 * GroceryList Component
 * Displays and manages the grocery list
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  Keyboard,
} from 'react-native';
import { colors } from '../constants/colors';

export const GroceryList = ({ visible, onClose, groceryList, onToggleItem, onRemoveItem, onClearChecked, onClearAll, onAddCustomItem, onOpenMealPlan, embedded = false }) => {
  const [groupBy, setGroupBy] = useState('recipe'); // 'recipe' or 'flat'
  const [customItemText, setCustomItemText] = useState('');
  const inputRef = useRef(null);

  // Group items by recipe
  const groupedByRecipe = () => {
    const groups = {};
    groceryList.forEach(item => {
      const key = item.recipeTitle || 'Other';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });
    return groups;
  };

  // Separate checked and unchecked items
  const uncheckedItems = groceryList.filter(item => !item.checked);
  const checkedItems = groceryList.filter(item => item.checked);

  const handleClearChecked = () => {
    if (checkedItems.length === 0) {
      Alert.alert('No Items', 'There are no checked items to clear.');
      return;
    }
    Alert.alert(
      'Clear Checked Items',
      `Remove ${checkedItems.length} checked item${checkedItems.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: onClearChecked },
      ]
    );
  };

  const handleClearAll = () => {
    if (groceryList.length === 0) {
      Alert.alert('Empty List', 'The grocery list is already empty.');
      return;
    }
    Alert.alert(
      'Clear All Items',
      `Remove all ${groceryList.length} item${groceryList.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: onClearAll },
      ]
    );
  };

  const handleAddCustomItem = async () => {
    if (!customItemText.trim()) return;

    if (onAddCustomItem) {
      await onAddCustomItem(customItemText.trim());
      setCustomItemText('');
      Keyboard.dismiss();
    }
  };

  const renderFlatList = () => {
    return (
      <View>
        {/* Unchecked Items */}
        {uncheckedItems.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Shopping List ({uncheckedItems.length})</Text>
            {uncheckedItems.map(item => (
              <View key={item.id} style={styles.itemContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => onToggleItem(item.id)}
                >
                  <View style={[styles.checkboxInner, item.checked && styles.checkboxChecked]} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.itemContent}
                  onPress={() => onToggleItem(item.id)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.itemText}>{item.text}</Text>
                  <Text style={styles.itemRecipe}>{item.recipeTitle}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => onRemoveItem(item.id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Checked Items */}
        {checkedItems.length > 0 && (
          <View style={styles.checkedSection}>
            <Text style={styles.sectionTitle}>Completed ({checkedItems.length})</Text>
            {checkedItems.map(item => (
              <View key={item.id} style={styles.itemContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => onToggleItem(item.id)}
                >
                  <View style={[styles.checkboxInner, styles.checkboxChecked]}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.itemContent}
                  onPress={() => onToggleItem(item.id)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.itemText, styles.itemTextChecked]}>{item.text}</Text>
                  <Text style={styles.itemRecipe}>{item.recipeTitle}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => onRemoveItem(item.id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {groceryList.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Your grocery list is empty</Text>
            <Text style={styles.emptySubtext}>
              Add items from recipes to start building your list
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderGroupedList = () => {
    const groups = groupedByRecipe();
    const groupKeys = Object.keys(groups);

    if (groupKeys.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your grocery list is empty</Text>
          <Text style={styles.emptySubtext}>
            Add items from recipes to start building your list
          </Text>
        </View>
      );
    }

    return (
      <View>
        {groupKeys.map(recipeTitle => (
          <View key={recipeTitle} style={styles.recipeGroup}>
            <Text style={styles.recipeGroupTitle}>{recipeTitle}</Text>
            {groups[recipeTitle].map(item => (
              <View key={item.id} style={styles.itemContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => onToggleItem(item.id)}
                >
                  <View style={[styles.checkboxInner, item.checked && styles.checkboxChecked]}>
                    {item.checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.itemContent}
                  onPress={() => onToggleItem(item.id)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                    {item.text}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => onRemoveItem(item.id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header - hidden when embedded in KitchenScreen (which has its own header) */}
      {!embedded && (
        <View style={styles.header}>
          <Text style={styles.title}>Grocery List</Text>
          {onOpenMealPlan && (
            <TouchableOpacity
              style={{
                marginLeft: 'auto',
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
              }}
              onPress={onOpenMealPlan}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>🗓️ Meal Plan</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setGroupBy(groupBy === 'recipe' ? 'flat' : 'recipe')}
          >
            <Text style={styles.toggleButtonText}>
              {groupBy === 'recipe' ? '📋 List View' : '📚 Group by Recipe'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={handleClearChecked}>
            <Text style={styles.clearButtonText}>Clear Checked</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearAllButton} onPress={handleClearAll}>
            <Text style={styles.clearAllButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* Add Custom Item */}
        <View style={styles.addItemBar}>
          <TextInput
            ref={inputRef}
            style={styles.addItemInput}
            placeholder="Add custom item..."
            placeholderTextColor={colors.textTertiary}
            value={customItemText}
            onChangeText={setCustomItemText}
            onSubmitEditing={handleAddCustomItem}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addItemButton, !customItemText.trim() && styles.addItemButtonDisabled]}
            onPress={handleAddCustomItem}
            disabled={!customItemText.trim()}
          >
            <Text style={styles.addItemButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* List Content */}
        <ScrollView style={styles.content}>
          {groupBy === 'flat' ? renderFlatList() : renderGroupedList()}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerRight: {
    width: 60,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.warning,
    borderRadius: 8,
  },
  clearButtonText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '600',
  },
  clearAllButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.destructive,
    borderRadius: 8,
  },
  clearAllButtonText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '600',
  },
  addItemBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  addItemInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addItemButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addItemButtonDisabled: {
    backgroundColor: colors.border,
  },
  addItemButtonText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    padding: 15,
    paddingBottom: 10,
  },
  recipeGroup: {
    marginBottom: 20,
  },
  recipeGroupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  checkbox: {
    width: 28,
    height: 28,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 15,
    color: colors.text,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  itemRecipe: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  removeButtonText: {
    fontSize: 28,
    color: colors.textTertiary,
    fontWeight: '300',
  },
  checkedSection: {
    marginTop: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

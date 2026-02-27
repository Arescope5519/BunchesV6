/**
 * useGroceryList Hook
 * Manages grocery list state and operations
 *
 * Now supports user-specific grocery lists to prevent data mixing between accounts
 */

import { useState, useEffect } from 'react';
import { saveGroceryList, loadGroceryList } from '../utils/storage';

export const useGroceryList = (user) => {
  const [groceryList, setGroceryList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load grocery list on mount and when user changes
  useEffect(() => {
    // Clear grocery list immediately when user changes
    setGroceryList([]);
    loadList();
  }, [user?.uid]);

  const loadList = async () => {
    setLoading(true);
    const list = await loadGroceryList(user?.uid || null);
    setGroceryList(list);
    setLoading(false);
  };

  /**
   * Add items to grocery list
   * @param {Array} items - Array of ingredient strings
   * @param {Object} recipe - Source recipe object
   * @param {String} section - Ingredient section name
   */
  const addItems = async (items, recipe, section = 'main') => {
    const newItems = items.map(text => ({
      id: `${Date.now()}_${Math.random()}`,
      text,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      section,
      checked: false,
      addedAt: new Date().toISOString(),
    }));

    const updatedList = [...groceryList, ...newItems];
    setGroceryList(updatedList);
    await saveGroceryList(updatedList, user?.uid || null);
    return newItems.length;
  };

  /**
   * Add a custom item to grocery list (not from a recipe)
   * @param {String} text - The item text
   */
  const addCustomItem = async (text) => {
    if (!text || !text.trim()) return false;

    const newItem = {
      id: `${Date.now()}_${Math.random()}`,
      text: text.trim(),
      recipeId: null,
      recipeTitle: 'Custom',
      section: 'custom',
      checked: false,
      addedAt: new Date().toISOString(),
    };

    const updatedList = [...groceryList, newItem];
    setGroceryList(updatedList);
    await saveGroceryList(updatedList, user?.uid || null);
    return true;
  };

  /**
   * Remove item from grocery list
   */
  const removeItem = async (itemId) => {
    const updatedList = groceryList.filter(item => item.id !== itemId);
    setGroceryList(updatedList);
    await saveGroceryList(updatedList, user?.uid || null);
  };

  /**
   * Toggle item checked status
   */
  const toggleItemChecked = async (itemId) => {
    const updatedList = groceryList.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    setGroceryList(updatedList);
    await saveGroceryList(updatedList, user?.uid || null);
  };

  /**
   * Clear all checked items
   */
  const clearCheckedItems = async () => {
    const updatedList = groceryList.filter(item => !item.checked);
    setGroceryList(updatedList);
    await saveGroceryList(updatedList, user?.uid || null);
  };

  /**
   * Clear all items
   */
  const clearAllItems = async () => {
    setGroceryList([]);
    await saveGroceryList([], user?.uid || null);
  };

  /**
   * Get count of unchecked items
   */
  const getUncheckedCount = () => {
    return groceryList.filter(item => !item.checked).length;
  };

  /**
   * Get count of checked items
   */
  const getCheckedCount = () => {
    return groceryList.filter(item => item.checked).length;
  };

  /**
   * Restore grocery list to a specific state (for undo functionality)
   */
  const restoreList = async (listSnapshot) => {
    setGroceryList(listSnapshot);
    await saveGroceryList(listSnapshot, user?.uid || null);
  };

  return {
    groceryList,
    loading,
    addItems,
    addCustomItem,
    removeItem,
    toggleItemChecked,
    clearCheckedItems,
    clearAllItems,
    getUncheckedCount,
    getCheckedCount,
    refreshList: loadList,
    restoreList,
  };
};

/**
 * useGroceryList Hook
 * Manages grocery list state and operations
 */

import { useState, useEffect } from 'react';
import { saveGroceryList, loadGroceryList } from '../utils/storage';

export const useGroceryList = (user) => {
  const [groceryList, setGroceryList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load grocery list on mount and when user changes
  useEffect(() => {
    loadList();
  }, [user?.uid]);

  const loadList = async () => {
    setLoading(true);
    const list = await loadGroceryList(user?.uid);
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
    await saveGroceryList(updatedList, user?.uid);
    return newItems.length;
  };

  /**
   * Remove item from grocery list
   */
  const removeItem = async (itemId) => {
    const updatedList = groceryList.filter(item => item.id !== itemId);
    setGroceryList(updatedList);
    await saveGroceryList(updatedList, user?.uid);
  };

  /**
   * Toggle item checked status
   */
  const toggleItemChecked = async (itemId) => {
    const updatedList = groceryList.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    setGroceryList(updatedList);
    await saveGroceryList(updatedList, user?.uid);
  };

  /**
   * Clear all checked items
   */
  const clearCheckedItems = async () => {
    const updatedList = groceryList.filter(item => !item.checked);
    setGroceryList(updatedList);
    await saveGroceryList(updatedList, user?.uid);
  };

  /**
   * Clear all items
   */
  const clearAllItems = async () => {
    setGroceryList([]);
    await saveGroceryList([], user?.uid);
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
    await saveGroceryList(listSnapshot, user?.uid);
  };

  return {
    groceryList,
    loading,
    addItems,
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

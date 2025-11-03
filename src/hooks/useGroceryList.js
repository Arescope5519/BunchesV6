/**
 * useGroceryList Hook
 * Manages grocery list state and operations
 */

import { useState, useEffect } from 'react';
import { saveGroceryList, loadGroceryList } from '../utils/storage';

export const useGroceryList = () => {
  const [groceryList, setGroceryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [undoHistory, setUndoHistory] = useState([]);
  const [showUndoButton, setShowUndoButton] = useState(false);

  // Load grocery list on mount
  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    setLoading(true);
    const list = await loadGroceryList();
    setGroceryList(list);
    setLoading(false);
  };

  /**
   * Save current state to undo history
   */
  const saveToHistory = () => {
    const snapshot = JSON.parse(JSON.stringify(groceryList));
    setUndoHistory(prev => [...prev, snapshot]);
    setShowUndoButton(true);

    // Auto-hide undo button after 10 seconds
    setTimeout(() => {
      setShowUndoButton(false);
    }, 10000);
  };

  /**
   * Undo last change
   */
  const undoLastChange = async () => {
    if (undoHistory.length === 0) return;

    const previousState = undoHistory[undoHistory.length - 1];
    setGroceryList(previousState);
    await saveGroceryList(previousState);

    // Remove the last item from history
    setUndoHistory(prev => prev.slice(0, -1));

    // Hide undo button if no more history
    if (undoHistory.length <= 1) {
      setShowUndoButton(false);
    }
  };

  /**
   * Add items to grocery list
   * @param {Array} items - Array of ingredient strings
   * @param {Object} recipe - Source recipe object
   * @param {String} section - Ingredient section name
   */
  const addItems = async (items, recipe, section = 'main') => {
    // Save to undo history before adding
    saveToHistory();

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
    await saveGroceryList(updatedList);
    return newItems.length;
  };

  /**
   * Remove item from grocery list
   */
  const removeItem = async (itemId) => {
    // Save to undo history before removing
    saveToHistory();

    const updatedList = groceryList.filter(item => item.id !== itemId);
    setGroceryList(updatedList);
    await saveGroceryList(updatedList);
  };

  /**
   * Toggle item checked status
   */
  const toggleItemChecked = async (itemId) => {
    // Save to undo history before toggling
    saveToHistory();

    const updatedList = groceryList.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    setGroceryList(updatedList);
    await saveGroceryList(updatedList);
  };

  /**
   * Clear all checked items
   */
  const clearCheckedItems = async () => {
    // Save to undo history before clearing
    saveToHistory();

    const updatedList = groceryList.filter(item => !item.checked);
    setGroceryList(updatedList);
    await saveGroceryList(updatedList);
  };

  /**
   * Clear all items
   */
  const clearAllItems = async () => {
    // Save to undo history before clearing all
    saveToHistory();

    setGroceryList([]);
    await saveGroceryList([]);
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
    undoLastChange,
    showUndoButton,
    canUndo: undoHistory.length > 0,
  };
};

/**
 * useGroceryList.js - Grocery List Management Hook
 * BunchesV6 - Recipe Manager
 * 
 * Features:
 * - Add items to grocery list
 * - Toggle item completion
 * - Delete items
 * - Clear checked/all items
 * - Persist to AsyncStorage
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@BunchesV6:groceryList';

// Simple ID generator that doesn't require external packages
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomNum = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${randomNum}`;
};

export function useGroceryList() {
  const [groceryItems, setGroceryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load grocery list from storage
  useEffect(() => {
    loadGroceryList();
  }, []);

  const loadGroceryList = async () => {
    try {
      setLoading(true);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored);
        setGroceryItems(items);
      }
    } catch (error) {
      console.error('Error loading grocery list:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveGroceryList = async (items) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setGroceryItems(items);
      return true;
    } catch (error) {
      console.error('Error saving grocery list:', error);
      return false;
    }
  };

  const addGroceryItems = async (newItems) => {
    const itemsToAdd = newItems.map(item => ({
      id: generateId(),
      text: item.text || item,
      recipeTitle: item.recipeTitle || null,
      section: item.section || null,
      checked: false,
      addedAt: new Date().toISOString(),
    }));

    const updatedList = [...groceryItems, ...itemsToAdd];
    return await saveGroceryList(updatedList);
  };

  const toggleGroceryItem = async (itemId) => {
    const updatedList = groceryItems.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    return await saveGroceryList(updatedList);
  };

  const deleteGroceryItem = async (itemId) => {
    const updatedList = groceryItems.filter(item => item.id !== itemId);
    return await saveGroceryList(updatedList);
  };

  const clearCheckedItems = async () => {
    const updatedList = groceryItems.filter(item => !item.checked);
    return await saveGroceryList(updatedList);
  };

  const clearAllItems = async () => {
    return await saveGroceryList([]);
  };

  const updateGroceryItem = async (itemId, updates) => {
    const updatedList = groceryItems.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    return await saveGroceryList(updatedList);
  };

  return {
    groceryItems,
    loading,
    addGroceryItems,
    toggleGroceryItem,
    deleteGroceryItem,
    clearCheckedItems,
    clearAllItems,
    updateGroceryItem,
    reloadGroceryList: loadGroceryList,
  };
}

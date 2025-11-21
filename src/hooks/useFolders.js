/**
 * useFolders Hook
 * Manages folder state and operations
 * Extracted from your App.js
 */

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { saveFolders as saveFoldersToStorage, loadFolders as loadFoldersFromStorage } from '../utils/storage';

export const useFolders = (user) => {
  const [folders, setFolders] = useState(['All Recipes', 'Favorites', 'Recently Deleted']);
  const [currentFolder, setCurrentFolder] = useState('All Recipes');

  /**
   * Load folders from storage
   */
  const loadFolders = async () => {
    const loaded = await loadFoldersFromStorage(user?.uid);
    setFolders(loaded);
  };

  /**
   * Add new folder
   */
  const addFolder = async (folderName) => {
    if (!folderName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return false;
    }

    if (folders.includes(folderName.trim())) {
      Alert.alert('Error', 'A folder with this name already exists');
      return false;
    }

    const newFolders = [...folders, folderName.trim()];
    const success = await saveFoldersToStorage(newFolders, user?.uid);

    if (success) {
      setFolders(newFolders);
      Alert.alert('Success', `Folder "${folderName.trim()}" created!`);
      return true;
    }
    return false;
  };

  /**
   * Rename folder
   */
  const renameFolder = async (oldName, newName) => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return { success: false };
    }

    if (folders.includes(newName.trim()) && newName.trim() !== oldName) {
      Alert.alert('Error', 'A folder with this name already exists');
      return { success: false };
    }

    // Update folders list
    const updatedFolders = folders.map(f => f === oldName ? newName.trim() : f);
    const success = await saveFoldersToStorage(updatedFolders, user?.uid);

    if (success) {
      setFolders(updatedFolders);
      Alert.alert('Success', `Folder renamed to "${newName.trim()}"`);
      return { success: true, oldName, newName: newName.trim() };
    }
    return { success: false };
  };

  /**
   * Delete folder
   */
  const deleteFolder = async (folderName, recipeCount) => {
    return new Promise((resolve) => {
      Alert.alert(
        'Delete Folder?',
        `This will delete "${folderName}" and move ${recipeCount} recipe(s) to "All Recipes". Continue?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              // Remove folder
              const updatedFolders = folders.filter(f => f !== folderName);
              const success = await saveFoldersToStorage(updatedFolders, user?.uid);

              if (success) {
                setFolders(updatedFolders);
                Alert.alert('Deleted', `Folder "${folderName}" deleted`);
                resolve(true);
              } else {
                resolve(false);
              }
            }
          }
        ]
      );
    });
  };

  /**
   * Get custom folders (excluding default ones)
   */
  const getCustomFolders = () => {
    return folders.filter(f => f !== 'All Recipes' && f !== 'Favorites' && f !== 'Recently Deleted');
  };

  // Load folders on mount and when user changes
  useEffect(() => {
    loadFolders();
  }, [user?.uid]);

  return {
    folders,
    currentFolder,
    setCurrentFolder,
    addFolder,
    renameFolder,
    deleteFolder,
    getCustomFolders,
  };
};

export default useFolders;
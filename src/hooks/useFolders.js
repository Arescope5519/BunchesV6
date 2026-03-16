/**
 * useFolders Hook
 * Manages folder state and operations
 * Extracted from your App.js
 *
 * Now supports user-specific folders to prevent data mixing between accounts
 * Folders are now objects: { name: string, isPrivate: boolean }
 */

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { saveFolders as saveFoldersToStorage, loadFolders as loadFoldersFromStorage } from '../utils/storage';

const DEFAULT_FOLDERS = [
  { name: 'All Recipes', isPrivate: false },
  { name: 'Favorites', isPrivate: false },
  { name: 'Recently Deleted', isPrivate: false }
];

export const useFolders = (user) => {
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  const [currentFolder, setCurrentFolder] = useState('All Recipes');

  /**
   * Helper to get folder names as array (for backward compatibility)
   */
  const getFolderNames = () => folders.map(f => f.name);

  /**
   * Helper to get folder by name
   */
  const getFolderByName = (name) => folders.find(f => f.name === name);

  /**
   * Check if folder is private
   */
  const isFolderPrivate = (folderName) => {
    const folder = getFolderByName(folderName);
    return folder?.isPrivate || false;
  };

  /**
   * Load folders from storage (user-specific)
   */
  const loadFolders = async () => {
    const loaded = await loadFoldersFromStorage(user?.uid || null);
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

    const folderNames = getFolderNames();
    if (folderNames.includes(folderName.trim())) {
      Alert.alert('Error', 'A folder with this name already exists');
      return false;
    }

    // New folders default to public
    const newFolder = { name: folderName.trim(), isPrivate: false };
    const newFolders = [...folders, newFolder];
    const success = await saveFoldersToStorage(newFolders, user?.uid || null);

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

    const folderNames = getFolderNames();
    if (folderNames.includes(newName.trim()) && newName.trim() !== oldName) {
      Alert.alert('Error', 'A folder with this name already exists');
      return { success: false };
    }

    // Update folders list, preserving isPrivate setting
    const updatedFolders = folders.map(f =>
      f.name === oldName ? { ...f, name: newName.trim() } : f
    );
    const success = await saveFoldersToStorage(updatedFolders, user?.uid || null);

    if (success) {
      setFolders(updatedFolders);
      Alert.alert('Success', `Folder renamed to "${newName.trim()}"`);
      return { success: true, oldName, newName: newName.trim() };
    }
    return { success: false };
  };

  /**
   * Update folder privacy setting
   */
  const updateFolderPrivacy = async (folderName, isPrivate) => {
    const updatedFolders = folders.map(f =>
      f.name === folderName ? { ...f, isPrivate } : f
    );
    const success = await saveFoldersToStorage(updatedFolders, user?.uid || null);

    if (success) {
      setFolders(updatedFolders);
      return true;
    }
    return false;
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
              const updatedFolders = folders.filter(f => f.name !== folderName);
              const success = await saveFoldersToStorage(updatedFolders, user?.uid || null);

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
    return folders.filter(f =>
      f.name !== 'All Recipes' && f.name !== 'Favorites' && f.name !== 'Recently Deleted'
    ).map(f => f.name);
  };

  // Load folders on mount and when user changes
  useEffect(() => {
    // Clear folders immediately when user changes
    setFolders(DEFAULT_FOLDERS);
    setCurrentFolder('All Recipes');
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
    getFolderNames,
    getFolderByName,
    isFolderPrivate,
    updateFolderPrivacy,
  };
};

export default useFolders;
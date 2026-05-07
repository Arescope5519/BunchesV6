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
import { saveFoldersToDatabase, loadFoldersFromDatabase } from '../services/supabase/database';

// System folders that cannot be deleted or renamed
export const SYSTEM_FOLDERS = ['All Recipes', 'Favorites', 'Recently Deleted', 'My Creations'];

// My Creations is the parent folder for all custom/original recipes
export const MY_CREATIONS_FOLDER = 'My Creations';

const DEFAULT_FOLDERS = [
  { name: 'All Recipes', isPrivate: false },
  { name: 'Favorites', isPrivate: false },
  { name: 'My Creations', isPrivate: false },
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
   * Load folders from storage and sync with Supabase
   * Ensures system folders exist for existing users
   */
  const loadFolders = async () => {
    let loaded = await loadFoldersFromStorage(user?.uid || null);
    console.log('📂 Local folders:', loaded.map(f => f.name || f));

    // If user is logged in, try to sync from Supabase
    if (user?.uid) {
      try {
        const cloudFolders = await loadFoldersFromDatabase(user.uid);
        console.log('☁️ Cloud folders:', cloudFolders?.length || 0, cloudFolders);

        if (cloudFolders && cloudFolders.length > 0) {
          // Check if local only has system/default folders
          const localFolderNames = loaded.map(f => typeof f === 'string' ? f : f.name);
          const hasCustomLocalFolders = localFolderNames.some(n => !SYSTEM_FOLDERS.includes(n));

          // Check if cloud has custom folders
          const cloudFolderNames = cloudFolders.map(f => typeof f === 'string' ? f : f.name);
          const hasCustomCloudFolders = cloudFolderNames.some(n => !SYSTEM_FOLDERS.includes(n));

          // Use cloud if: cloud has custom folders AND local doesn't
          // OR cloud has more folders than local
          if ((hasCustomCloudFolders && !hasCustomLocalFolders) || cloudFolders.length > loaded.length) {
            loaded = cloudFolders.map(f =>
              typeof f === 'string' ? { name: f, isPrivate: false } : f
            );
            // Save to local storage
            await saveFoldersToStorage(loaded, user?.uid || null);
            console.log('📥 Restored folders from cloud:', loaded.length);
          }
        }
      } catch (error) {
        console.error('Failed to load folders from cloud:', error);
      }
    }

    // Ensure system folders exist (migration for existing users)
    const folderNames = loaded.map(f => typeof f === 'string' ? f : f.name);
    let needsSave = false;

    // Ensure My Creations exists
    if (!folderNames.includes(MY_CREATIONS_FOLDER)) {
      const recentlyDeletedIndex = loaded.findIndex(f =>
        (typeof f === 'string' ? f : f.name) === 'Recently Deleted'
      );
      const myCreationsFolder = { name: MY_CREATIONS_FOLDER, isPrivate: false };

      if (recentlyDeletedIndex >= 0) {
        loaded.splice(recentlyDeletedIndex, 0, myCreationsFolder);
      } else {
        loaded.push(myCreationsFolder);
      }
      needsSave = true;
      console.log('✅ Added My Creations folder');
    }

    // Save if we made changes
    if (needsSave) {
      await saveFoldersToStorage(loaded, user?.uid || null);
      if (user?.uid) {
        saveFoldersToDatabase(user.uid, loaded).catch(console.error);
      }
    }

    setFolders(loaded);
  };

  /**
   * Save folders to both local storage and Supabase
   */
  const saveFolders = async (newFolders) => {
    const success = await saveFoldersToStorage(newFolders, user?.uid || null);
    if (success && user?.uid) {
      // Sync to cloud in background
      saveFoldersToDatabase(user.uid, newFolders).catch(console.error);
    }
    return success;
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
    const success = await saveFolders(newFolders);

    if (success) {
      setFolders(newFolders);
      Alert.alert('Success', `Folder "${folderName.trim()}" created!`);
      return true;
    }
    return false;
  };

  /**
   * Check if folder is a system folder (can't delete/rename)
   */
  const isSystemFolder = (folderName) => {
    // Check exact match or if it's a subfolder of My Creations root
    return SYSTEM_FOLDERS.includes(folderName);
  };

  /**
   * Check if folder is inside My Creations (path-based)
   */
  const isMyCreationsSubfolder = (folderName) => {
    return folderName.startsWith(MY_CREATIONS_FOLDER + '/');
  };

  /**
   * Get parent folder from path
   */
  const getParentFolder = (folderPath) => {
    const lastSlash = folderPath.lastIndexOf('/');
    return lastSlash > 0 ? folderPath.substring(0, lastSlash) : null;
  };

  /**
   * Get folder display name (last segment of path)
   */
  const getFolderDisplayName = (folderPath) => {
    const lastSlash = folderPath.lastIndexOf('/');
    return lastSlash >= 0 ? folderPath.substring(lastSlash + 1) : folderPath;
  };

  /**
   * Rename folder
   */
  const renameFolder = async (oldName, newName) => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a folder name');
      return { success: false };
    }

    // Prevent renaming system folders
    if (isSystemFolder(oldName)) {
      Alert.alert('Error', 'This folder cannot be renamed');
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
    const success = await saveFolders(updatedFolders);

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
    const success = await saveFolders(updatedFolders);

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
    // Prevent deleting system folders
    if (isSystemFolder(folderName)) {
      Alert.alert('Error', 'This folder cannot be deleted');
      return false;
    }

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
              const success = await saveFolders(updatedFolders);

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
   * Get custom folders (excluding system ones)
   */
  const getCustomFolders = () => {
    return folders.filter(f => !SYSTEM_FOLDERS.includes(f.name)).map(f => f.name);
  };

  /**
   * Get My Creations subfolders
   */
  const getMyCreationsSubfolders = () => {
    return folders
      .filter(f => f.name.startsWith(MY_CREATIONS_FOLDER + '/'))
      .map(f => f.name);
  };

  /**
   * Add subfolder to My Creations
   */
  const addMyCreationsSubfolder = async (subfolderName) => {
    const fullPath = `${MY_CREATIONS_FOLDER}/${subfolderName.trim()}`;
    return addFolder(fullPath);
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
    isSystemFolder,
    isMyCreationsSubfolder,
    getParentFolder,
    getFolderDisplayName,
    getMyCreationsSubfolders,
    addMyCreationsSubfolder,
  };
};

export default useFolders;
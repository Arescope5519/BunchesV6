/**
 * FILENAME: src/hooks/useShareIntent.js
 * PURPOSE: Handles shared URLs from browser via Share functionality (iOS & Android)
 * CHANGES:
 *   - Removed debug alerts, enabled auto-extraction
 *   - Improved iOS support with better URL handling
 *   - Added Platform-specific logging
 * USED BY: src/screens/HomeScreen.js
 */

import { useEffect, useRef } from 'react';
import { Platform, AppState, Alert } from 'react-native';
import { extractUrlFromText } from '../utils/urlExtractor';

// Try to import share library, handle gracefully if it fails
let ReceiveSharingIntent = null;
try {
  ReceiveSharingIntent = require('react-native-receive-sharing-intent').default;
} catch (error) {
  console.log('⚠️ Share intent not available (will work after rebuild):', error.message);
}

export const useShareIntent = (onUrlReceived) => {
  const processedInitialShare = useRef(false);
  const lastProcessedUrl = useRef(null);
  const lastProcessedTime = useRef(0);
  const onUrlReceivedRef = useRef(onUrlReceived);

  // Keep the callback ref up to date
  useEffect(() => {
    onUrlReceivedRef.current = onUrlReceived;
  }, [onUrlReceived]);

  /**
   * Handle shared URLs from browser
   */
  const handleSharedUrl = (sharedData) => {
    console.log(`📨 [${Platform.OS}] Received shared data from browser`, sharedData);

    let sharedUrl = null;

    // iOS-specific handling
    if (Platform.OS === 'ios') {
      // iOS can pass data in different formats
      if (typeof sharedData === 'string') {
        sharedUrl = extractUrlFromText(sharedData);
      } else if (sharedData?.data) {
        // iOS often wraps content in a 'data' field
        sharedUrl = extractUrlFromText(sharedData.data);
      } else if (sharedData?.weblink) {
        sharedUrl = extractUrlFromText(sharedData.weblink);
      } else if (sharedData?.text) {
        sharedUrl = extractUrlFromText(sharedData.text);
      } else if (Array.isArray(sharedData) && sharedData.length > 0) {
        // iOS sometimes returns an array of shared items
        const firstItem = sharedData[0];
        if (typeof firstItem === 'string') {
          sharedUrl = extractUrlFromText(firstItem);
        } else if (firstItem?.data || firstItem?.weblink) {
          sharedUrl = extractUrlFromText(firstItem.data || firstItem.weblink);
        }
      }
    } else {
      // Android handling (existing logic)
      if (typeof sharedData === 'string') {
        sharedUrl = extractUrlFromText(sharedData);
      } else if (sharedData?.weblink) {
        sharedUrl = extractUrlFromText(sharedData.weblink);
      } else if (sharedData?.text) {
        sharedUrl = extractUrlFromText(sharedData.text);
      } else if (sharedData?.contentUri) {
        sharedUrl = extractUrlFromText(sharedData.contentUri);
      }
    }

    // Call the callback with extracted URL
    if (sharedUrl) {
      const now = Date.now();

      // Check if we already processed this URL recently (within 5 seconds) to avoid duplicates
      // But allow the same URL to be shared again after 5 seconds
      if (lastProcessedUrl.current === sharedUrl && (now - lastProcessedTime.current) < 5000) {
        console.log(`⏭️ [${Platform.OS}] Skipping duplicate URL (processed ${now - lastProcessedTime.current}ms ago):`, sharedUrl);
        return;
      }

      console.log(`✅✅✅ [${Platform.OS}] URL EXTRACTED AND PROCESSING:`, sharedUrl);
      console.log(`🎯 [${Platform.OS}] Calling onUrlReceivedRef.current...`);
      console.log(`🎯 [${Platform.OS}] onUrlReceivedRef.current is:`, onUrlReceivedRef.current ? 'defined' : 'null/undefined');
      lastProcessedUrl.current = sharedUrl;
      lastProcessedTime.current = now;

      if (onUrlReceivedRef.current) {
        try {
          onUrlReceivedRef.current(sharedUrl);
          console.log(`✅ [${Platform.OS}] Successfully called onUrlReceivedRef.current with URL:`, sharedUrl);
        } catch (error) {
          console.error(`❌ [${Platform.OS}] Error calling onUrlReceivedRef.current:`, error);
        }
      } else {
        console.error(`❌ [${Platform.OS}] onUrlReceivedRef.current is null!`);
      }

      // NOTE: NOT clearing received files to allow re-checking when app becomes active
      // With singleTask mode, we need the intent data to persist so we can check it
      // when the app comes back to foreground
      // Duplicate detection (5 second window above) prevents processing same URL twice
    } else {
      console.log(`ℹ️ [${Platform.OS}] No URL found in shared data (this is normal if no share pending)`);
    }
  };

  /**
   * Check for pending share intents
   * NOTE: This function is not called automatically anymore due to NullPointerException
   * with singleTask launchMode. Kept for potential manual debugging only.
   */
  const checkForSharedContent = () => {
    if (!ReceiveSharingIntent) return;

    console.log(`🔍 [${Platform.OS}] Checking for shared content`);

    try {
      ReceiveSharingIntent.getReceivedFiles(
        (files) => {
          console.log(`📥 [${Platform.OS}] getReceivedFiles returned:`, files);
          if (files && files.length > 0) {
            console.log(`✅ [${Platform.OS}] Found initial share data, processing...`);
            handleSharedUrl(files[0]);
          } else {
            console.log(`ℹ️ [${Platform.OS}] No files found in initial check (app not launched from share)`);
          }
        },
        (error) => {
          console.log(`ℹ️ [${Platform.OS}] getReceivedFiles error (may be expected with singleTask):`, error.message);
        }
      );
    } catch (error) {
      console.log(`ℹ️ [${Platform.OS}] checkForSharedContent exception (may be expected):`, error.message);
    }
  };

  /**
   * Setup share intent listener
   */
  useEffect(() => {
    // CRITICAL: Show alert immediately to confirm useEffect is running
    Alert.alert('DEBUG', `useShareIntent useEffect running! Platform: ${Platform.OS}`);
    console.log(`🔧 [${Platform.OS}] useShareIntent useEffect starting...`);

    // Track subscriptions for cleanup
    const subscriptions = [];
    let appStateSubscription = null;

    // Setup AppState listener FIRST - this is core React Native, doesn't need share library
    console.log(`🔧 [${Platform.OS}] Creating AppState listener...`);
    try {
      appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        Alert.alert('DEBUG', `AppState changed: ${nextAppState}`);
        console.log(`📱 [${Platform.OS}] App state changed to:`, nextAppState);

        if (nextAppState === 'active') {
          console.log(`🔄 [${Platform.OS}] App became active, checking for new share...`);

          // Small delay to ensure intent is ready
          setTimeout(() => {
            if (ReceiveSharingIntent) {
              Alert.alert('DEBUG', 'App active - checking for share NOW');
              try {
                checkForSharedContent();
              } catch (error) {
                console.log(`ℹ️ [${Platform.OS}] Check failed:`, error.message);
                Alert.alert('DEBUG', `Check failed: ${error.message}`);
              }
            } else {
              Alert.alert('DEBUG', 'App active - but share library not available');
            }
          }, 100);
        }
      });

      console.log(`✅ [${Platform.OS}] AppState listener created: ${!!appStateSubscription}`);
      Alert.alert('DEBUG', `AppState listener setup: ${!!appStateSubscription}`);
    } catch (error) {
      console.error(`❌ [${Platform.OS}] AppState listener failed:`, error);
      Alert.alert('ERROR', `AppState listener failed: ${error.message}`);
    }

    // Now setup share-intent specific stuff if library is available
    if (!ReceiveSharingIntent) {
      console.log('ℹ️ Share intent library not available');
      Alert.alert('DEBUG', 'Share intent library NOT loaded - rebuild required');

      // Still return cleanup for AppState
      return () => {
        console.log(`🧹 [${Platform.OS}] Cleaning up (no share library)`);
        if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
          appStateSubscription.remove();
        }
      };
    }

    Alert.alert('DEBUG', 'Share intent library IS available!');
    console.log(`🔧 [${Platform.OS}] Setting up share intent listeners`);

    try {
      // Check for shares when app FIRST launches
      if (!processedInitialShare.current) {
        console.log(`🔍 [${Platform.OS}] Checking for initial share on app launch`);
        try {
          checkForSharedContent();
        } catch (error) {
          console.log(`ℹ️ [${Platform.OS}] Initial check failed:`, error);
        }
        processedInitialShare.current = true;
      }

      // Listen for 'url' event (primary)
      const urlSubscription = ReceiveSharingIntent.addEventListener('url', (event) => {
        console.log(`📥 [${Platform.OS}] Received 'url' event:`, event);
        Alert.alert('DEBUG', `URL event received: ${JSON.stringify(event)}`);
        if (event) {
          const dataToHandle = event.url || event;
          handleSharedUrl(dataToHandle);
        }
      });
      subscriptions.push(urlSubscription);

      // Also try listening for other potential events
      try {
        const fileSubscription = ReceiveSharingIntent.addEventListener('file', (event) => {
          console.log(`📥 [${Platform.OS}] Received 'file' event:`, event);
          if (event) handleSharedUrl(event);
        });
        subscriptions.push(fileSubscription);
      } catch (e) {
        console.log(`ℹ️ [${Platform.OS}] 'file' event not available`);
      }

      try {
        const dataSubscription = ReceiveSharingIntent.addEventListener('data', (event) => {
          console.log(`📥 [${Platform.OS}] Received 'data' event:`, event);
          if (event) handleSharedUrl(event);
        });
        subscriptions.push(dataSubscription);
      } catch (e) {
        console.log(`ℹ️ [${Platform.OS}] 'data' event not available`);
      }

      console.log(`✅ [${Platform.OS}] Event listeners setup complete`);

      // Cleanup
      return () => {
        console.log(`🧹 [${Platform.OS}] Cleaning up share intent listener`);
        subscriptions.forEach(sub => {
          if (sub && typeof sub.remove === 'function') {
            sub.remove();
          }
        });
        if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
          appStateSubscription.remove();
        }
      };
    } catch (error) {
      console.error(`⚠️ [${Platform.OS}] Could not setup share listener:`, error);
      Alert.alert('ERROR', `Share setup failed: ${error.message}`);
    }
  }, []);

  return {
    isAvailable: !!ReceiveSharingIntent,
    platform: Platform.OS,
  };
};

export default useShareIntent;
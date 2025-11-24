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
import { Platform, AppState } from 'react-native';
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
      lastProcessedUrl.current = sharedUrl;
      lastProcessedTime.current = now;

      if (onUrlReceivedRef.current) {
        onUrlReceivedRef.current(sharedUrl);
        console.log(`✅ [${Platform.OS}] Successfully called onUrlReceivedRef.current`);
      } else {
        console.error(`❌ [${Platform.OS}] onUrlReceivedRef.current is null!`);
      }

      // Clear the received files after processing
      if (ReceiveSharingIntent) {
        ReceiveSharingIntent.clearReceivedFiles();
        console.log(`🧹 [${Platform.OS}] Cleared received files`);
      }
    } else {
      console.log(`ℹ️ [${Platform.OS}] No URL found in shared data (this is normal if no share pending)`);
    }
  };

  /**
   * Check for pending share intents
   */
  const checkForSharedContent = () => {
    if (!ReceiveSharingIntent) return;

    console.log(`🔍 [${Platform.OS}] Checking for shared content`);
    ReceiveSharingIntent.getReceivedFiles(
      (files) => {
        console.log(`📥 [${Platform.OS}] Received files:`, files);
        if (files && files.length > 0) {
          handleSharedUrl(files[0]);
        }
      },
      (error) => {
        console.error(`❌ [${Platform.OS}] Error getting received files:`, error);
      }
    );
  };

  /**
   * Setup share intent listener
   */
  useEffect(() => {
    if (!ReceiveSharingIntent) {
      console.log('ℹ️ Share intent not available in this environment');
      return;
    }

    console.log(`🔧 [${Platform.OS}] Setting up share intent listener`);

    try {
      // Check for shares when app starts
      if (!processedInitialShare.current) {
        checkForSharedContent();
        processedInitialShare.current = true;
      }

      // Handle shares when app is already open - listen to multiple event types
      console.log(`🎧 [${Platform.OS}] Setting up event listeners...`);

      const subscriptions = [];

      // Listen for 'url' event (primary)
      const urlSubscription = ReceiveSharingIntent.addEventListener('url', (event) => {
        console.log(`📥 [${Platform.OS}] Received 'url' event:`, event);
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
          if (event) {
            handleSharedUrl(event);
          }
        });
        subscriptions.push(fileSubscription);
      } catch (e) {
        console.log(`ℹ️ [${Platform.OS}] 'file' event not available`);
      }

      try {
        const dataSubscription = ReceiveSharingIntent.addEventListener('data', (event) => {
          console.log(`📥 [${Platform.OS}] Received 'data' event:`, event);
          if (event) {
            handleSharedUrl(event);
          }
        });
        subscriptions.push(dataSubscription);
      } catch (e) {
        console.log(`ℹ️ [${Platform.OS}] 'data' event not available`);
      }

      // Listen for app state changes to check for new shares when app comes to foreground
      const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        console.log(`📱 [${Platform.OS}] App state changed to:`, nextAppState);
        if (nextAppState === 'active') {
          // When app becomes active, check for new shares VERY aggressively
          console.log(`🔄 [${Platform.OS}] App became active, checking for new shares AGGRESSIVELY`);

          // Check multiple times with increasing delays to catch the share whenever it becomes available
          // Some devices need longer delays before share data is ready
          checkForSharedContent(); // Immediately

          setTimeout(() => checkForSharedContent(), 50);    // 50ms
          setTimeout(() => checkForSharedContent(), 100);   // 100ms
          setTimeout(() => checkForSharedContent(), 200);   // 200ms
          setTimeout(() => checkForSharedContent(), 500);   // 500ms
          setTimeout(() => checkForSharedContent(), 750);   // 750ms
          setTimeout(() => checkForSharedContent(), 1000);  // 1s
          setTimeout(() => checkForSharedContent(), 1500);  // 1.5s
          setTimeout(() => checkForSharedContent(), 2000);  // 2s
          setTimeout(() => checkForSharedContent(), 3000);  // 3s - final check
        }
      });

      // ADDITIONAL: Set up polling to catch shares that might be missed
      // This is a fallback for when the app is already open and event listeners don't fire
      // Poll frequently (every 1 second) when app is active for maximum responsiveness
      const pollInterval = setInterval(() => {
        // Only poll when app is in foreground
        if (AppState.currentState === 'active') {
          checkForSharedContent();
        }
      }, 1000); // Check every 1 second

      // Cleanup
      return () => {
        console.log(`🧹 [${Platform.OS}] Cleaning up share intent listener`);
        // Remove all event subscriptions
        subscriptions.forEach(sub => {
          if (sub && typeof sub.remove === 'function') {
            sub.remove();
          }
        });
        if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
          appStateSubscription.remove();
        }
        clearInterval(pollInterval);
      };
    } catch (error) {
      console.error(`⚠️ [${Platform.OS}] Could not setup share listener:`, error);
    }
  }, []);

  return {
    isAvailable: !!ReceiveSharingIntent,
    platform: Platform.OS,
  };
};

export default useShareIntent;
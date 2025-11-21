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
      // Check if we already processed this URL to avoid duplicates
      if (lastProcessedUrl.current === sharedUrl) {
        console.log(`⏭️ [${Platform.OS}] Skipping duplicate URL:`, sharedUrl);
        return;
      }

      console.log(`✅ [${Platform.OS}] URL extracted:`, sharedUrl);
      lastProcessedUrl.current = sharedUrl;

      if (onUrlReceived) {
        onUrlReceived(sharedUrl);
      }

      // Clear the received files after processing
      if (ReceiveSharingIntent) {
        ReceiveSharingIntent.clearReceivedFiles();
      }
    } else {
      console.error(`❌ [${Platform.OS}] Could not extract URL from shared data:`, sharedData);
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

      // Handle shares when app is already open
      // iOS uses 'url' event, Android can use both 'url' and other events
      const eventType = Platform.OS === 'ios' ? 'url' : 'url';
      const subscription = ReceiveSharingIntent.addEventListener(eventType, (event) => {
        console.log(`📥 [${Platform.OS}] Received event while app open:`, event);
        if (event) {
          // iOS might pass event.url or just the url directly
          const dataToHandle = event.url || event;
          handleSharedUrl(dataToHandle);
        }
      });

      // Listen for app state changes to check for new shares when app comes to foreground
      const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        console.log(`📱 [${Platform.OS}] App state changed to:`, nextAppState);
        if (nextAppState === 'active') {
          // When app becomes active, check for new shares
          console.log(`🔄 [${Platform.OS}] App became active, checking for new shares`);
          checkForSharedContent();
        }
      });

      // Cleanup
      return () => {
        console.log(`🧹 [${Platform.OS}] Cleaning up share intent listener`);
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
        if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
          appStateSubscription.remove();
        }
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
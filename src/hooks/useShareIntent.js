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
import { Platform, AppState, DeviceEventEmitter, Alert } from 'react-native';
import { extractUrlFromText } from '../utils/urlExtractor';

// DEBUG MODE - set to true to see alerts
const DEBUG_SHARE = true;

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
      // Check if we already processed this URL to avoid duplicates
      if (lastProcessedUrl.current === sharedUrl) {
        console.log(`⏭️ [${Platform.OS}] Skipping duplicate URL:`, sharedUrl);
        return;
      }

      console.log(`✅ [${Platform.OS}] URL extracted:`, sharedUrl);
      lastProcessedUrl.current = sharedUrl;

      // Use the ref to get the latest callback
      if (onUrlReceivedRef.current) {
        onUrlReceivedRef.current(sharedUrl);
      }

      // Don't call clearReceivedFiles() - it can interfere with detecting new shares
      // We use lastProcessedUrl to prevent duplicate processing instead
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
        if (DEBUG_SHARE) {
          Alert.alert('DEBUG: getReceivedFiles', `Files count: ${files?.length || 0}\nFirst file: ${JSON.stringify(files?.[0])?.substring(0, 100) || 'none'}`);
        }
        if (files && files.length > 0) {
          handleSharedUrl(files[0]);
        }
      },
      (error) => {
        console.error(`❌ [${Platform.OS}] Error getting received files:`, error);
        if (DEBUG_SHARE) {
          Alert.alert('DEBUG: Error', `getReceivedFiles error: ${error}`);
        }
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

      // Handle shares when app is already open via library event
      const eventType = Platform.OS === 'ios' ? 'url' : 'url';
      const subscription = ReceiveSharingIntent.addEventListener(eventType, (event) => {
        console.log(`📥 [${Platform.OS}] Received library event while app open:`, event);
        if (event) {
          const dataToHandle = event.url || event;
          handleSharedUrl(dataToHandle);
        }
      });

      // Listen for native newShareIntent event (emitted directly from onNewIntent)
      const nativeShareSubscription = DeviceEventEmitter.addListener('newShareIntent', (sharedText) => {
        console.log(`📥 [${Platform.OS}] Received native newShareIntent event:`, sharedText);
        if (DEBUG_SHARE) {
          Alert.alert('DEBUG: Native Event', `Received newShareIntent:\n${sharedText?.substring(0, 100) || 'empty'}`);
        }
        if (sharedText) {
          lastProcessedUrl.current = null; // Reset to allow processing
          handleSharedUrl(sharedText);
        }
      });

      // Listen for app state changes to check for new shares when app comes to foreground
      const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        console.log(`📱 [${Platform.OS}] App state changed to:`, nextAppState);
        if (nextAppState === 'active') {
          if (DEBUG_SHARE) {
            Alert.alert('DEBUG: App Active', 'App became active, checking for shares...');
          }
          // When app becomes active, check for new shares
          // Reset lastProcessedUrl so same URL can be shared again after app was backgrounded
          console.log(`🔄 [${Platform.OS}] App became active, resetting state and checking for new shares`);
          lastProcessedUrl.current = null;

          // Check multiple times - native layer may need time to process onNewIntent
          checkForSharedContent();
          setTimeout(() => checkForSharedContent(), 300);
          setTimeout(() => checkForSharedContent(), 700);
          setTimeout(() => checkForSharedContent(), 1200);
        }
      });

      // Cleanup
      return () => {
        console.log(`🧹 [${Platform.OS}] Cleaning up share intent listener`);
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
        if (nativeShareSubscription && typeof nativeShareSubscription.remove === 'function') {
          nativeShareSubscription.remove();
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
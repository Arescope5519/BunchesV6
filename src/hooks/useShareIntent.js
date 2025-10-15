/**
 * useShareIntent Hook
 * Handles shared URLs from browser via Android Share functionality
 * Extracted from your App.js
 */

import { useEffect } from 'react';
import { Alert } from 'react-native';
import { extractUrlFromText } from '../utils/urlExtractor';

// Try to import share library, handle gracefully if it fails
let ReceiveSharingIntent = null;
try {
  ReceiveSharingIntent = require('react-native-receive-sharing-intent').default;
} catch (error) {
  console.log('⚠️ Share intent not available (will work after rebuild):', error.message);
}

export const useShareIntent = (onUrlReceived) => {
  /**
   * Handle shared URLs from browser - DEBUG VERSION
   */
  const handleSharedUrl = (sharedData) => {
    console.log('📨 Received shared data:', sharedData);

    let sharedUrl = null;

    // Extract URL based on data type
    if (typeof sharedData === 'string') {
      sharedUrl = extractUrlFromText(sharedData);
    } else if (sharedData.weblink) {
      sharedUrl = extractUrlFromText(sharedData.weblink);
    } else if (sharedData.text) {
      sharedUrl = extractUrlFromText(sharedData.text);
    } else if (sharedData.contentUri) {
      sharedUrl = extractUrlFromText(sharedData.contentUri);
    }

    // Show the URL in the bar first (for debugging)
    if (sharedUrl) {
      Alert.alert('Debug', `Extracted URL: ${sharedUrl}`);

      // Call the callback with extracted URL
      if (onUrlReceived) {
        onUrlReceived(sharedUrl);
      }
    } else {
      Alert.alert('Error', `Could not extract URL. Received: ${JSON.stringify(sharedData)}`);
    }
  };

  /**
   * Setup share intent listener
   */
  useEffect(() => {
    if (!ReceiveSharingIntent) {
      console.log('ℹ️ Share intent not available in this environment');
      return;
    }

    try {
      // Handle shares when app is closed/not running
      ReceiveSharingIntent.getReceivedFiles((files) => {
        if (files && files.length > 0) {
          handleSharedUrl(files[0]);
        }
      });

      // Handle shares when app is already open
      const subscription = ReceiveSharingIntent.addEventListener('url', (event) => {
        if (event && event.url) {
          handleSharedUrl(event.url);
        }
      });

      // Cleanup
      return () => {
        ReceiveSharingIntent.clearReceivedFiles();
        if (subscription && subscription.remove) {
          subscription.remove();
        }
      };
    } catch (error) {
      console.log('⚠️ Could not setup share listener:', error.message);
    }
  }, []);

  return {
    isAvailable: !!ReceiveSharingIntent,
  };
};

export default useShareIntent;
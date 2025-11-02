/**
 * FILENAME: src/hooks/useShareIntent.js
 * PURPOSE: Handles shared URLs from browser via Android Share functionality
 * CHANGES: Removed debug alerts, enabled auto-extraction
 * USED BY: src/screens/HomeScreen.js
 */

import { useEffect } from 'react';
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
   * Handle shared URLs from browser
   */
  const handleSharedUrl = (sharedData) => {
    console.log('📨 Received shared data from browser');

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

    // Call the callback with extracted URL
    if (sharedUrl) {
      console.log('✅ URL extracted:', sharedUrl);
      if (onUrlReceived) {
        onUrlReceived(sharedUrl);
      }
    } else {
      console.error('❌ Could not extract URL from shared data');
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
/**
 * FILENAME: src/hooks/useShareIntent.js
 * PURPOSE: Handles shared URLs from browser via Share functionality (iOS & Android)
 * CHANGES:
 *   - Removed debug alerts, enabled auto-extraction
 *   - Improved iOS support with better URL handling
 *   - Added Platform-specific logging
 *   - Added iOS Share Extension support via URL scheme (<scheme>://share?url=...)
 * USED BY: src/screens/HomeScreen.js
 */

import { useEffect, useRef } from 'react';
import { Platform, AppState, DeviceEventEmitter, NativeModules, Linking } from 'react-native';
import { extractUrlFromText } from '../utils/urlExtractor';

import { log } from '../utils/log';
import { APP_SCHEME, LEGACY_SCHEMES } from '../constants/app';
// iOS App Groups storage module
const { AppGroupStorage } = NativeModules;

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
    log(`📨 [${Platform.OS}] Received shared data from browser`, sharedData);

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
        log(`⏭️ [${Platform.OS}] Skipping duplicate URL:`, sharedUrl);
        return;
      }

      log(`✅ [${Platform.OS}] URL extracted:`, sharedUrl);
      lastProcessedUrl.current = sharedUrl;

      // Use the ref to get the latest callback
      if (onUrlReceivedRef.current) {
        log(`✅ [${Platform.OS}] Calling onUrlReceived callback...`);
        onUrlReceivedRef.current(sharedUrl);
      } else {
        console.error(`❌ [${Platform.OS}] No onUrlReceived callback set!`);
        require('react-native').Alert.alert(
          'Share Failed',
          'App is not ready to receive shared recipes. Try again.',
        );
      }

      // Don't call clearReceivedFiles() - it can interfere with detecting new shares
      // We use lastProcessedUrl to prevent duplicate processing instead
    } else {
      console.error(`❌ [${Platform.OS}] Could not extract URL from shared data:`, sharedData);
      require('react-native').Alert.alert(
        'Share Failed',
        `Could not find a URL in the shared content:\n\n${
          typeof sharedData === 'string'
            ? sharedData.substring(0, 200)
            : JSON.stringify(sharedData).substring(0, 200)
        }`,
      );
    }
  };

  /**
   * Parse URL from the app's custom scheme
   */
  const parseShareUrl = (url) => {
    if (!url) return null;

    try {
      // Handle <scheme>://share?url=<encoded_url>, current or legacy
      const shareSchemes = [APP_SCHEME, ...LEGACY_SCHEMES];
      if (shareSchemes.some(sc => url.startsWith(`${sc}://share`))) {
        const urlObj = new URL(url);
        const sharedUrl = urlObj.searchParams.get('url');
        if (sharedUrl) {
          return decodeURIComponent(sharedUrl);
        }
      }
    } catch (error) {
      log('🍎 [iOS] Error parsing share URL:', error.message);
    }
    return null;
  };

  /**
   * Check for iOS Share Extension shared URLs (via URL scheme or App Groups)
   * Supports multiple queued URLs - passes all URLs at once for batch processing
   */
  const checkIOSShareExtension = async () => {
    if (Platform.OS !== 'ios') {
      return;
    }

    try {
      // First try to get URL from Linking (<scheme>://share?url=...)
      log('🍎 [iOS] Checking for shared URL via Linking...');
      const initialUrl = await Linking.getInitialURL();

      if (initialUrl) {
        log('🍎 [iOS] Got initial URL:', initialUrl);
        const sharedUrl = parseShareUrl(initialUrl);
        if (sharedUrl) {
          log('🍎 [iOS] Extracted shared URL:', sharedUrl);
          handleSharedUrl(sharedUrl);
          return;
        }
      }

      // Check App Groups for queued URLs
      if (AppGroupStorage) {
        log('🍎 [iOS] Checking Share Extension via App Groups...');

        // Try to get all URLs (new method)
        let sharedURLs = [];
        try {
          if (AppGroupStorage.getSharedURLs) {
            sharedURLs = await AppGroupStorage.getSharedURLs();
          }
        } catch (e) {
          // Fallback to single URL method
          const singleURL = await AppGroupStorage.getSharedURL();
          if (singleURL) {
            sharedURLs = [singleURL];
          }
        }

        if (sharedURLs && sharedURLs.length > 0) {
          log(`🍎 [iOS] Found ${sharedURLs.length} shared URL(s) from extension`);

          // Pass all URLs at once for batch processing (callback receives array)
          // This allows the caller to process all and show one summary alert
          if (onUrlReceivedRef.current) {
            onUrlReceivedRef.current(sharedURLs, true); // true = isBatch
          }

          // Clear all URLs after processing
          await AppGroupStorage.clearSharedURL();
          log('🍎 [iOS] Cleared all shared URLs from App Groups');
        } else {
          log('🍎 [iOS] No shared URLs found in App Groups');
        }
      } else {
        log('🍎 [iOS] AppGroupStorage not available');
      }
    } catch (error) {
      log('🍎 [iOS] Error checking for shared URLs:', error.message);
    }
  };

  /**
   * Check for pending share intents
   * iOS: Uses App Groups / URL scheme
   * Android: Uses native Intent via getIntent() - handled by DeviceEventEmitter listener
   */
  const checkForSharedContent = () => {
    if (Platform.OS === 'ios') {
      checkIOSShareExtension();
      return;
    }
    checkAndroidShareLink();
  };

  /**
   * Android: read the share as a deep link.
   *
   * MainActivity rewrites an incoming ACTION_SEND into
   * "<scheme>://share?url=...", so getInitialURL() returns it. That
   * matters on a COLD start - when the share launches the app there is
   * no JS runtime to receive the 'newShareIntent' event, and anything
   * emitted before the bundle loads is lost. Pulling the URL when JS is
   * ready cannot miss it.
   */
  const checkAndroidShareLink = async () => {
    try {
      const initialUrl = await Linking.getInitialURL();
      if (!initialUrl) return;

      const sharedUrl = parseShareUrl(initialUrl);
      if (sharedUrl) {
        log('🤖 [Android] Extracted shared URL from launch intent:', sharedUrl);
        handleSharedUrl(sharedUrl);
      }
    } catch (error) {
      console.error('[Android] Failed to read launch intent:', error);
    }
  };

  /**
   * Handle URL event from Linking (iOS)
   */
  const handleLinkingUrl = (event) => {
    log(`🔗 [${Platform.OS}] Received Linking URL event:`, event.url);
    const sharedUrl = parseShareUrl(event.url);
    if (sharedUrl) {
      log(`🔗 [${Platform.OS}] Extracted shared URL from event:`, sharedUrl);
      lastProcessedUrl.current = null; // Reset to allow processing
      handleSharedUrl(sharedUrl);
    }
  };

  /**
   * Setup share intent listener
   */
  useEffect(() => {
    log(`🔧 [${Platform.OS}] Setting up share intent listener`);

    try {
      // Check for shares when app starts
      if (!processedInitialShare.current) {
        checkForSharedContent();
        processedInitialShare.current = true;
      }

      // Both platforms: share arrives as <scheme>://share?url=...
      const linkingSubscription = Linking.addEventListener('url', handleLinkingUrl);
      log(`🔗 [${Platform.OS}] Added Linking URL listener`);

      // Listen for native newShareIntent event (emitted directly from onNewIntent - Android)
      const nativeShareSubscription = DeviceEventEmitter.addListener('newShareIntent', (sharedText) => {
        log(`📥 [${Platform.OS}] Received native newShareIntent event:`, sharedText);
        if (sharedText) {
          lastProcessedUrl.current = null; // Reset to allow processing
          handleSharedUrl(sharedText);
        }
      });

      // Listen for app state changes to check for new shares when app comes to foreground
      const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        log(`📱 [${Platform.OS}] App state changed to:`, nextAppState);
        if (nextAppState === 'active') {
          // When app becomes active, check for new shares
          // Reset lastProcessedUrl so same URL can be shared again after app was backgrounded
          log(`🔄 [${Platform.OS}] App became active, resetting state and checking for new shares`);
          lastProcessedUrl.current = null;

          // Check for shared content
          checkForSharedContent();

          // Check multiple times for Android - native layer may need time to process onNewIntent
          if (Platform.OS === 'android') {
            setTimeout(() => checkForSharedContent(), 300);
            setTimeout(() => checkForSharedContent(), 700);
            setTimeout(() => checkForSharedContent(), 1200);
          }
        }
      });

      // Cleanup
      return () => {
        log(`🧹 [${Platform.OS}] Cleaning up share intent listener`);
        if (linkingSubscription && typeof linkingSubscription.remove === 'function') {
          linkingSubscription.remove();
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
    isAvailable: true,
    platform: Platform.OS,
  };
};

export default useShareIntent;

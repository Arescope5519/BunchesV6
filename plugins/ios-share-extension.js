const {
  withInfoPlist,
  withEntitlementsPlist,
} = require('@expo/config-plugins');

/**
 * iOS Share Intent Configuration
 * Enables receiving shared URLs via URL schemes and Universal Links
 *
 * NOTE: This does NOT create a Share Extension. To appear in Safari's share
 * sheet, a separate Share Extension target would need to be created manually.
 *
 * Current functionality:
 * - URL schemes (bunches://) for deep linking
 * - Universal Links (applinks:bunches.app) for web-to-app linking
 * - Works with react-native-receive-sharing-intent for URL handling
 */
const withIOSShareExtension = (config) => {
  // Add URL scheme configuration to Info.plist
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    // Add URL schemes for deep linking
    if (!infoPlist.CFBundleURLTypes) {
      infoPlist.CFBundleURLTypes = [];
    }

    // Ensure our share URL scheme is present
    const shareScheme = {
      CFBundleURLName: 'com.bunchesai.v6.share',
      CFBundleURLSchemes: ['bunches'],
    };

    const existingScheme = infoPlist.CFBundleURLTypes.find(
      (type) => type.CFBundleURLSchemes?.includes('bunches')
    );

    if (!existingScheme) {
      infoPlist.CFBundleURLTypes.push(shareScheme);
    }

    // Add LSApplicationQueriesSchemes to allow querying other apps
    if (!infoPlist.LSApplicationQueriesSchemes) {
      infoPlist.LSApplicationQueriesSchemes = [];
    }

    // NOTE: Removed NSExtension configuration as it's only for App Extensions,
    // not the main app. For a proper Share Extension, you would need to:
    // 1. Create a Share Extension target in Xcode
    // 2. Add Share Extension source code (Swift/Objective-C)
    // 3. Configure the Share Extension's Info.plist with NSExtension
    // 4. Set up App Groups for data sharing between main app and extension

    return config;
  });

  // Add app groups entitlement (prepared for future Share Extension)
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;

    if (!entitlements['com.apple.security.application-groups']) {
      entitlements['com.apple.security.application-groups'] = [
        `group.com.bunchesai.v6`,
      ];
    }

    // Add associated domains for Universal Links
    if (!entitlements['com.apple.developer.associated-domains']) {
      entitlements['com.apple.developer.associated-domains'] = [
        'applinks:bunches.app',
      ];
    }

    return config;
  });

  return config;
};

module.exports = withIOSShareExtension;

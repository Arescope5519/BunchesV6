const {
  withInfoPlist,
  withEntitlementsPlist,
} = require('@expo/config-plugins');

/**
 * iOS Share Extension Configuration
 * Enables "Share to Bunches" from Safari and other apps
 */
const withIOSShareExtension = (config) => {
  // Add share extension info to Info.plist
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    // Add URL schemes for sharing
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

    // Add supported content types for sharing
    infoPlist.NSExtension = {
      NSExtensionAttributes: {
        NSExtensionActivationRule: {
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsText: true,
        },
      },
    };

    return config;
  });

  // Add app groups for sharing data between app and extension
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;

    if (!entitlements['com.apple.security.application-groups']) {
      entitlements['com.apple.security.application-groups'] = [
        `group.com.bunchesai.v6`,
      ];
    }

    return config;
  });

  return config;
};

module.exports = withIOSShareExtension;

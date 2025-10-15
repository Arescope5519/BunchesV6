/**
 * FILENAME: src/utils/BuildExpiration.js
 * PURPOSE: Check if development build has expired
 * USAGE: Call checkBuildExpiration() on app startup
 */

import { Alert } from 'react-native';

// ⚙️ CONFIGURATION
const BUILD_DATE = '2025-10-15'; // ← UPDATE THIS TO TODAY'S DATE WHEN YOU BUILD!
const EXPIRATION_DAYS = 30; // Development builds expire after 7 days (1 week)
const BUILD_TYPE = 'development'; // Options: 'development', 'production'

/**
 * Check if the current build has expired
 * @returns {Object} { expired: boolean, daysRemaining: number, buildDate: string }
 */
export const getBuildStatus = () => {
  const buildDate = new Date(BUILD_DATE);
  const today = new Date();

  // Calculate days since build
  const daysSinceBuild = Math.floor((today - buildDate) / (1000 * 60 * 60 * 24));
  const daysRemaining = EXPIRATION_DAYS - daysSinceBuild;

  const expired = daysSinceBuild > EXPIRATION_DAYS;

  return {
    expired,
    daysRemaining,
    daysSinceBuild,
    buildDate: BUILD_DATE,
    buildType: BUILD_TYPE,
    expirationDate: new Date(buildDate.getTime() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };
};

/**
 * Check build expiration and show appropriate alerts
 * @param {Function} onExpired - Callback if build is expired (optional)
 * @returns {boolean} - Returns true if build is still valid
 */
export const checkBuildExpiration = (onExpired) => {
  // Skip expiration check for production builds
  if (BUILD_TYPE === 'production') {
    console.log('✅ Production build - no expiration');
    return true;
  }

  const status = getBuildStatus();

  console.log('📅 Build Status:', {
    buildDate: status.buildDate,
    daysSinceBuild: status.daysSinceBuild,
    daysRemaining: status.daysRemaining,
    expired: status.expired
  });

  // BUILD EXPIRED - Block usage
  if (status.expired) {
    Alert.alert(
      '⚠️ Development Build Expired',
      `This development build expired ${Math.abs(status.daysRemaining)} days ago.\n\n` +
      `Build Date: ${status.buildDate}\n` +
      `Expiration: ${status.expirationDate}\n\n` +
      `Please download the latest version from the developer.`,
      [
        {
          text: 'OK',
          onPress: () => {
            if (onExpired) onExpired();
          }
        }
      ],
      { cancelable: false }
    );
    return false;
  }

  // WARNING - 2 days or less remaining
  if (status.daysRemaining <= 2 && status.daysRemaining > 0) {
    Alert.alert(
      '⚠️ Build Expiring Soon',
      `This development build will expire in ${status.daysRemaining} day(s).\n\n` +
      `Build Date: ${status.buildDate}\n` +
      `Expiration: ${status.expirationDate}\n\n` +
      `Consider updating to the latest version soon.`,
      [{ text: 'OK' }]
    );
  }

  return true;
};

/**
 * Get formatted build info for display in app
 * @returns {string} - Formatted build information
 */
export const getBuildInfo = () => {
  const status = getBuildStatus();

  if (BUILD_TYPE === 'production') {
    return `Build: ${BUILD_DATE} (Production)`;
  }

  if (status.expired) {
    return `Build: ${BUILD_DATE} (EXPIRED ${Math.abs(status.daysRemaining)} days ago)`;
  }

  return `Build: ${BUILD_DATE} (Expires in ${status.daysRemaining} days)`;
};

export default {
  checkBuildExpiration,
  getBuildStatus,
  getBuildInfo,
};
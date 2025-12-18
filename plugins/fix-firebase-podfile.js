const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to fix Firebase Swift pod modular headers issue
 * Adds use_modular_headers! to Podfile for Firebase compatibility
 */
const withFirebasePodfileFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      if (!fs.existsSync(podfilePath)) {
        console.log('Podfile not found, skipping Firebase fix');
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if already has use_modular_headers!
      if (podfileContent.includes('use_modular_headers!')) {
        console.log('Podfile already has use_modular_headers!');
        return config;
      }

      // Add use_modular_headers! after the platform line
      podfileContent = podfileContent.replace(
        /(platform :ios.*\n)/,
        `$1\n# Enable modular headers for Firebase Swift pods\nuse_modular_headers!\n`
      );

      fs.writeFileSync(podfilePath, podfileContent);
      console.log('Added use_modular_headers! to Podfile for Firebase compatibility');

      return config;
    },
  ]);
};

module.exports = withFirebasePodfileFix;

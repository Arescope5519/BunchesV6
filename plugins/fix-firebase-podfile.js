const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to fix Firebase Swift pod issues
 * Uses modular headers WITHOUT use_frameworks! to avoid React Native incompatibility
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

      // Check if already patched
      if (podfileContent.includes('# Firebase fix applied')) {
        console.log('Podfile already has Firebase fix');
        return config;
      }

      // Add configuration at the top - NO use_frameworks!, just modular headers
      const firebaseConfig = `# Firebase fix applied
# Enable modular headers globally for Firebase Swift pod compatibility
use_modular_headers!

`;

      podfileContent = firebaseConfig + podfileContent;

      // Add post_install hook to configure Firebase pods
      if (podfileContent.includes('post_install do |installer|')) {
        const postInstallAddition = `
    # Configure pods for Firebase compatibility
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Ensure module maps are generated
        config.build_settings['DEFINES_MODULE'] = 'YES'

        # For Firebase Swift interop
        if target.name.include?('Firebase') || target.name == 'GoogleUtilities'
          config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
        end
      end
    end
`;

        podfileContent = podfileContent.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${postInstallAddition}`
        );
      }

      fs.writeFileSync(podfilePath, podfileContent);
      console.log('Added Firebase fix to Podfile (modular headers approach)');

      return config;
    },
  ]);
};

module.exports = withFirebasePodfileFix;

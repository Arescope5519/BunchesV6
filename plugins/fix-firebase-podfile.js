const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to fix Firebase Swift pod modular headers issue
 * Configures Podfile for proper Firebase Swift interop
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
      if (podfileContent.includes('# Firebase Swift fix')) {
        console.log('Podfile already has Firebase Swift fix');
        return config;
      }

      // Add Firebase configuration at the top of the file
      const firebaseConfig = `# Firebase Swift fix
$RNFirebaseAsStaticFramework = true

`;

      // Add modular headers for specific Firebase pods in post_install
      const postInstallPatch = `
    # Fix Firebase Swift module headers
    installer.pods_project.targets.each do |target|
      if ['FirebaseAuth', 'FirebaseCore', 'FirebaseCoreInternal', 'FirebaseCoreExtension', 'GoogleUtilities', 'FirebaseAuthInterop', 'FirebaseAppCheckInterop', 'RecaptchaInterop'].include?(target.name)
        target.build_configurations.each do |config|
          config.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'YES'
          config.build_settings['DEFINES_MODULE'] = 'YES'
        end
      end
    end`;

      // Add Firebase config at the beginning
      podfileContent = firebaseConfig + podfileContent;

      // Find post_install and add our patch
      if (podfileContent.includes('post_install do |installer|')) {
        podfileContent = podfileContent.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${postInstallPatch}`
        );
      }

      fs.writeFileSync(podfilePath, podfileContent);
      console.log('Added Firebase Swift fix to Podfile');

      return config;
    },
  ]);
};

module.exports = withFirebasePodfileFix;

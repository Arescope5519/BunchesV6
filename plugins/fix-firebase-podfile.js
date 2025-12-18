const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to fix Firebase Swift pod issues
 * Uses frameworks with static linkage for proper Swift header generation
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

      // Debug: Print current Podfile content
      console.log('=== PODFILE BEFORE MODIFICATION ===');
      console.log(podfileContent.substring(0, 500));
      console.log('=== END PODFILE PREVIEW ===');

      // Check if already patched
      if (podfileContent.includes('# Firebase Swift fix applied')) {
        console.log('Podfile already has Firebase Swift fix');
        return config;
      }

      // Add marker and use_frameworks with static linkage
      // This is the recommended approach for React Native Firebase
      const firebaseFix = `# Firebase Swift fix applied
# Use frameworks with static linkage for Firebase Swift compatibility
use_frameworks! :linkage => :static

# React Native requires these flags
$RNFirebaseAsStaticFramework = true

`;

      // Add at the very beginning of the file
      podfileContent = firebaseFix + podfileContent;

      // Also need to add modular headers for specific pods that need them
      // Find post_install and add configuration
      if (podfileContent.includes('post_install do |installer|')) {
        const postInstallAddition = `
    # Debug: Print Firebase pod info
    puts "=== Firebase Pods Build Settings ==="

    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Allow non-modular includes in framework modules (fixes RNFirebase + use_frameworks!)
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        # Disable the warning/error for non-modular includes
        config.build_settings['OTHER_CFLAGS'] ||= ['$(inherited)']
        if config.build_settings['OTHER_CFLAGS'].is_a?(String)
          config.build_settings['OTHER_CFLAGS'] = [config.build_settings['OTHER_CFLAGS']]
        end
        config.build_settings['OTHER_CFLAGS'] << '-Wno-non-modular-include-in-framework-module'
      end
    end
    puts "=== End Firebase Pods ==="
`;

        podfileContent = podfileContent.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${postInstallAddition}`
        );
      }

      fs.writeFileSync(podfilePath, podfileContent);

      console.log('=== PODFILE AFTER MODIFICATION ===');
      console.log(podfileContent.substring(0, 800));
      console.log('=== END MODIFIED PODFILE ===');

      console.log('Added Firebase Swift fix to Podfile');

      return config;
    },
  ]);
};

module.exports = withFirebasePodfileFix;

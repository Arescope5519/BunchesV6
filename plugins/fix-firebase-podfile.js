const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to fix Firebase Swift pod issues
 * The problem: Firebase.h umbrella header imports FirebaseAuth-Swift.h
 * which doesn't exist when building as static libraries.
 *
 * Solution: Set $RNFirebaseAsStaticFramework and use modular headers
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
      if (podfileContent.includes('# Firebase static framework fix')) {
        console.log('Podfile already has Firebase fix');
        return config;
      }

      // This must be set BEFORE any require statements
      // It tells React Native Firebase to use static frameworks
      const firebaseConfig = `# Firebase static framework fix
# Must be set before requiring any Firebase/RN scripts
$RNFirebaseAsStaticFramework = true

`;

      podfileContent = firebaseConfig + podfileContent;

      // Add post_install hook to fix Firebase header issues
      if (podfileContent.includes('post_install do |installer|')) {
        const postInstallAddition = `
    # Fix Firebase umbrella header Swift imports issue
    # The Firebase.h umbrella header tries to import Swift headers that don't exist
    # when building as static libraries. This disables the problematic imports.
    firebase_header = File.join(installer.sandbox.root, 'Headers/Private/Firebase/Firebase.h')
    if File.exist?(firebase_header)
      content = File.read(firebase_header)
      # Comment out Swift header imports that cause build failures
      modified = content.gsub(/#import <Firebase.*-Swift\\.h>/, '// DISABLED: \\0')
      if content != modified
        File.write(firebase_header, modified)
        puts "Modified Firebase.h to disable Swift imports"
      end
    end

    # Set modular headers for Firebase pods
    installer.pods_project.targets.each do |target|
      if target.name.include?('Firebase') || target.name == 'GoogleUtilities'
        target.build_configurations.each do |config|
          config.build_settings['DEFINES_MODULE'] = 'YES'
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
      console.log('Added Firebase static framework fix to Podfile');

      return config;
    },
  ]);
};

module.exports = withFirebasePodfileFix;

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to fix Firebase Swift pod issues
 * Adds modular_headers specifically to the pods that need them
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
      if (podfileContent.includes('# Firebase modular headers fix')) {
        console.log('Podfile already has Firebase fix');
        return config;
      }

      // Add pre_install hook to set modular headers for specific Firebase pods
      const preInstallHook = `# Firebase modular headers fix
# These pods need modular headers for Swift interop
$FirebaseModularHeadersPods = [
  'FirebaseCore',
  'FirebaseCoreInternal',
  'FirebaseCoreExtension',
  'FirebaseAuth',
  'FirebaseAuthInterop',
  'FirebaseAppCheckInterop',
  'GoogleUtilities',
  'RecaptchaInterop',
  'FirebaseFirestore',
  'FirebaseFirestoreInternal',
]

pre_install do |installer|
  installer.pod_targets.each do |pod|
    if $FirebaseModularHeadersPods.include?(pod.name)
      def pod.build_type
        Pod::BuildType.static_library
      end
    end
  end
end

`;

      // Insert before the first 'require' statement
      podfileContent = preInstallHook + podfileContent;

      // Also add modular headers in the target block
      // Find the target block and add pod-specific modular headers
      const modularHeadersPods = `
  # Enable modular headers for Firebase pods that need them
  pod 'FirebaseCore', :modular_headers => true
  pod 'FirebaseCoreInternal', :modular_headers => true
  pod 'FirebaseCoreExtension', :modular_headers => true
  pod 'FirebaseAuth', :modular_headers => true
  pod 'FirebaseAuthInterop', :modular_headers => true
  pod 'FirebaseAppCheckInterop', :modular_headers => true
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
`;

      // Insert after the target line
      podfileContent = podfileContent.replace(
        /(target ['"][^'"]+['"] do)/,
        `$1${modularHeadersPods}`
      );

      fs.writeFileSync(podfilePath, podfileContent);
      console.log('Added Firebase modular headers fix to Podfile');

      return config;
    },
  ]);
};

module.exports = withFirebasePodfileFix;

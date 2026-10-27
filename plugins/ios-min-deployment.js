const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Some pods declare an iOS minimum older than the app's (google-signin's
// Expo adapter says 13.4), but they import ExpoModulesCore, whose Swift
// module is built for 15.1 - Xcode refuses the mix:
//   "Compiling for iOS 13.4, but module 'ExpoModulesCore' has a minimum
//    deployment target of iOS 15.1"
// Raising every pod to the app's floor inside post_install is the
// standard CocoaPods fix; it has to live in a plugin because
// `expo prebuild --clean` regenerates ios/Podfile.

const MIN_IOS = '15.1';

const SNIPPET = `
    # melibri: lift pods below the app's iOS floor (see plugins/ios-min-deployment.js)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        if config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_IOS}
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end
`;

module.exports = function withIosMinDeployment(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes('melibri: lift pods below')) {
        const anchor = /post_install do \|installer\|\n/;
        if (!anchor.test(contents)) {
          throw new Error(
            'ios-min-deployment: no post_install block found in ios/Podfile'
          );
        }
        contents = contents.replace(anchor, (m) => m + SNIPPET);
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};

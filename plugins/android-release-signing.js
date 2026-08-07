const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Android release signing
 *
 * Expo's generated build.gradle signs RELEASE builds with the debug
 * keystore. That is fine for a test APK on your own phone, but Play
 * rejects a debug-signed upload outright.
 *
 * Writing the signing config into android/app/build.gradle by hand does
 * not survive, because `expo prebuild --clean` deletes and regenerates
 * the whole android/ folder. This plugin re-applies it on every prebuild.
 *
 * Credentials are read from Gradle properties, never from this repo:
 *
 *   MELIBRI_UPLOAD_STORE_FILE      absolute path to the .keystore
 *   MELIBRI_UPLOAD_STORE_PASSWORD
 *   MELIBRI_UPLOAD_KEY_ALIAS
 *   MELIBRI_UPLOAD_KEY_PASSWORD
 *
 * Put them in your user-level Gradle file, which lives outside the
 * project and is never committed:
 *
 *   Windows:  C:\Users\<you>\.gradle\gradle.properties
 *   macOS:    ~/.gradle/gradle.properties
 *
 * When those properties are absent the build falls back to debug
 * signing, so a plain `assembleRelease` on a machine without the
 * keystore still works exactly as it does today.
 */

const SIGNING_CONFIG = `
        release {
            if (project.hasProperty('MELIBRI_UPLOAD_STORE_FILE')) {
                storeFile file(MELIBRI_UPLOAD_STORE_FILE)
                storePassword MELIBRI_UPLOAD_STORE_PASSWORD
                keyAlias MELIBRI_UPLOAD_KEY_ALIAS
                keyPassword MELIBRI_UPLOAD_KEY_PASSWORD
            }
        }`;

const CHOSEN_CONFIG =
  "signingConfig project.hasProperty('MELIBRI_UPLOAD_STORE_FILE') " +
  '? signingConfigs.release : signingConfigs.debug';

const withAndroidReleaseSigning = (config) => {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes('MELIBRI_UPLOAD_STORE_FILE')) {
      return config; // already applied
    }

    // 1. Point the release buildType at the release config when the
    //    properties exist. Do this BEFORE adding signingConfigs.release,
    //    so the `release {` we match is the buildType and not the
    //    signing block we are about to insert.
    const buildTypesAt = contents.indexOf('buildTypes {');
    if (buildTypesAt === -1) {
      throw new Error(
        '[android-release-signing] no buildTypes block in build.gradle'
      );
    }

    const head = contents.slice(0, buildTypesAt);
    let tail = contents.slice(buildTypesAt);

    // Inside buildTypes, the debug block comes first, so the release
    // block's signingConfig is the LAST debug reference in this section.
    const lastDebugRef = tail.lastIndexOf('signingConfig signingConfigs.debug');
    if (lastDebugRef === -1) {
      throw new Error(
        '[android-release-signing] release buildType has no signingConfig to replace'
      );
    }
    tail =
      tail.slice(0, lastDebugRef) +
      CHOSEN_CONFIG +
      tail.slice(lastDebugRef + 'signingConfig signingConfigs.debug'.length);

    contents = head + tail;

    // 2. Add the release signing config alongside the debug one.
    const signingConfigsAt = contents.indexOf('signingConfigs {');
    if (signingConfigsAt === -1) {
      throw new Error(
        '[android-release-signing] no signingConfigs block in build.gradle'
      );
    }
    const insertAt = signingConfigsAt + 'signingConfigs {'.length;
    contents =
      contents.slice(0, insertAt) + SIGNING_CONFIG + contents.slice(insertAt);

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withAndroidReleaseSigning;

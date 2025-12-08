const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Android Share Intent Configuration
 * Enables the app to appear in the system share sheet when sharing URLs/text
 * Works with react-native-receive-sharing-intent
 */
const withAndroidShareIntent = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];
    const mainActivity = mainApplication.activity.find(
      (activity) => activity.$['android:name'] === '.MainActivity'
    );

    if (!mainActivity) {
      throw new Error('MainActivity not found in AndroidManifest.xml');
    }

    // Configure MainActivity for proper share intent handling
    // singleTask: Only one instance exists - new shares go to existing instance via onNewIntent
    mainActivity.$['android:launchMode'] = 'singleTask';

    // Empty taskAffinity ensures activity always launches in app's own task
    // Without this, shares from other apps might create instance inside their task
    mainActivity.$['android:taskAffinity'] = '';

    console.log('✅ Set MainActivity launchMode to singleTask for share intent handling');

    // Ensure intent-filter array exists
    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }

    // Check if share intent filters already exist
    const hasShareIntent = mainActivity['intent-filter'].some((filter) => {
      return filter.action?.some(
        (action) => action.$['android:name'] === 'android.intent.action.SEND'
      );
    });

    // Add share intent filters if they don't exist
    if (!hasShareIntent) {
      // Handle SEND action (single item share)
      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': 'text/plain' } }],
      });

      // Handle SEND_MULTIPLE action (multiple items share)
      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': 'text/plain' } }],
      });

      console.log('✅ Added Android share intent filters to MainActivity');
    }

    return config;
  });
};

module.exports = withAndroidShareIntent;

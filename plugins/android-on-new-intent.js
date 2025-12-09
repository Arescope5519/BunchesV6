const { withMainActivity } = require('@expo/config-plugins');

/**
 * Android onNewIntent Handler
 *
 * This plugin modifies MainActivity.kt to handle share intents when the app
 * is already running. Without this, sharing to an already-open app just brings
 * it to the foreground without processing the shared content.
 *
 * Works with react-native-receive-sharing-intent library.
 */
const withAndroidOnNewIntent = (config) => {
  return withMainActivity(config, (config) => {
    const mainActivity = config.modResults;
    const isKotlin = mainActivity.language === 'kt' || mainActivity.path?.endsWith('.kt');

    // Add the import for ReceiveSharingIntentHelper if not present
    if (!mainActivity.contents.includes('com.reactnativereceivesharingintent.ReceiveSharingIntentHelper')) {
      if (isKotlin) {
        // Kotlin imports (no semicolons)
        mainActivity.contents = mainActivity.contents.replace(
          'import android.os.Bundle',
          'import android.os.Bundle\nimport android.content.Intent\nimport com.reactnativereceivesharingintent.ReceiveSharingIntentHelper'
        );
      } else {
        // Java imports
        mainActivity.contents = mainActivity.contents.replace(
          'import android.os.Bundle;',
          'import android.os.Bundle;\nimport android.content.Intent;\nimport com.reactnativereceivesharingintent.ReceiveSharingIntentHelper;'
        );
      }
      console.log('✅ Added ReceiveSharingIntentHelper import to MainActivity');
    }

    // Check if onNewIntent is already implemented
    if (!mainActivity.contents.includes('onNewIntent')) {
      // Find the closing brace of the class to insert before it
      const classEndIndex = mainActivity.contents.lastIndexOf('}');

      let onNewIntentMethod;
      if (isKotlin) {
        // Kotlin syntax
        onNewIntentMethod = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    // Forward the new intent to the sharing intent handler
    ReceiveSharingIntentHelper.setIntent(intent, this)
  }
`;
      } else {
        // Java syntax
        onNewIntentMethod = `
  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    // Forward the new intent to the sharing intent handler
    ReceiveSharingIntentHelper.setIntent(intent, this);
  }
`;
      }

      mainActivity.contents =
        mainActivity.contents.slice(0, classEndIndex) +
        onNewIntentMethod +
        mainActivity.contents.slice(classEndIndex);

      console.log('✅ Added onNewIntent handler to MainActivity for share intent support');
    }

    return config;
  });
};

module.exports = withAndroidOnNewIntent;

const { withMainActivity } = require('@expo/config-plugins');

/**
 * Android onNewIntent Handler
 *
 * This plugin modifies MainActivity.kt to handle share intents when the app
 * is already running. Without this, sharing to an already-open app just brings
 * it to the foreground without processing the shared content.
 *
 * The JavaScript side (useShareIntent hook) will detect the new intent via
 * AppState listener when the app becomes active.
 */
const withAndroidOnNewIntent = (config) => {
  return withMainActivity(config, (config) => {
    const mainActivity = config.modResults;
    const isKotlin = mainActivity.language === 'kt' || mainActivity.path?.endsWith('.kt');

    // Add Intent import if not present (needed for onNewIntent parameter type)
    if (!mainActivity.contents.includes('import android.content.Intent')) {
      if (isKotlin) {
        mainActivity.contents = mainActivity.contents.replace(
          'import android.os.Bundle',
          'import android.os.Bundle\nimport android.content.Intent'
        );
      } else {
        mainActivity.contents = mainActivity.contents.replace(
          'import android.os.Bundle;',
          'import android.os.Bundle;\nimport android.content.Intent;'
        );
      }
      console.log('✅ Added Intent import to MainActivity');
    }

    // Check if onNewIntent is already implemented
    if (!mainActivity.contents.includes('onNewIntent')) {
      // Find the closing brace of the class to insert before it
      const classEndIndex = mainActivity.contents.lastIndexOf('}');

      let onNewIntentMethod;
      if (isKotlin) {
        // Kotlin syntax - just update intent, JS side detects via AppState
        onNewIntentMethod = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;
      } else {
        // Java syntax
        onNewIntentMethod = `
  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
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

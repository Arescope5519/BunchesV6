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

    // Add DeviceEventManagerModule import for emitting events to JS
    if (isKotlin && !mainActivity.contents.includes('DeviceEventManagerModule')) {
      mainActivity.contents = mainActivity.contents.replace(
        'import android.content.Intent',
        'import android.content.Intent\nimport com.facebook.react.modules.core.DeviceEventManagerModule'
      );
      console.log('✅ Added DeviceEventManagerModule import to MainActivity');
    }

    // Check if onNewIntent is already implemented
    if (!mainActivity.contents.includes('onNewIntent')) {
      // Find the closing brace of the class to insert before it
      const classEndIndex = mainActivity.contents.lastIndexOf('}');

      let onNewIntentMethod;
      if (isKotlin) {
        // Kotlin syntax - update intent and emit event to JS
        onNewIntentMethod = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)

    // Emit event to JS when new share intent received
    if (intent.action == Intent.ACTION_SEND || intent.action == Intent.ACTION_SEND_MULTIPLE) {
      try {
        val reactContext = reactInstanceManager?.currentReactContext
        reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          ?.emit("newShareIntent", intent.getStringExtra(Intent.EXTRA_TEXT) ?: "")
      } catch (e: Exception) {
        // Ignore if React context not ready
      }
    }
  }
`;
      } else {
        // Java syntax
        onNewIntentMethod = `
  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);

    // Emit event to JS when new share intent received
    if (Intent.ACTION_SEND.equals(intent.getAction()) || Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
      try {
        ReactContext reactContext = getReactInstanceManager().getCurrentReactContext();
        if (reactContext != null) {
          reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("newShareIntent", intent.getStringExtra(Intent.EXTRA_TEXT));
        }
      } catch (Exception e) {
        // Ignore if React context not ready
      }
    }
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

const { withMainActivity } = require('@expo/config-plugins');

/**
 * Android onNewIntent Handler
 *
 * This plugin modifies MainActivity.kt to handle share intents when the app
 * is already running AND when launched fresh via share. It extracts shared
 * text/URLs and emits them to JavaScript via DeviceEventEmitter.
 */
const withAndroidOnNewIntent = (config) => {
  return withMainActivity(config, (config) => {
    const mainActivity = config.modResults;
    const isKotlin = mainActivity.language === 'kt' || mainActivity.path?.endsWith('.kt');

    // Add required imports
    const requiredImports = [
      'import android.content.Intent',
      'import com.facebook.react.bridge.Arguments',
      'import com.facebook.react.modules.core.DeviceEventManagerModule',
    ];

    for (const importStatement of requiredImports) {
      if (!mainActivity.contents.includes(importStatement)) {
        if (isKotlin) {
          mainActivity.contents = mainActivity.contents.replace(
            'import android.os.Bundle',
            `import android.os.Bundle\n${importStatement}`
          );
        } else {
          mainActivity.contents = mainActivity.contents.replace(
            'import android.os.Bundle;',
            `import android.os.Bundle;\n${importStatement.replace('import ', 'import ')};`
          );
        }
      }
    }
    console.log('✅ Added required imports to MainActivity');

    // Add onNewIntent if not present
    if (!mainActivity.contents.includes('onNewIntent')) {
      const classEndIndex = mainActivity.contents.lastIndexOf('}');

      let methods;
      if (isKotlin) {
        methods = `
  private var pendingShareText: String? = null

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleShareIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    // Check for pending share from cold start
    pendingShareText?.let { text ->
      pendingShareText = null
      emitShareIntent(text)
    }
    // Also check current intent on resume
    handleShareIntent(intent)
  }

  private fun handleShareIntent(intent: Intent?) {
    if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
      val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
      if (sharedText != null) {
        // Clear the intent action so we don't process it again
        intent.action = null
        emitShareIntent(sharedText)
      }
    }
  }

  private fun emitShareIntent(sharedText: String) {
    try {
      val reactContext = reactInstanceManager?.currentReactContext
      if (reactContext != null) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          ?.emit("newShareIntent", sharedText)
      } else {
        // React context not ready yet, save for later
        pendingShareText = sharedText
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }
`;
      } else {
        methods = `
  private String pendingShareText = null;

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleShareIntent(intent);
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (pendingShareText != null) {
      emitShareIntent(pendingShareText);
      pendingShareText = null;
    }
    handleShareIntent(getIntent());
  }

  private void handleShareIntent(Intent intent) {
    if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
      String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
      if (sharedText != null) {
        intent.setAction(null);
        emitShareIntent(sharedText);
      }
    }
  }

  private void emitShareIntent(String sharedText) {
    try {
      ReactContext reactContext = getReactInstanceManager().getCurrentReactContext();
      if (reactContext != null) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit("newShareIntent", sharedText);
      } else {
        pendingShareText = sharedText;
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
  }
`;
      }

      mainActivity.contents =
        mainActivity.contents.slice(0, classEndIndex) +
        methods +
        mainActivity.contents.slice(classEndIndex);

      console.log('✅ Added share intent handlers to MainActivity');
    }

    return config;
  });
};

module.exports = withAndroidOnNewIntent;

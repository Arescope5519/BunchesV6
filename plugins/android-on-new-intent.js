const { withMainActivity } = require('@expo/config-plugins');

/**
 * Android onNewIntent Handler
 *
 * With singleTask launchMode, when the app is already running and a share intent arrives,
 * Android calls onNewIntent() instead of creating a new activity instance.
 *
 * react-native-receive-sharing-intent needs onNewIntent to forward the intent data
 * to the JavaScript layer via event listeners.
 */
const withOnNewIntent = (config) => {
  return withMainActivity(config, (config) => {
    const mainActivity = config.modResults;
    const { language, contents } = mainActivity;

    if (language !== 'java') {
      console.warn('⚠️ MainActivity is not Java, skipping onNewIntent injection');
      return config;
    }

    // Check if onNewIntent already exists
    if (contents.includes('onNewIntent(')) {
      console.log('ℹ️ onNewIntent already exists in MainActivity');
      return config;
    }

    // Find the onCreate method to insert after it
    const onCreateIndex = contents.indexOf('super.onCreate(');
    if (onCreateIndex === -1) {
      console.warn('⚠️ Could not find onCreate method in MainActivity');
      return config;
    }

    // Find the end of onCreate method (closing brace)
    let braceCount = 0;
    let insertIndex = onCreateIndex;
    for (let i = onCreateIndex; i < contents.length; i++) {
      if (contents[i] === '{') braceCount++;
      if (contents[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          insertIndex = i + 1;
          break;
        }
      }
    }

    // Import statement for Intent
    const importStatement = 'import android.content.Intent;';
    let modifiedContents = contents;

    // Add import if not present
    if (!contents.includes(importStatement)) {
      const packageIndex = contents.indexOf('package ');
      const firstImportIndex = contents.indexOf('import ', packageIndex);
      if (firstImportIndex !== -1) {
        modifiedContents =
          contents.slice(0, firstImportIndex) +
          importStatement + '\n' +
          contents.slice(firstImportIndex);
        insertIndex += importStatement.length + 1;
      }
    }

    // onNewIntent method code
    const onNewIntentCode = `

  /**
   * Handle new intents when app is already running (singleTask mode)
   * When a share happens while app is open, Android calls this instead of onCreate
   */
  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);

    // CRITICAL: Update the activity's intent to the new one
    // This allows react-native-receive-sharing-intent to detect it
    setIntent(intent);

    // Log to verify the method is being called
    android.util.Log.d("MainActivity", "onNewIntent called with action: " + (intent != null ? intent.getAction() : "null"));

    // Manually extract and send the shared data directly to avoid NullPointerException with getReceivedFiles
    if (intent != null && intent.getAction() != null) {
      String action = intent.getAction();
      android.util.Log.d("MainActivity", "Processing new intent with action: " + action);

      if (action.equals(Intent.ACTION_SEND)) {
        try {
          // Extract the shared text/URL directly from the intent
          String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
          String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

          android.util.Log.d("MainActivity", "Shared text: " + sharedText);
          android.util.Log.d("MainActivity", "Shared subject: " + sharedSubject);

          if (sharedText != null || sharedSubject != null) {
            com.facebook.react.bridge.ReactContext reactContext =
              getReactNativeHost().getReactInstanceManager().getCurrentReactContext();

            if (reactContext != null) {
              // Create a JSON object with the shared data
              com.facebook.react.bridge.WritableMap params = com.facebook.react.bridge.Arguments.createMap();
              if (sharedText != null) {
                params.putString("text", sharedText);
              }
              if (sharedSubject != null) {
                params.putString("subject", sharedSubject);
              }

              // Send the shared data directly to JavaScript
              reactContext.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("RNReceiveSharingIntent::ShareData", params);
              android.util.Log.d("MainActivity", "Sent share data to JS: " + sharedText);
            } else {
              android.util.Log.w("MainActivity", "React context is null, cannot send event");
            }
          }
        } catch (Exception e) {
          android.util.Log.e("MainActivity", "Error extracting share data: " + e.getMessage());
        }
      }
    }
  }
`;

    // Insert onNewIntent method after onCreate
    modifiedContents =
      modifiedContents.slice(0, insertIndex) +
      onNewIntentCode +
      modifiedContents.slice(insertIndex);

    mainActivity.contents = modifiedContents;

    console.log('✅ Added onNewIntent handler to MainActivity');
    return config;
  });
};

module.exports = withOnNewIntent;

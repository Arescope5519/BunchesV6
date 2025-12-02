const { withMainActivity } = require('@expo/config-plugins');

/**
 * Android Share Intent Handler for singleTask mode
 *
 * Handles share intents in both scenarios:
 * 1. onCreate: When app is launched fresh (cold start)
 * 2. onNewIntent: When app is already running (warm start)
 *
 * Extracts share data directly in Java and sends to JavaScript to avoid
 * NullPointerException issues with react-native-receive-sharing-intent library.
 */
const withOnNewIntent = (config) => {
  return withMainActivity(config, (config) => {
    const mainActivity = config.modResults;
    const { language, contents } = mainActivity;

    if (language !== 'java') {
      console.warn('⚠️ MainActivity is not Java, skipping share intent injection');
      return config;
    }

    // Check if already modified
    if (contents.includes('processShareIntent(')) {
      console.log('ℹ️ Share intent handler already exists in MainActivity');
      return config;
    }

    // Find the onCreate method
    const onCreateIndex = contents.indexOf('super.onCreate(');
    if (onCreateIndex === -1) {
      console.warn('⚠️ Could not find onCreate method in MainActivity');
      return config;
    }

    // Find the end of onCreate method (closing brace)
    let braceCount = 0;
    let onCreateEndIndex = onCreateIndex;
    for (let i = onCreateIndex; i < contents.length; i++) {
      if (contents[i] === '{') braceCount++;
      if (contents[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          onCreateEndIndex = i;
          break;
        }
      }
    }

    // Import statements
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
        onCreateEndIndex += importStatement.length + 1;
      }
    }

    // Helper method to process share intents
    const helperMethodCode = `

  /**
   * Process share intent and send data to JavaScript
   * Called from both onCreate (cold start) and onNewIntent (warm start)
   */
  private void processShareIntent(Intent intent) {
    if (intent == null || intent.getAction() == null) {
      return;
    }

    String action = intent.getAction();
    android.util.Log.d("MainActivity", "processShareIntent called with action: " + action);

    if (action.equals(Intent.ACTION_SEND)) {
      try {
        // Extract the shared text/URL directly from the intent
        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

        android.util.Log.d("MainActivity", "Shared text: " + sharedText);
        android.util.Log.d("MainActivity", "Shared subject: " + sharedSubject);

        if (sharedText != null || sharedSubject != null) {
          // Post to handler to ensure React context is ready
          final String finalText = sharedText;
          final String finalSubject = sharedSubject;

          new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
              sendShareDataToJS(finalText, finalSubject);
            }
          }, 500); // Small delay to ensure React Native is initialized
        }
      } catch (Exception e) {
        android.util.Log.e("MainActivity", "Error extracting share data: " + e.getMessage());
      }
    }
  }

  /**
   * Send share data to JavaScript via React Native event
   */
  private void sendShareDataToJS(String text, String subject) {
    try {
      com.facebook.react.bridge.ReactContext reactContext =
        getReactNativeHost().getReactInstanceManager().getCurrentReactContext();

      if (reactContext != null) {
        // Create a JSON object with the shared data
        com.facebook.react.bridge.WritableMap params = com.facebook.react.bridge.Arguments.createMap();
        if (text != null) {
          params.putString("text", text);
        }
        if (subject != null) {
          params.putString("subject", subject);
        }

        // Send the shared data directly to JavaScript
        reactContext.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit("RNReceiveSharingIntent::ShareData", params);
        android.util.Log.d("MainActivity", "Sent share data to JS: " + text);
      } else {
        android.util.Log.w("MainActivity", "React context is null, retrying...");
        // Retry after another delay
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
          @Override
          public void run() {
            sendShareDataToJS(text, subject);
          }
        }, 500);
      }
    } catch (Exception e) {
      android.util.Log.e("MainActivity", "Error sending share data to JS: " + e.getMessage());
    }
  }

  /**
   * Handle new intents when app is already running (singleTask mode)
   */
  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    android.util.Log.d("MainActivity", "onNewIntent called");
    processShareIntent(intent);
  }
`;

    // Code to add at the end of onCreate
    const onCreateAddition = `
    // Process share intent if app was launched via share
    processShareIntent(getIntent());
`;

    // Insert onCreate addition before the closing brace of onCreate
    modifiedContents =
      modifiedContents.slice(0, onCreateEndIndex) +
      onCreateAddition +
      modifiedContents.slice(onCreateEndIndex);

    // Insert helper methods and onNewIntent after onCreate
    const insertIndex = onCreateEndIndex + onCreateAddition.length;
    modifiedContents =
      modifiedContents.slice(0, insertIndex) +
      helperMethodCode +
      modifiedContents.slice(insertIndex);

    mainActivity.contents = modifiedContents;

    console.log('✅ Added share intent handler to MainActivity');
    return config;
  });
};

module.exports = withOnNewIntent;

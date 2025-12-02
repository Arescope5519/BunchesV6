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

    // Static variable to store pending share data
    const staticPendingShare = `
  // Store pending share data when React context isn't ready
  private static String pendingShareText = null;
  private static String pendingShareSubject = null;
  private static long pendingShareTimestamp = 0;

  // Method for JS to call to get pending share data
  public static String getPendingShareText() {
    // Only return if less than 30 seconds old
    if (pendingShareText != null && (System.currentTimeMillis() - pendingShareTimestamp) < 30000) {
      return pendingShareText;
    }
    return null;
  }

  public static String getPendingShareSubject() {
    if (pendingShareSubject != null && (System.currentTimeMillis() - pendingShareTimestamp) < 30000) {
      return pendingShareSubject;
    }
    return null;
  }

  public static void clearPendingShare() {
    pendingShareText = null;
    pendingShareSubject = null;
    pendingShareTimestamp = 0;
    android.util.Log.d("MainActivity", "Cleared pending share data");
  }

  private void storePendingShare(String text, String subject) {
    pendingShareText = text;
    pendingShareSubject = subject;
    pendingShareTimestamp = System.currentTimeMillis();
    android.util.Log.d("MainActivity", "Stored pending share - text: " + text + ", subject: " + subject);
  }

  private void sendShareToJS(String text, String subject) {
    try {
      com.facebook.react.bridge.ReactContext reactContext =
        getReactNativeHost().getReactInstanceManager().getCurrentReactContext();

      if (reactContext != null && reactContext.hasActiveReactInstance()) {
        com.facebook.react.bridge.WritableMap params = com.facebook.react.bridge.Arguments.createMap();
        if (text != null) {
          params.putString("text", text);
        }
        if (subject != null) {
          params.putString("subject", subject);
        }

        reactContext.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit("RNReceiveSharingIntent::ShareData", params);
        android.util.Log.d("MainActivity", "Successfully sent share data to JS: " + text);

        // Clear pending since we sent it
        clearPendingShare();
      } else {
        android.util.Log.w("MainActivity", "React context not ready, storing for later");
        storePendingShare(text, subject);
      }
    } catch (Exception e) {
      android.util.Log.e("MainActivity", "Error sending to JS, storing for later: " + e.getMessage());
      storePendingShare(text, subject);
    }
  }
`;

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
    setIntent(intent);

    // Safely log - handle null intent
    String actionStr = "null";
    try {
      if (intent != null && intent.getAction() != null) {
        actionStr = intent.getAction();
      }
    } catch (Exception e) {
      actionStr = "error: " + e.getMessage();
    }
    android.util.Log.d("MainActivity", "onNewIntent called with action: " + actionStr);

    // Safely extract and send the shared data
    try {
      if (intent != null) {
        String action = intent.getAction();
        if (action != null && action.equals(Intent.ACTION_SEND)) {
          String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
          String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

          android.util.Log.d("MainActivity", "Share intent - text: " + sharedText + ", subject: " + sharedSubject);

          if (sharedText != null || sharedSubject != null) {
            sendShareToJS(sharedText, sharedSubject);
          }
        }
      }
    } catch (Exception e) {
      android.util.Log.e("MainActivity", "Error in onNewIntent: " + e.getMessage());
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    android.util.Log.d("MainActivity", "onResume called, checking for pending share");

    // Check if there's pending share data to send
    if (pendingShareText != null || pendingShareSubject != null) {
      android.util.Log.d("MainActivity", "Found pending share data, attempting to send");
      // Delay slightly to ensure React is ready
      new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
        @Override
        public void run() {
          String text = pendingShareText;
          String subject = pendingShareSubject;
          if (text != null || subject != null) {
            sendShareToJS(text, subject);
          }
        }
      }, 500);
    }

    // Also check current intent in case app was launched fresh with share
    try {
      Intent intent = getIntent();
      if (intent != null) {
        String action = intent.getAction();
        if (action != null && action.equals(Intent.ACTION_SEND)) {
          String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
          if (sharedText != null && pendingShareText == null) {
            android.util.Log.d("MainActivity", "onResume found share in current intent: " + sharedText);
            String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            // Delay to ensure React is ready
            final String finalText = sharedText;
            final String finalSubject = sharedSubject;
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
              @Override
              public void run() {
                sendShareToJS(finalText, finalSubject);
              }
            }, 500);
          }
        }
      }
    } catch (Exception e) {
      android.util.Log.e("MainActivity", "Error checking intent in onResume: " + e.getMessage());
    }
  }
`;

    // Insert static methods and onNewIntent/onResume after onCreate
    modifiedContents =
      modifiedContents.slice(0, insertIndex) +
      staticPendingShare +
      onNewIntentCode +
      modifiedContents.slice(insertIndex);

    mainActivity.contents = modifiedContents;

    console.log('✅ Added onNewIntent handler with pending share support to MainActivity');
    return config;
  });
};

module.exports = withOnNewIntent;

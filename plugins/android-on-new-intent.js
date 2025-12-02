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

    // Remove any existing onNewIntent to replace with our version
    // The library's onNewIntent causes NullPointerException with singleTask mode
    let modifiedContents = contents;
    if (contents.includes('onNewIntent(')) {
      console.log('ℹ️ Removing existing onNewIntent to replace with our version');
      // Find and remove the existing onNewIntent method
      const onNewIntentStart = contents.indexOf('@Override\n  protected void onNewIntent(');
      if (onNewIntentStart === -1) {
        // Try alternate format
        const altStart = contents.indexOf('protected void onNewIntent(');
        if (altStart !== -1) {
          console.log('⚠️ Found onNewIntent without @Override, will add our version anyway');
        }
      } else {
        // Find the end of the method (matching closing brace)
        let braceCount = 0;
        let methodEnd = onNewIntentStart;
        let foundStart = false;
        for (let i = onNewIntentStart; i < contents.length; i++) {
          if (contents[i] === '{') {
            braceCount++;
            foundStart = true;
          }
          if (contents[i] === '}') {
            braceCount--;
            if (foundStart && braceCount === 0) {
              methodEnd = i + 1;
              break;
            }
          }
        }
        // Remove the existing method
        modifiedContents = contents.slice(0, onNewIntentStart) + contents.slice(methodEnd);
        console.log('✅ Removed existing onNewIntent method');
      }
    }

    // Find the onCreate method to insert after it
    const onCreateIndex = modifiedContents.indexOf('super.onCreate(');
    if (onCreateIndex === -1) {
      console.warn('⚠️ Could not find onCreate method in MainActivity');
      return config;
    }

    // Find the end of onCreate method (closing brace)
    let braceCount = 0;
    let insertIndex = onCreateIndex;
    for (let i = onCreateIndex; i < modifiedContents.length; i++) {
      if (modifiedContents[i] === '{') braceCount++;
      if (modifiedContents[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          insertIndex = i + 1;
          break;
        }
      }
    }

    // Import statement for Intent
    const importStatement = 'import android.content.Intent;';

    // Add import if not present
    if (!modifiedContents.includes(importStatement)) {
      const packageIndex = modifiedContents.indexOf('package ');
      const firstImportIndex = modifiedContents.indexOf('import ', packageIndex);
      if (firstImportIndex !== -1) {
        modifiedContents =
          modifiedContents.slice(0, firstImportIndex) +
          importStatement + '\n' +
          modifiedContents.slice(firstImportIndex);
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
    sendShareToJSWithRetry(text, subject, 0);
  }

  private void sendShareToJSWithRetry(final String text, final String subject, final int attempt) {
    android.util.Log.d("MainActivity", "sendShareToJS attempt " + attempt + " - text: " + text);

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
        android.util.Log.d("MainActivity", "SUCCESS: Sent share data to JS on attempt " + attempt);

        // Clear pending since we sent it
        clearPendingShare();
      } else {
        android.util.Log.w("MainActivity", "React context not ready on attempt " + attempt);

        // Retry up to 5 times with increasing delays
        if (attempt < 5) {
          int delay = (attempt + 1) * 500; // 500ms, 1000ms, 1500ms, 2000ms, 2500ms
          android.util.Log.d("MainActivity", "Scheduling retry in " + delay + "ms");
          storePendingShare(text, subject);

          new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
              sendShareToJSWithRetry(text, subject, attempt + 1);
            }
          }, delay);
        } else {
          android.util.Log.e("MainActivity", "Failed to send after 5 attempts, storing for later");
          storePendingShare(text, subject);
        }
      }
    } catch (Exception e) {
      android.util.Log.e("MainActivity", "Error sending to JS on attempt " + attempt + ": " + e.getMessage());

      if (attempt < 5) {
        int delay = (attempt + 1) * 500;
        storePendingShare(text, subject);

        final int nextAttempt = attempt + 1;
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
          @Override
          public void run() {
            sendShareToJSWithRetry(text, subject, nextAttempt);
          }
        }, delay);
      } else {
        storePendingShare(text, subject);
      }
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
    android.util.Log.d("MainActivity", "=== onResume called ===");

    // Check current intent for share data
    // This handles both fresh launches and when coming back from background
    try {
      Intent intent = getIntent();
      if (intent != null) {
        String action = intent.getAction();
        android.util.Log.d("MainActivity", "onResume intent action: " + action);

        if (action != null && action.equals(Intent.ACTION_SEND)) {
          String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
          String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);

          android.util.Log.d("MainActivity", "onResume found SEND intent - text: " + sharedText);

          if (sharedText != null) {
            // Mark this intent as processed by clearing the action
            intent.setAction("");
            setIntent(intent);

            android.util.Log.d("MainActivity", "Processing share from onResume...");
            final String finalText = sharedText;
            final String finalSubject = sharedSubject;

            // Use retry mechanism with delays to ensure React is ready
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
              @Override
              public void run() {
                sendShareToJS(finalText, finalSubject);
              }
            }, 300);
          }
        }
      }
    } catch (Exception e) {
      android.util.Log.e("MainActivity", "Error in onResume: " + e.getMessage());
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

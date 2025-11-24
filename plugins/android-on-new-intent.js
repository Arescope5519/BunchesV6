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
   * This is critical for share intents to work when app is in background
   */
  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
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

const { withMainActivity } = require('@expo/config-plugins');

/**
 * Android share intent handler
 *
 * A shared URL has to reach JavaScript in two very different situations:
 *
 *   warm - the app is already running. The React context exists, so
 *          emitting 'newShareIntent' works immediately.
 *   cold - the share LAUNCHED the app. There is no JS runtime yet, so an
 *          emitted event goes nowhere and the share is silently lost.
 *
 * The cold case is handled by rewriting the ACTION_SEND intent into a
 * "<scheme>://share?url=..." ACTION_VIEW intent. React Native's own
 * Linking module then delivers it through getInitialURL(), which JS
 * PULLS when it is ready - so it cannot be missed the way a pushed
 * event can. iOS already worked this way; this makes Android match.
 */
const withAndroidOnNewIntent = (config) => {
  const scheme = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
  if (!scheme) {
    throw new Error('[android-on-new-intent] expo.scheme is required for share intents');
  }

  return withMainActivity(config, (config) => {
    const mainActivity = config.modResults;
    const isKotlin = mainActivity.language === 'kt' || mainActivity.path?.endsWith('.kt');

    // Add required imports
    const requiredImports = [
      'import android.content.Intent',
      'import android.net.Uri',
      'import com.facebook.react.bridge.Arguments',
      'import com.facebook.react.modules.core.DeviceEventManagerModule',
    ];

    // Imports are inserted after android.os.Bundle. If Expo ever stops
    // emitting that line the anchor disappears, and silently skipping
    // the imports would surface as an unrelated Kotlin compile error
    // much later - so fail here instead.
    const anchor = isKotlin ? 'import android.os.Bundle' : 'import android.os.Bundle;';
    if (!mainActivity.contents.includes(anchor)) {
      throw new Error(
        `[android-on-new-intent] cannot find "${anchor}" in MainActivity - ` +
        'the import anchor changed, so share intents would not compile.'
      );
    }

    for (const importStatement of requiredImports) {
      if (!mainActivity.contents.includes(importStatement)) {
        mainActivity.contents = mainActivity.contents.replace(
          anchor,
          isKotlin
            ? `${anchor}\n${importStatement}`
            : `${anchor}\n${importStatement};`
        );
      }
    }
    console.log('✅ Added required imports to MainActivity');

    // Add onNewIntent if not present
    if (!mainActivity.contents.includes('onNewIntent')) {
      const classEndIndex = mainActivity.contents.lastIndexOf('}');

      let methods;
      if (isKotlin) {
        methods = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleShareIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    // Rewrites a launch share into a deep link before JS asks for it.
    handleShareIntent(intent)
  }

  private fun handleShareIntent(intent: Intent?) {
    if (intent?.action == Intent.ACTION_SEND && intent.type == "text/plain") {
      val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
      if (sharedText != null) {
        // Rewrite into a deep link React Native's Linking module can
        // hand to JS via getInitialURL(). This is what makes a cold
        // start work: JS pulls the URL when it is ready, instead of us
        // pushing an event into a runtime that does not exist yet.
        // It also stops the intent being reprocessed, since the action
        // is no longer ACTION_SEND.
        intent.action = Intent.ACTION_VIEW
        intent.data = Uri.parse("${scheme}://share?url=" + Uri.encode(sharedText))
        intent.removeExtra(Intent.EXTRA_TEXT)

        // Warm path: if JS is already running, this arrives immediately
        // rather than waiting for the next Linking event.
        emitShareIntent(sharedText)
      }
    }
  }

  private fun emitShareIntent(sharedText: String) {
    try {
      // A null context means the share LAUNCHED the app. Do not queue it
      // here - the rewritten intent reaches JS through
      // Linking.getInitialURL() instead, and delivering by both routes
      // imports the same recipe twice.
      reactInstanceManager?.currentReactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("newShareIntent", sharedText)
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
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("${scheme}://share?url=" + Uri.encode(sharedText)));
        intent.removeExtra(Intent.EXTRA_TEXT);
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

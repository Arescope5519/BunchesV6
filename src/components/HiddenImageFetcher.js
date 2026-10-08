/**
 * FILENAME: src/components/HiddenImageFetcher.js
 * PURPOSE: Invisible WebView that downloads bot-walled recipe photos.
 *
 * Akamai-fronted CDNs (food.fnr.sndimg.com for all of Food Network)
 * 403 the app's own HTTP stack by TLS/HTTP2 fingerprint - no header
 * disguise helps - while Chrome on the same phone loads the images
 * fine. Proxies don't help either: the CDN geo-blocks them (451).
 * The system WebView IS Chromium, so navigating it to the image URL
 * downloads through the exact network stack Chrome uses. The injected
 * script then re-fetches location.href (same-origin with the page at
 * that point, normally served from cache) and posts the bytes back as
 * base64 for upload to our storage bucket.
 *
 * Mounted once in App.js. Jobs arrive through
 * utils/webviewImageFetcher.js and run one at a time.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { setWebViewImageFetcher } from '../utils/webviewImageFetcher';
import { dbg } from '../utils/debugLog';

const TIMEOUT_MS = 25000;
const MAX_BYTES = 10 * 1024 * 1024;

// Match real Chrome - the default WebView UA carries a "wv" marker
// that bot walls key on, even though the TLS stack is identical.
const CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const INJECTED = `
(function () {
  function send(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  try {
    fetch(location.href, { credentials: 'include' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      })
      .then(function (b) {
        if (b.size > ${MAX_BYTES}) throw new Error('too large: ' + b.size);
        var fr = new FileReader();
        fr.onload = function () {
          var s = String(fr.result);
          send({ ok: true, type: b.type, base64: s.slice(s.indexOf(',') + 1) });
        };
        fr.onerror = function () { send({ ok: false, error: 'blob read failed' }); };
        fr.readAsDataURL(b);
      })
      .catch(function (e) { send({ ok: false, error: String((e && e.message) || e) }); });
  } catch (e) {
    send({ ok: false, error: String(e) });
  }
})();
true;
`;

let jobSeq = 0;

const HiddenImageFetcher = () => {
  const [job, setJob] = useState(null);
  const jobRef = useRef(null);
  const queueRef = useRef([]);
  const timerRef = useRef(null);

  const start = (next) => {
    jobRef.current = next;
    setJob(next);
    timerRef.current = setTimeout(() => finish(null, 'webview timeout'), TIMEOUT_MS);
  };

  const finish = (result, error) => {
    const current = jobRef.current;
    if (!current) return;
    jobRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setJob(null);
    if (error) current.reject(new Error(error));
    else current.resolve(result);
    const next = queueRef.current.shift();
    if (next) start(next);
  };

  useEffect(() => {
    setWebViewImageFetcher(
      (url) =>
        new Promise((resolve, reject) => {
          const next = { id: ++jobSeq, url, resolve, reject };
          if (jobRef.current) queueRef.current.push(next);
          else start(next);
        })
    );
    return () => {
      setWebViewImageFetcher(null);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!job) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
    >
      <WebView
        key={job.id}
        source={{ uri: job.url }}
        userAgent={CHROME_UA}
        injectedJavaScript={INJECTED}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        originWhitelist={['*']}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.ok && msg.base64) {
              dbg('WEBVIEW', 'fetched', msg.type || 'no type', `${msg.base64.length} b64 chars`);
              finish({ base64: msg.base64, contentType: msg.type || '' });
            } else {
              finish(null, msg.error || 'webview fetch failed');
            }
          } catch {
            finish(null, 'bad webview message');
          }
        }}
        onHttpError={(e) => finish(null, `page HTTP ${e?.nativeEvent?.statusCode}`)}
        onError={(e) => finish(null, e?.nativeEvent?.description || 'webview load error')}
        style={{ width: 1, height: 1, opacity: 0 }}
      />
    </View>
  );
};

export default HiddenImageFetcher;

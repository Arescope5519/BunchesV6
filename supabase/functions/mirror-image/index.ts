// deno-lint-ignore-file no-explicit-any
/**
 * FILENAME: supabase/functions/mirror-image/index.ts
 * PURPOSE: Copy an external recipe photo into our own Supabase
 * Storage and return its public URL.
 *
 * Why server-side: bot-walled image CDNs (Akamai fronting
 * food.fnr.sndimg.com, for one) fingerprint the phone's HTTP stack
 * and refuse the app's image requests - the same URL loads in Chrome
 * on the same device. No client-side header can fake that, so the
 * app asks this function to fetch the image from here and re-host it
 * in the 'recipe-images' bucket. Recipes then point at our bucket,
 * which also survives source sites moving or deleting their files.
 *
 * Called with { url }. Returns { success: true, url } (the re-hosted
 * public URL) or { success: false, error }. The app treats any
 * failure as "keep the original URL" - this is best-effort.
 *
 * Deploy (dashboard): create function "mirror-image", Verify JWT ON.
 * Needs no extra secrets (uses the built-in SUPABASE_* env vars).
 * Requires the public 'recipe-images' storage bucket to exist
 * (sql/add_recipe_images_bucket.sql).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB cap - recipe photos, not videos
const FETCH_TIMEOUT_MS = 15000;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ success: false, error: 'method_not_allowed' }, 405);
  }

  try {
    // Authenticated users only - this must not be an open proxy
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }
    const userId = userData.user.id;

    const { url } = await req.json();
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return json({ success: false, error: 'invalid_url' }, 400);
    }
    // Never re-mirror our own storage
    if (url.includes('.supabase.co/')) {
      return json({ success: true, url });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      return json({ success: false, error: `fetch_failed_${res.status}` }, 200);
    }

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) {
      return json({ success: false, error: 'not_an_image' }, 200);
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
      return json({ success: false, error: 'bad_size' }, 200);
    }

    const ext = EXT_BY_TYPE[contentType] || 'jpg';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('recipe-images')
      .upload(path, buf, { contentType, upsert: false });
    if (upErr) {
      console.error('mirror-image upload error:', upErr);
      return json({ success: false, error: 'upload_failed' }, 200);
    }

    const { data: pub } = supabase.storage.from('recipe-images').getPublicUrl(path);
    return json({ success: true, url: pub.publicUrl });
  } catch (err) {
    console.error('mirror-image error:', err);
    return json({ success: false, error: 'internal' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// deno-lint-ignore-file no-explicit-any
/**
 * FILENAME: supabase/functions/moderate-image/index.ts
 * PURPOSE: Sightengine image moderation proxy
 *
 * Called by the app with a base64 image. Runs it through Sightengine
 * using API credentials stored in Supabase env vars (never in the app).
 *
 * Deploy:
 *   supabase functions deploy moderate-image
 *
 * Set secrets (one-time):
 *   supabase secrets set SIGHTENGINE_API_USER=...
 *   supabase secrets set SIGHTENGINE_API_SECRET=...
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODELS = 'nudity-2.1,offensive,gore,weapon';

const THRESHOLDS: Record<string, number> = {
  nudity_raw: 0.4,          // Explicit nudity - strict
  nudity_sexual: 0.3,       // Sexual acts/display - strict
  nudity_suggestive: 0.5,   // Suggestive (bikinis, lingerie, cleavage) - moderate
  nudity_partial: 0.5,      // Partial nudity - moderate
  offensive: 0.5,           // Offensive gestures/symbols
  gore: 0.5,                // Gore/violence
  weapon: 0.7,              // Weapons (kitchen knives get through)
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const apiUser = Deno.env.get('SIGHTENGINE_API_USER');
    const apiSecret = Deno.env.get('SIGHTENGINE_API_SECRET');

    if (!apiUser || !apiSecret) {
      console.warn('Sightengine credentials not configured');
      return json({ safe: true, reason: null, scores: null }, 200);
    }

    const body = await req.json();
    const imageBase64: string | undefined = body?.imageBase64;

    if (!imageBase64) {
      return json({ error: 'Missing imageBase64' }, 400);
    }

    // Sightengine accepts base64 via a specific parameter format
    const formData = new FormData();
    formData.append('models', MODELS);
    formData.append('api_user', apiUser);
    formData.append('api_secret', apiSecret);

    // Convert base64 to blob for the media field
    const binary = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([binary], { type: 'image/jpeg' });
    formData.append('media', blob, 'image.jpg');

    const res = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: formData,
    });

    const result: any = await res.json();

    if (result.status !== 'success') {
      console.error('Sightengine API error:', result.error);
      return json({ safe: true, reason: null, scores: null }, 200);
    }

    // Log raw response for tuning thresholds
    console.log('Sightengine raw scores:', JSON.stringify({
      nudity: result.nudity,
      offensive: result.offensive,
      gore: result.gore,
      weapon: result.weapon,
    }));

    const scores = {
      nudity_raw: Math.max(
        result.nudity?.raw || 0,
        result.nudity?.sexual_display || 0,
      ),
      nudity_sexual: Math.max(
        result.nudity?.sexual_activity || 0,
        result.nudity?.sexual_display || 0,
        result.nudity?.erotica || 0,
      ),
      nudity_suggestive: Math.max(
        result.nudity?.suggestive || 0,
        result.nudity?.mildly_suggestive || 0,
      ),
      nudity_partial: result.nudity?.partial || result.nudity?.partial_nudity || 0,
      offensive: result.offensive?.prob || 0,
      gore: result.gore?.prob || 0,
      weapon: result.weapon?.classes?.firearm || result.weapon?.prob || 0,
    };

    const violations: string[] = [];
    if (scores.nudity_raw > THRESHOLDS.nudity_raw) violations.push('explicit content');
    if (scores.nudity_sexual > THRESHOLDS.nudity_sexual) violations.push('sexual content');
    if (scores.nudity_suggestive > THRESHOLDS.nudity_suggestive) violations.push('suggestive content');
    if (scores.nudity_partial > THRESHOLDS.nudity_partial) violations.push('partial nudity');
    if (scores.offensive > THRESHOLDS.offensive) violations.push('offensive content');
    if (scores.gore > THRESHOLDS.gore) violations.push('gore/violence');
    if (scores.weapon > THRESHOLDS.weapon) violations.push('weapons');

    if (violations.length > 0) {
      return json({ safe: false, reason: violations.join(', '), scores }, 200);
    }

    return json({ safe: true, reason: null, scores }, 200);
  } catch (err) {
    console.error('moderate-image error:', err);
    return json({ safe: true, reason: null, scores: null }, 200);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

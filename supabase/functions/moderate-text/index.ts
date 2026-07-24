// deno-lint-ignore-file no-explicit-any
/**
 * FILENAME: supabase/functions/moderate-text/index.ts
 * PURPOSE: OpenAI text moderation proxy
 *
 * Called by the app with either { text: string } or { texts: string[] }.
 * Runs through OpenAI's /moderations endpoint using an API key stored in
 * Supabase env vars (never in the app).
 *
 * Deploy:
 *   supabase functions deploy moderate-text
 *
 * Set secret (one-time):
 *   supabase secrets set OPENAI_API_KEY=sk-...
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BLOCKED_CATEGORIES = [
  'hate',
  'hate/threatening',
  'harassment',
  'harassment/threatening',
  'sexual',
  'sexual/minors',
  'violence/graphic',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
      console.warn('OpenAI API key not configured');
      return json({ safe: true, flags: [] }, 200);
    }

    const body = await req.json();
    let input: string | string[];

    if (typeof body?.text === 'string') {
      input = body.text;
    } else if (Array.isArray(body?.texts)) {
      input = body.texts;
    } else {
      return json({ error: 'Missing text or texts field' }, 400);
    }

    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input,
        model: 'omni-moderation-latest',
      }),
    });

    if (!res.ok) {
      console.error('OpenAI HTTP error:', res.status);
      return json({ safe: true, flags: [] }, 200);
    }

    const data: any = await res.json();
    const results = data?.results || [];

    // For array input: return per-index flags. For single: return same shape at index 0.
    const flags = results.map((result: any) => {
      const categories = BLOCKED_CATEGORIES.filter((c) => result.categories?.[c]);
      return {
        safe: categories.length === 0,
        reason: categories.length > 0 ? categories.join(', ') : null,
      };
    });

    const anyFlagged = flags.some((f: any) => !f.safe);

    return json({
      safe: !anyFlagged,
      flags,
    }, 200);
  } catch (err) {
    console.error('moderate-text error:', err);
    return json({ safe: true, flags: [] }, 200);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

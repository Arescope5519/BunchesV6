// deno-lint-ignore-file no-explicit-any
/**
 * FILENAME: supabase/functions/extract-recipe/index.ts
 * PURPOSE: AI recipe scanning - turns photos of cookbook pages / recipe
 * cards into a structured recipe via Google Gemini.
 *
 * Called by the app with 1-3 base64 photos. The Gemini key lives in
 * Supabase secrets (GEMINI_API_KEY), never in the app.
 *
 * Rate limits (enforced here, not in the app):
 *   Free    - 3 scans lifetime
 *   Premium - 30 scans per calendar month
 *   Admin   - unlimited
 * Usage is recorded in the scan_usage table (see sql/add_scan_usage.sql).
 *
 * Deploy (dashboard): create function "extract-recipe", Verify JWT ON.
 * Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional, defaults
 * to gemini-2.5-flash).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FREE_LIFETIME_LIMIT = 3;
const PREMIUM_MONTHLY_LIMIT = 30;
const MAX_IMAGES = 3;
// ~4MB of raw image per photo once base64 is decoded
const MAX_BASE64_LENGTH = 5_500_000;

const PROMPT = `You are a recipe extraction system. The attached photo(s) show a recipe - a cookbook page, a recipe card, a handwritten note, or a screenshot. Multiple photos are pages of the SAME recipe, in order.

Extract the recipe and reply with ONLY a JSON object in exactly this shape:
{
  "found": true,
  "title": "Recipe name",
  "ingredient_sections": [
    { "name": "main", "items": ["1 cup flour", "2 eggs"] }
  ],
  "instructions": ["Step one...", "Step two..."],
  "prep_time": "15 min",
  "cook_time": "30 min",
  "total_time": "45 min",
  "servings": "4",
  "notes": "",
  "confidence": "high",
  "warnings": []
}

Rules:
- If the photos do not contain a recipe, reply {"found": false}.
- Preserve exact quantities and wording from the source. Do not invent ingredients or steps that are not visible.
- Use ingredient section names from the source when present (e.g. "For the sauce"); otherwise use one section named "main".
- Times/servings: only fill what is actually printed; leave "" when absent.
- notes: any tips/variations printed with the recipe, else "".
- confidence: "high" if everything was clearly legible, "medium" if some parts were hard to read, "low" if you had to guess significantly.
- warnings: short strings for anything the user should double-check (e.g. "step 6 partially cut off", "quantity for butter unclear").`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return json({ success: false, error: 'not_configured', message: 'Recipe scanning is not configured yet.' }, 500);
    }

    // --- Identify the caller (Verify JWT is ON, so the token is valid) ---
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return json({ success: false, error: 'unauthorized', message: 'You must be signed in to scan recipes.' }, 401);
    }

    // --- Rate limiting ---
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_premium, premium_until, is_admin')
      .eq('user_id', user.id)
      .single();

    const isAdmin = !!profile?.is_admin;
    const premiumActive = !!profile?.is_premium &&
      (!profile?.premium_until || new Date(profile.premium_until) > new Date());

    let scansUsed = 0;
    let scanLimit = FREE_LIFETIME_LIMIT;

    if (!isAdmin) {
      if (premiumActive) {
        scanLimit = PREMIUM_MONTHLY_LIMIT;
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('scan_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', monthStart.toISOString());
        scansUsed = count || 0;
      } else {
        const { count } = await supabase
          .from('scan_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        scansUsed = count || 0;
      }

      if (scansUsed >= scanLimit) {
        return json({
          success: false,
          error: 'limit_reached',
          message: premiumActive
            ? `You've used all ${scanLimit} scans for this month.`
            : `You've used all ${scanLimit} free scans. Premium includes ${PREMIUM_MONTHLY_LIMIT} scans every month.`,
          scansUsed,
          scanLimit,
          premium: premiumActive,
        }, 429);
      }
    }

    // --- Validate input ---
    const body = await req.json();
    const images: string[] = Array.isArray(body?.images) ? body.images : [];
    const mimeType: string = typeof body?.mimeType === 'string' ? body.mimeType : 'image/jpeg';

    if (images.length === 0) {
      return json({ success: false, error: 'no_images', message: 'No photos were provided.' }, 400);
    }
    if (images.length > MAX_IMAGES) {
      return json({ success: false, error: 'too_many_images', message: `Up to ${MAX_IMAGES} photos per scan.` }, 400);
    }
    for (const img of images) {
      if (typeof img !== 'string' || img.length === 0 || img.length > MAX_BASE64_LENGTH) {
        return json({ success: false, error: 'image_too_large', message: 'One of the photos is too large.' }, 400);
      }
    }

    // --- Call Gemini ---
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    const parts: any[] = [{ text: PROMPT }];
    for (const img of images) {
      parts.push({ inline_data: { mime_type: mimeType, data: img } });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json',
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText.substring(0, 500));
      return json({ success: false, error: 'ai_error', message: 'The AI service had a problem. Please try again.' }, 502);
    }

    const geminiData: any = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the model's JSON (strip markdown fences defensively)
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim());
    } catch (_e) {
      console.error('Could not parse Gemini response:', rawText.substring(0, 300));
    }

    // Record the attempt - the AI call cost money either way
    const found = !!parsed?.found && !!parsed?.title;
    await supabase.from('scan_usage').insert({
      user_id: user.id,
      success: found,
      model,
    });
    scansUsed += 1;

    if (!parsed) {
      return json({
        success: false,
        error: 'parse_error',
        message: 'Could not read a recipe from the response. Please try again.',
        scansUsed, scanLimit,
      }, 200);
    }

    if (!found) {
      return json({
        success: false,
        error: 'no_recipe',
        message: 'No recipe was found in the photo. Try a clearer shot of the full recipe.',
        scansUsed, scanLimit,
      }, 200);
    }

    return json({
      success: true,
      recipe: {
        title: String(parsed.title || 'Untitled Recipe'),
        ingredient_sections: Array.isArray(parsed.ingredient_sections) ? parsed.ingredient_sections : [],
        instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
        prep_time: String(parsed.prep_time || ''),
        cook_time: String(parsed.cook_time || ''),
        total_time: String(parsed.total_time || ''),
        servings: String(parsed.servings || ''),
        notes: String(parsed.notes || ''),
      },
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      scansUsed,
      scanLimit,
    }, 200);
  } catch (err) {
    console.error('extract-recipe error:', err);
    return json({ success: false, error: 'internal', message: 'Something went wrong. Please try again.' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

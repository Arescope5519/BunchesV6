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
 *   Free    - 5 SUCCESSFUL photo scans AND 5 successful Instagram
 *             imports, lifetime - separate buckets (12 attempts each)
 *   Premium - 100 SUCCESSFUL extractions per calendar month, combined
 *             (150 attempts)
 *   Admin   - unlimited
 *
 * Only scans that actually returned a recipe spend the allowance;
 * attempts are capped separately so failures being free cannot be
 * farmed. The caps exist to stop abuse, not to ration a paid feature -
 * a scan costs fractions of a cent and people digitise cookbooks in
 * bursts, so set them where only abuse reaches them.
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

// Free allowances are PER KIND ('photo' scans and 'text'/Instagram
// imports are separate buckets); premium's monthly pool is combined.
const FREE_LIFETIME_LIMIT = 5;
const PREMIUM_MONTHLY_LIMIT = 100;

// Ceilings on TOTAL attempts, successful or not. Failed scans do not
// spend the allowance above, so these are what stop that generosity
// being farmed with deliberately unreadable images. Also per kind for
// free accounts.
const FREE_ATTEMPT_CEILING = 12;
const PREMIUM_MONTHLY_ATTEMPT_CEILING = 150;

const SUPPORT_EMAIL = 'hello@melibri.app';
const MAX_IMAGES = 3;
// ~4MB of raw image per photo once base64 is decoded
const MAX_BASE64_LENGTH = 5_500_000;

const MAX_RECIPES = 5;

// Remembered across invocations while this function instance stays warm,
// so model discovery only runs when needed
let cachedWorkingModel: string | null = null;

/**
 * Ask the API which models THIS key can use, newest flash first.
 * Used when every known model name 404s (Google retires names for new
 * users - e.g. "gemini-2.5-flash is no longer available to new users").
 */
async function discoverFlashModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) {
      console.error('ListModels failed:', res.status);
      return [];
    }
    const data: any = await res.json();
    return (data.models || [])
      .filter((m: any) =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter((n: string) => /flash/i.test(n))
      .filter((n: string) => !/(embedding|tts|audio|image-generation|native-audio|live|preview-image)/i.test(n))
      .sort()
      .reverse(); // rough newest-first (version numbers sort well enough)
  } catch (err) {
    console.error('ListModels error:', err);
    return [];
  }
}

const PROMPT = `You are a recipe extraction system. The attached photo(s) show recipe content - cookbook pages, recipe cards, handwritten notes, or screenshots. Photos may be consecutive pages of ONE recipe, or may contain SEVERAL distinct recipes (e.g. two recipes printed on one page).

Extract every distinct recipe and reply with ONLY a JSON object in exactly this shape:
{
  "found": true,
  "recipes": [
    {
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
  ]
}

Rules:
- Reply {"found": false} ONLY when the photos contain no recipe content at all.
- A PARTIAL recipe still counts as found. If only part of a recipe is
  visible (page cut off, instructions missing, only an ingredient list),
  extract exactly what IS visible, set confidence to "low", and add a
  warning that starts with "Partial recipe:" describing what is missing
  (e.g. "Partial recipe: instructions not visible in the photo"). Never
  invent the missing parts.
- A recipe continuing across multiple photos is ONE recipe - merge its pages in order. Only output multiple entries for genuinely distinct recipes.
- Preserve exact quantities and wording from the source. Do not invent ingredients or steps that are not visible.
- Use ingredient section names from the source when present (e.g. "For the sauce"); otherwise use one section named "main".
- Times/servings: only fill what is actually printed; leave "" when absent.
- notes: any tips/variations printed with the recipe, else "".
- confidence per recipe: "high" if everything was clearly legible, "medium" if some parts were hard to read, "low" if you had to guess significantly.
- warnings per recipe: short strings for anything the user should double-check (e.g. "step 6 partially cut off", "quantity for butter unclear"). If a recipe appears to continue onto a page that was NOT photographed, add a warning like "recipe may continue on another page".`;

// Text mode: the same extraction, but the source is a social-media
// caption (Instagram imports) instead of photos.
const TEXT_PROMPT = `You are a recipe extraction system. Below is the text of a social media post (an Instagram caption or similar) that may contain one or more recipes, mixed with chatter, emojis, hashtags and calls to follow.

Extract every distinct recipe and reply with ONLY a JSON object in exactly this shape:
{
  "found": true,
  "recipes": [
    {
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
  ]
}

Rules:
- Reply {"found": false} ONLY when the text contains no recipe content at all (e.g. just "recipe in comments" or "link in bio" - add nothing you cannot see).
- A PARTIAL recipe still counts as found: extract exactly what IS present, set confidence to "low", and add a warning starting with "Partial recipe:" describing what is missing. Never invent the missing parts.
- Preserve exact quantities and wording. Strip emojis, hashtags and decorative symbols from the output, but keep the cooking content intact.
- Use ingredient section names from the text when present (e.g. "For the sauce"); otherwise one section named "main".
- Times/servings: only fill what the text states; leave "" when absent.
- notes: tips/variations stated with the recipe, else "".
- confidence per recipe: "high" when the recipe was stated clearly and completely, "medium" when parts were ambiguous, "low" when you had to guess significantly.
- warnings per recipe: short strings for anything worth double-checking (e.g. "no quantities given for spices").`;

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

    // --- Validate input (before rate limiting - the limits are
    // per KIND, so the kind must be known first) ---
    const body = await req.json();
    const images: string[] = Array.isArray(body?.images) ? body.images : [];
    const mimeType: string = typeof body?.mimeType === 'string' ? body.mimeType : 'image/jpeg';
    // Text mode (Instagram captions): `text` instead of `images`
    const captionText: string = typeof body?.text === 'string' ? body.text.trim().slice(0, 10000) : '';
    const scanKind: 'photo' | 'text' = captionText ? 'text' : 'photo';
    const kindLabel = scanKind === 'text' ? 'Instagram imports' : 'photo scans';

    if (images.length === 0 && !captionText) {
      return json({ success: false, error: 'no_images', message: 'No photos or text were provided.' }, 400);
    }
    if (images.length > MAX_IMAGES) {
      return json({ success: false, error: 'too_many_images', message: `Up to ${MAX_IMAGES} photos per scan.` }, 400);
    }
    for (const img of images) {
      if (typeof img !== 'string' || img.length === 0 || img.length > MAX_BASE64_LENGTH) {
        return json({ success: false, error: 'image_too_large', message: 'One of the photos is too large.' }, 400);
      }
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
      // Only scans that actually produced a recipe count against the
      // allowance - a blurry photo the AI could not read is our failure,
      // not the user's, and burning one of three on it is how someone
      // decides the feature is broken and stops trying.
      //
      // Attempts are counted separately against a higher ceiling, so
      // "failures are free" cannot be turned into unlimited free calls
      // by feeding it garbage on purpose.
      let attemptCeiling = FREE_ATTEMPT_CEILING;
      let windowStart: string | null = null;

      if (premiumActive) {
        scanLimit = PREMIUM_MONTHLY_LIMIT;
        attemptCeiling = PREMIUM_MONTHLY_ATTEMPT_CEILING;
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);
        windowStart = monthStart.toISOString();
      }

      const countUsage = async (successOnly: boolean) => {
        let q = supabase
          .from('scan_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        // Free allowances are separate buckets per kind (5 photo scans
        // AND 5 Instagram imports); premium's monthly pool is combined
        if (!premiumActive) q = q.eq('kind', scanKind);
        if (successOnly) q = q.eq('success', true);
        if (windowStart) q = q.gte('created_at', windowStart);
        const { count } = await q;
        return count || 0;
      };

      const attempts = await countUsage(false);
      scansUsed = await countUsage(true);

      if (scansUsed >= scanLimit) {
        return json({
          success: false,
          error: 'limit_reached',
          message: premiumActive
            ? `You've used all ${scanLimit} AI extractions for this month.`
            : `You've used all ${scanLimit} free ${kindLabel}. Premium includes ${PREMIUM_MONTHLY_LIMIT} AI extractions every month.`,
          scansUsed,
          scanLimit,
          premium: premiumActive,
        }, 429);
      }

      if (attempts >= attemptCeiling) {
        return json({
          success: false,
          error: 'attempt_limit',
          message: premiumActive
            ? 'Too many scan attempts this month. This resets on the 1st.'
            : `Scanning is paused on this account after ${attemptCeiling} attempts. Email ${SUPPORT_EMAIL} if that seems wrong.`,
          scansUsed,
          scanLimit,
          premium: premiumActive,
        }, 429);
      }
    }

    // --- Call Gemini ---
    // Model names come and go ("no longer available to new users"), so:
    // 1. try GEMINI_MODEL secret if set, else the last known-working
    //    model, else a static list of likely names
    // 2. if every name 404s, ask the API which models THIS key can use
    //    (ListModels) and try the best vision-capable flash model
    const configuredModel = Deno.env.get('GEMINI_MODEL');
    // Free-tier capacity comes and goes PER MODEL - when the headline
    // flash model answers 503 "high demand" (or just hangs), a sibling
    // or the lite models usually still have room. The list is walked
    // until one answers, inside an overall time budget.
    const staticCandidates = configuredModel
      ? [configuredModel]
      : [
          ...(cachedWorkingModel ? [cachedWorkingModel] : []),
          'gemini-flash-latest',
          'gemini-3-flash',
          'gemini-2.5-flash',
          'gemini-flash-lite-latest',
          'gemini-2.5-flash-lite',
        ];
    const candidateModels = [...new Set(staticCandidates)];

    const parts: any[] = captionText
      ? [{ text: `${TEXT_PROMPT}\n\n--- POST TEXT ---\n${captionText}` }]
      : [{ text: PROMPT }];
    if (!captionText) {
      for (const img of images) {
        parts.push({ inline_data: { mime_type: mimeType, data: img } });
      }
    }
    const requestBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: 'application/json',
      },
    });

    // Hard deadline on each Gemini call. Without it a hang at Google's
    // end left the function silently stuck past the app's 90s timeout -
    // the user saw "scan is taking too long" and the logs saw nothing.
    // Short enough that several candidates fit inside the app's budget.
    const GEMINI_TIMEOUT_MS = 25_000;
    // Stop STARTING new candidates once a started call could no longer
    // finish before the app (90s) gives up
    const geminiStartedAt = Date.now();
    const outOfTime = () =>
      Date.now() - geminiStartedAt > 60_000 - GEMINI_TIMEOUT_MS;

    const callModel = (name: string) => {
      console.log('Calling Gemini:', name, '- payload', requestBody.length, 'bytes');
      return fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        },
      );
    };

    let geminiRes: Response | null = null;
    let model = candidateModels[0];
    let lastError = '';

    // Returns 'retry' to try the next model, otherwise a terminal Response.
    // Overload (503), rate limit (429) and retired names (404) all move
    // on to the next candidate - capacity and quotas are per model.
    // Only a rejected key/request (400/401/403) is terminal.
    const handleFailure = async (name: string, res: Response): Promise<'retry' | Response> => {
      const errText = await res.text();
      lastError = `${res.status}: ${errText.substring(0, 300)}`;
      console.error(`Gemini error for model ${name}:`, lastError);

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return json({
          success: false,
          error: 'ai_error',
          message: 'The AI service rejected the request - the API key may be invalid or restricted.',
          detail: lastError,
        }, 200);
      }
      return 'retry';
    };

    // Everything retryable failed - say whether it was capacity or weirder
    const allModelsFailed = () => {
      const busy = /503|429|UNAVAILABLE|high demand|overload|quota|exhaust/i.test(lastError);
      return json({
        success: false,
        error: busy ? 'ai_busy' : 'ai_error',
        message: busy
          ? 'The AI service is at capacity right now (free tier gets no priority). Try again in a minute.'
          : 'No available AI model accepted the request. You can pin one by setting the GEMINI_MODEL secret.',
        detail: lastError,
      }, 200);
    };

    const tryCandidates = async (names: string[]) => {
      for (const candidate of names) {
        if (outOfTime()) {
          console.log('Out of time budget before trying', candidate);
          break;
        }
        let res: Response;
        try {
          res = await callModel(candidate);
        } catch (fetchErr) {
          // Deadline hit or network failure - that model is hanging,
          // the next one may answer instantly
          lastError = `timeout/${String(fetchErr).substring(0, 120)}`;
          console.error('Gemini fetch failed for', candidate, ':', String(fetchErr));
          continue;
        }
        if (res.ok) {
          geminiRes = res;
          model = candidate;
          return null;
        }
        const outcome = await handleFailure(candidate, res);
        if (outcome !== 'retry') return outcome;
      }
      return null;
    };

    const terminal = await tryCandidates(candidateModels);
    if (terminal) return terminal;

    // Every known name failed - discover what this key can actually use
    if (!geminiRes && !outOfTime()) {
      console.log('All static model names failed - discovering available models...');
      const discovered = await discoverFlashModels(apiKey);
      console.log('Discovered candidates:', discovered.join(', ') || '(none)');

      const fresh = discovered.filter(m => !candidateModels.includes(m)).slice(0, 3);
      const terminal2 = await tryCandidates(fresh);
      if (terminal2) return terminal2;
    }

    if (!geminiRes) {
      return allModelsFailed();
    }

    cachedWorkingModel = model;
    console.log('Using Gemini model:', model);

    const geminiData: any = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the model's JSON (strip markdown fences defensively)
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim());
    } catch (_e) {
      console.error('Could not parse Gemini response:', rawText.substring(0, 300));
    }

    // Normalize: recipes[] preferred; tolerate a single-recipe object
    let rawRecipes: any[] = [];
    if (parsed?.found) {
      if (Array.isArray(parsed.recipes)) {
        rawRecipes = parsed.recipes;
      } else if (parsed.title) {
        rawRecipes = [parsed];
      }
    }
    rawRecipes = rawRecipes.filter((r: any) => r && r.title).slice(0, MAX_RECIPES);
    const found = rawRecipes.length > 0;

    // Record the attempt - the AI call cost money either way
    await supabase.from('scan_usage').insert({
      user_id: user.id,
      success: found,
      model,
      kind: scanKind,
    });
    if (found) scansUsed += 1;

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
      recipes: rawRecipes.map((r: any) => ({
        title: String(r.title || 'Untitled Recipe'),
        ingredient_sections: Array.isArray(r.ingredient_sections) ? r.ingredient_sections : [],
        instructions: Array.isArray(r.instructions) ? r.instructions : [],
        prep_time: String(r.prep_time || ''),
        cook_time: String(r.cook_time || ''),
        total_time: String(r.total_time || ''),
        servings: String(r.servings || ''),
        notes: String(r.notes || ''),
        confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'medium',
        warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
      })),
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

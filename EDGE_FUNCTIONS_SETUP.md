# Edge Functions Setup

The moderation API keys (Sightengine + OpenAI) now live inside Supabase and are accessed via Edge Functions. This prevents anyone from extracting the keys from your APK.

## Prerequisites

- Supabase CLI installed: https://supabase.com/docs/guides/cli
- You are logged in: `supabase login`
- Your project is linked: `supabase link --project-ref <your-project-ref>`
  (Find your project ref in the Supabase dashboard URL: `https://app.supabase.com/project/<ref>`)

## Deploy the functions

From the repo root:

```bash
supabase functions deploy moderate-image
supabase functions deploy moderate-text
```

Each command uploads the corresponding function in `supabase/functions/*/index.ts`.

## Set the secrets (one-time)

These are the values that used to live in `src/services/secrets.js` on your dev machine. They now live in Supabase and never leave.

```bash
supabase secrets set SIGHTENGINE_API_USER=your_sightengine_user
supabase secrets set SIGHTENGINE_API_SECRET=your_sightengine_secret
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
```

Verify:
```bash
supabase secrets list
```

## Deletion / cleanup

After deploying, you can delete the keys from `src/services/secrets.js` on your dev machine - they're no longer used. (Keeping them there is harmless since it's gitignored, but they're dead code now.)

## Redeploying after changes

If you edit either function:
```bash
supabase functions deploy moderate-image   # only if you changed this one
supabase functions deploy moderate-text
```

Redeploys are instant - no downtime for the app.

## Testing

To test a function locally before deploying:

```bash
supabase functions serve moderate-text --env-file ./supabase/.env.local
```

Then hit it with curl:
```bash
curl -X POST http://localhost:54321/functions/v1/moderate-text \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"text": "kill yourself"}'
```

Expected: `{"safe": false, "flags": [{"safe": false, "reason": "self-harm, ..."}]}`

## How the app calls them

The app uses `supabase.functions.invoke('moderate-image' | 'moderate-text', { body: {...} })`. Auth is handled automatically via the user's Supabase session token.

## Costs

- **Supabase Edge Functions free tier**: 500,000 invocations/month
- **After free tier**: $2 per 1M invocations
- **OpenAI Moderation**: still free (unchanged)
- **Sightengine**: still uses your account's quota (unchanged)

Effectively free unless you hit ~500K checks/month.

## Rate limiting (future improvement)

The functions don't currently rate-limit per user. To add:

1. Get `user_id` from the auth JWT (available at `req.headers.get('authorization')`)
2. Check against a Supabase table like `moderation_rate_limits` before running the check
3. Return `{ safe: true, rate_limited: true }` if user has exceeded (e.g., 100 checks/hour)

Add this before public launch if abuse becomes a concern.

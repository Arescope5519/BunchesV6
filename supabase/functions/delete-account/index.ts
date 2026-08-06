// deno-lint-ignore-file no-explicit-any
/**
 * FILENAME: supabase/functions/delete-account/index.ts
 * PURPOSE: In-app account deletion with a 30-day grace period.
 *
 * Actions:
 *   request - schedule deletion, hide the profile, keep all data
 *   status  - what the app shows on the countdown screen
 *   cancel  - restore the account, undoing request
 *   purge   - destroy everything for accounts past their date
 *
 * request/status/cancel authenticate with the caller's own JWT and can
 * only ever affect that caller. purge is the cron entry point and is
 * gated on a shared secret instead - it takes no user id, so a leaked
 * secret cannot be aimed at a specific account, only at accounts that
 * already asked to be deleted and whose 30 days have elapsed.
 *
 * Deploy:
 *   supabase functions deploy delete-account
 *
 * Secrets (one-time):
 *   supabase secrets set PURGE_SECRET=$(openssl rand -hex 32)
 *
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-purge-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GRACE_DAYS = 30;
const PHOTO_BUCKET = 'recipe-images';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

const admin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

/** Resolve the caller from their bearer token. */
async function requireUser(req: Request, sb: any) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Remove one user's photos. Paths are {userId}/{recipeId}.jpg, so the
 * user's id is the folder name.
 */
async function deleteUserPhotos(sb: any, userId: string) {
  const { data, error } = await sb.storage.from(PHOTO_BUCKET).list(userId, {
    limit: 1000,
  });
  if (error || !data?.length) return 0;

  const paths = data.map((f: any) => `${userId}/${f.name}`);
  const { error: rmError } = await sb.storage.from(PHOTO_BUCKET).remove(paths);
  if (rmError) throw rmError;
  return paths.length;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const sb = admin();
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // ---------------------------------------------------------------
    // purge - cron only
    // ---------------------------------------------------------------
    if (action === 'purge') {
      const secret = Deno.env.get('PURGE_SECRET');
      if (!secret) {
        console.error('PURGE_SECRET is not configured');
        return json({ error: 'Not configured' }, 500);
      }
      if (req.headers.get('x-purge-secret') !== secret) {
        return json({ error: 'Forbidden' }, 403);
      }

      const { data: due, error } = await sb
        .from('account_deletions')
        .select('user_id')
        .lte('purge_after', new Date().toISOString());

      if (error) throw error;

      const purged: string[] = [];
      const failed: { user_id: string; error: string }[] = [];

      for (const row of due ?? []) {
        const userId = row.user_id;
        try {
          // Photos first: once the auth user is gone we lose the id we
          // need to find them, and an orphaned object is the one thing
          // that would survive a "deleted" account.
          await deleteUserPhotos(sb, userId);

          const { error: rpcError } = await sb.rpc('purge_user_rows', {
            p_user_id: userId,
          });
          if (rpcError) throw rpcError;

          // Cascades account_deletions away via its FK.
          const { error: authError } = await sb.auth.admin.deleteUser(userId);
          if (authError) throw authError;

          purged.push(userId);
        } catch (e: any) {
          // One bad account must not stop the rest of the batch; it
          // stays due and is retried on the next run.
          console.error(`Purge failed for ${userId}:`, e?.message || e);
          failed.push({ user_id: userId, error: String(e?.message || e) });
        }
      }

      console.log(`Purge complete: ${purged.length} removed, ${failed.length} failed`);
      return json({ purged: purged.length, failed });
    }

    // ---------------------------------------------------------------
    // Everything below acts on the caller's own account
    // ---------------------------------------------------------------
    const user = await requireUser(req, sb);
    if (!user) return json({ error: 'Not signed in' }, 401);

    if (action === 'status') {
      const { data } = await sb
        .from('account_deletions')
        .select('requested_at, purge_after')
        .eq('user_id', user.id)
        .maybeSingle();
      return json({ pending: !!data, ...(data || {}) });
    }

    if (action === 'request') {
      const purgeAfter = new Date(
        Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      // Remember the current visibility so Restore is a true undo.
      const { data: profile } = await sb
        .from('user_profiles')
        .select('is_public')
        .eq('user_id', user.id)
        .maybeSingle();

      const { error } = await sb.from('account_deletions').upsert(
        {
          user_id: user.id,
          requested_at: new Date().toISOString(),
          purge_after: purgeAfter,
          prev_is_public: profile?.is_public ?? null,
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;

      // Hide them from search and public listings immediately - during
      // the grace period the account should already look gone to
      // everyone else.
      await sb
        .from('user_profiles')
        .update({ is_public: false })
        .eq('user_id', user.id);

      return json({ pending: true, purge_after: purgeAfter });
    }

    if (action === 'cancel') {
      const { data: row } = await sb
        .from('account_deletions')
        .select('prev_is_public')
        .eq('user_id', user.id)
        .maybeSingle();

      const { error } = await sb
        .from('account_deletions')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;

      if (row && row.prev_is_public !== null) {
        await sb
          .from('user_profiles')
          .update({ is_public: row.prev_is_public })
          .eq('user_id', user.id);
      }

      return json({ pending: false });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    console.error('delete-account error:', e?.message || e);
    return json({ error: e?.message || 'Unexpected error' }, 500);
  }
});

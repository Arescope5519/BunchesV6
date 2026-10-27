// deno-lint-ignore-file no-explicit-any
/**
 * FILENAME: supabase/functions/send-push/index.ts
 * PURPOSE: Deliver social push notifications through Expo's push
 * service. Called by Supabase DATABASE WEBHOOKS on inserts into:
 *   - shared_items          -> "@user shared a recipe with you"
 *   - friend_requests       -> "@user sent you a friend request"
 *   - shared_folder_members -> "@user invited you to <cookbook>"
 *     (status = 'invited' rows only)
 *
 * Deploy with JWT verification OFF (webhooks carry no user token):
 *   npx supabase functions deploy send-push --no-verify-jwt
 * Secrets:
 *   PUSH_WEBHOOK_SECRET - shared secret; each webhook must send it as
 *   the x-webhook-secret header, or the request is refused.
 *
 * Tokens that Expo reports as DeviceNotRegistered are deleted, so
 * uninstalled devices stop accumulating.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  try {
    const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    if (!secret || req.headers.get('x-webhook-secret') !== secret) {
      return new Response('forbidden', { status: 403 });
    }

    const payload = await req.json();
    if (payload?.type !== 'INSERT' || !payload?.record) {
      return json({ ok: true, skipped: 'not an insert' });
    }
    const table: string = payload.table;
    const rec: any = payload.record;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const username = async (userId: string | null) => {
      if (!userId) return 'Someone';
      const { data } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('user_id', userId)
        .maybeSingle();
      return data?.username ? `@${data.username}` : 'Someone';
    };

    // Work out recipient + copy per table
    let toUserId: string | null = null;
    let title = '';
    let body = '';
    let kind = '';

    if (table === 'shared_items') {
      toUserId = rec.to_user_id;
      const from = await username(rec.from_user_id);
      kind = 'share';
      if (rec.type === 'cookbook') {
        title = 'Cookbook shared with you';
        body = `${from} shared the cookbook "${rec.name || 'a cookbook'}"`;
      } else {
        title = 'Recipe shared with you';
        body = `${from} shared ${rec.name ? `"${rec.name}"` : 'a recipe'}`;
      }
    } else if (table === 'friend_requests') {
      toUserId = rec.to_user_id;
      const from = await username(rec.from_user_id);
      kind = 'friend_request';
      title = 'New friend request';
      body = `${from} wants to be friends`;
    } else if (table === 'shared_folder_members') {
      if (rec.status !== 'invited') {
        return json({ ok: true, skipped: 'not an invite' });
      }
      toUserId = rec.user_id;
      const from = await username(rec.invited_by);
      kind = 'folder_invite';
      let folderName = 'a shared cookbook';
      const { data: folder } = await supabase
        .from('shared_folders')
        .select('name')
        .eq('id', rec.folder_id)
        .maybeSingle();
      if (folder?.name) folderName = `"${folder.name}"`;
      title = 'Shared cookbook invite';
      body = `${from} invited you to ${folderName}`;
    } else {
      return json({ ok: true, skipped: `unhandled table ${table}` });
    }

    if (!toUserId) return json({ ok: true, skipped: 'no recipient' });

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', toUserId);
    if (!tokens || tokens.length === 0) {
      return json({ ok: true, skipped: 'recipient has no devices' });
    }

    const messages = tokens.map(t => ({
      to: t.token,
      title,
      body,
      data: { kind },
      channelId: 'social',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15_000),
    });
    const result: any = await res.json().catch(() => null);

    // Prune tokens for uninstalled devices
    const tickets: any[] = Array.isArray(result?.data) ? result.data : [];
    for (let i = 0; i < tickets.length; i++) {
      if (tickets[i]?.details?.error === 'DeviceNotRegistered') {
        await supabase.from('push_tokens').delete().eq('token', messages[i].to);
      }
    }

    console.log(`push: ${kind} -> ${tokens.length} device(s), expo status ${res.status}`);
    return json({ ok: true, sent: tokens.length });
  } catch (err) {
    console.error('send-push error:', err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

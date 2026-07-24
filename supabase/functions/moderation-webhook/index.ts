// deno-lint-ignore-file no-explicit-any
/**
 * FILENAME: supabase/functions/moderation-webhook/index.ts
 * PURPOSE: Receives Supabase database webhooks and forwards to Discord
 *
 * Setup:
 *   1. Deploy this function: supabase functions deploy moderation-webhook (or via Dashboard)
 *   2. Set the secret: DISCORD_WEBHOOK_URL
 *   3. Create a Supabase Database Webhook on content_reports INSERT that
 *      POSTs to https://<project-ref>.supabase.co/functions/v1/moderation-webhook
 *
 * When a new report is inserted, Discord will get a formatted message
 * with the report details and a link to review it.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REASON_LABELS: Record<string, string> = {
  inappropriate: 'Inappropriate content',
  hate_harassment: 'Hate or harassment',
  spam: 'Spam or misleading',
  other: 'Other',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const discordUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    if (!discordUrl) {
      console.error('DISCORD_WEBHOOK_URL not configured');
      return json({ ok: false, error: 'not configured' }, 200);
    }

    const payload = await req.json();

    // Supabase Database Webhooks send: { type, table, record, schema, old_record }
    const type = payload?.type;
    const table = payload?.table;
    const record = payload?.record;

    if (!record) {
      console.warn('No record in payload:', payload);
      return json({ ok: false, error: 'no record' }, 200);
    }

    // Route based on which table the webhook came from
    let discordMessage: any = null;

    if (table === 'content_reports' && type === 'INSERT') {
      discordMessage = formatReportMessage(record);
    } else if (table === 'moderation_flags' && type === 'INSERT') {
      discordMessage = formatFlagMessage(record);
    } else {
      console.log('Ignoring webhook:', { table, type });
      return json({ ok: true, ignored: true }, 200);
    }

    // Send to Discord
    const res = await fetch(discordUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordMessage),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('Discord webhook failed:', res.status, errBody);
      return json({ ok: false, error: `discord ${res.status}` }, 200);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error('moderation-webhook error:', err);
    return json({ ok: false, error: String(err) }, 200);
  }
});

function formatReportMessage(record: any): any {
  const reason = REASON_LABELS[record.reason] || record.reason || 'Unknown';
  const contentType = record.content_type || 'unknown';
  const details = record.details ? `**Details:** ${record.details}\n` : '';

  return {
    embeds: [{
      title: `🚩 New ${contentType} report`,
      color: 0xE74C3C, // Red
      fields: [
        { name: 'Reason', value: reason, inline: true },
        { name: 'Content Type', value: contentType, inline: true },
        { name: 'Content ID', value: `\`${record.content_id || 'n/a'}\``, inline: false },
        { name: 'Reporter', value: `\`${record.reporter_id}\``, inline: false },
        { name: 'Reported User', value: `\`${record.reported_user_id}\``, inline: false },
      ],
      description: details,
      timestamp: record.created_at || new Date().toISOString(),
      footer: { text: 'Review in the app under Settings → Moderation Queue' },
    }],
  };
}

function formatFlagMessage(record: any): any {
  return {
    embeds: [{
      title: `🛡️ Auto-flagged content`,
      color: 0xF39C12, // Orange
      fields: [
        { name: 'Type', value: record.content_type || 'unknown', inline: true },
        { name: 'Reason', value: record.reason || 'auto-detected', inline: true },
        { name: 'User', value: `\`${record.user_id}\``, inline: false },
      ],
      timestamp: record.created_at || new Date().toISOString(),
    }],
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

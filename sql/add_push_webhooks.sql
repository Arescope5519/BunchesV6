-- Push-notification triggers: the SQL equivalent of Supabase's
-- dashboard Database Webhooks (used because this project's dashboard
-- hook machinery was never provisioned - supabase_functions.http_request
-- does not exist). pg_net posts asynchronously, so inserts never wait
-- on the push delivery.
--
-- BEFORE RUNNING: replace REPLACE_WITH_YOUR_SECRET with the same
-- string stored as the PUSH_WEBHOOK_SECRET function secret.

create extension if not exists pg_net;

create or replace function notify_send_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://azdhiunzwslogbaiwtgi.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'REPLACE_WITH_YOUR_SECRET'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(new)
    )
  );
  return new;
end;
$$;

drop trigger if exists push_on_shared_item on shared_items;
create trigger push_on_shared_item
  after insert on shared_items
  for each row execute function notify_send_push();

drop trigger if exists push_on_friend_request on friend_requests;
create trigger push_on_friend_request
  after insert on friend_requests
  for each row execute function notify_send_push();

drop trigger if exists push_on_folder_invite on shared_folder_members;
create trigger push_on_folder_invite
  after insert on shared_folder_members
  for each row execute function notify_send_push();

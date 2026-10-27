-- Device push tokens for social notifications (recipe shares, friend
-- requests, shared-cookbook invites). One row per device; a user with
-- a phone and a tablet gets two rows. Tokens are Expo push tokens
-- (ExponentPushToken[...]) - the send-push Edge Function delivers
-- through Expo's push service, which fans out to FCM/APNs.

create table if not exists push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table push_tokens enable row level security;

-- Each user manages only their own tokens. The send-push function
-- reads with the service role, so no cross-user SELECT is needed.
drop policy if exists push_tokens_own on push_tokens;
create policy push_tokens_own on push_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

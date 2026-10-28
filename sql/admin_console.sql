-- Backing for the web admin console (site/admin/) - melibri.app/admin/
--
-- The console is a static page signed in with a normal account; this
-- file is the actual security boundary. Reads come through RLS
-- policies gated on is_app_admin(); every mutation goes through a
-- SECURITY DEFINER RPC that re-checks admin status server-side, so a
-- non-admin calling these gets refused no matter what UI they drive.

-- Columns the console manages (no-ops where they already exist)
alter table user_profiles add column if not exists is_premium boolean not null default false;
alter table user_profiles add column if not exists premium_until timestamptz;
alter table user_profiles add column if not exists is_banned boolean not null default false;
alter table user_profiles add column if not exists banned_at timestamptz;
alter table user_profiles add column if not exists banned_reason text;

-- Single source of truth for "is the caller an admin". SECURITY
-- DEFINER so policies can call it without tripping user_profiles RLS.
create or replace function is_app_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select is_admin from user_profiles where user_id = auth.uid()),
    false
  )
$$;
revoke all on function is_app_admin() from public;
grant execute on function is_app_admin() to authenticated;

-- ---------------------------------------------------------------
-- Read access: admins see every profile and both report queues
-- (permissive policies OR together, so these only ever widen access
-- for admins - nothing changes for normal users)
-- ---------------------------------------------------------------

drop policy if exists "Admins read all profiles" on user_profiles;
create policy "Admins read all profiles"
on user_profiles for select to authenticated
using (is_app_admin());

drop policy if exists "Admins read all extraction reports" on extraction_reports;
create policy "Admins read all extraction reports"
on extraction_reports for select to authenticated
using (is_app_admin());

drop policy if exists "Admins update extraction reports" on extraction_reports;
create policy "Admins update extraction reports"
on extraction_reports for update to authenticated
using (is_app_admin()) with check (is_app_admin());

drop policy if exists "Admins read all content reports" on content_reports;
create policy "Admins read all content reports"
on content_reports for select to authenticated
using (is_app_admin());

drop policy if exists "Admins update content reports" on content_reports;
create policy "Admins update content reports"
on content_reports for update to authenticated
using (is_app_admin()) with check (is_app_admin());

-- ---------------------------------------------------------------
-- Mutations: definer RPCs, each re-checking admin status
-- ---------------------------------------------------------------

create or replace function admin_set_premium(
  target uuid, premium boolean, until_date timestamptz default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_app_admin() then raise exception 'admins only'; end if;
  update user_profiles
  set is_premium = premium,
      premium_until = case when premium then until_date else null end
  where user_id = target;
end;
$$;

create or replace function admin_set_feature_flag(
  target uuid, flag text, enabled boolean
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_app_admin() then raise exception 'admins only'; end if;
  if enabled then
    update user_profiles
    set feature_flags = coalesce(feature_flags, '{}'::jsonb)
        || jsonb_build_object(flag, true)
    where user_id = target;
  else
    update user_profiles
    set feature_flags = coalesce(feature_flags, '{}'::jsonb) - flag
    where user_id = target;
  end if;
end;
$$;

-- A real ban: besides the profile flags (hides them socially), this
-- sets GoTrue's native auth.users.banned_until, which refuses new
-- sign-ins AND token refreshes - the account is locked out within an
-- hour (when their current access token expires), with no app-side
-- check needed. The old in-app banUser only wrote the profile flags,
-- so it never actually locked anyone out.
create or replace function admin_set_ban(
  target uuid, banned boolean, reason text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_app_admin() then raise exception 'admins only'; end if;
  if banned then
    update user_profiles
    set is_banned = true, banned_at = now(),
        banned_reason = reason, is_public = false
    where user_id = target;
    update auth.users set banned_until = 'infinity' where id = target;
  else
    update user_profiles
    set is_banned = false, banned_at = null, banned_reason = null
    where user_id = target;
    update auth.users set banned_until = null where id = target;
  end if;
end;
$$;

create or replace function admin_soft_delete_recipe(recipe_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_app_admin() then raise exception 'admins only'; end if;
  update recipes set deleted_at = now() where id = recipe_id;
  update user_recipes_v2 set deleted_at = now() where id = recipe_id;
end;
$$;

revoke all on function admin_set_premium(uuid, boolean, timestamptz) from public;
revoke all on function admin_set_feature_flag(uuid, text, boolean) from public;
revoke all on function admin_set_ban(uuid, boolean, text) from public;
revoke all on function admin_soft_delete_recipe(uuid) from public;
grant execute on function admin_set_premium(uuid, boolean, timestamptz) to authenticated;
grant execute on function admin_set_feature_flag(uuid, text, boolean) to authenticated;
grant execute on function admin_set_ban(uuid, boolean, text) to authenticated;
grant execute on function admin_soft_delete_recipe(uuid) to authenticated;

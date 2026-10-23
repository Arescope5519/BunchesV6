-- Per-member permissions for shared cookbooks (run after
-- sql/shared_folders.sql). Roles:
--   owner   - everything, incl. members and roles
--   manager - add recipes, remove ANY recipe
--   editor  - add recipes, remove their own additions (the old default)
--   viewer  - look and save copies only
-- Existing members keep 'editor', so nothing changes until the owner
-- adjusts someone.

alter table shared_folder_members drop constraint if exists shared_folder_members_role_check;
alter table shared_folder_members add constraint shared_folder_members_role_check
  check (role in ('owner', 'manager', 'editor', 'viewer'));

create or replace function shared_folder_my_role(fid uuid)
returns text
language sql security definer set search_path = public stable
as $$
  select role from shared_folder_members
  where folder_id = fid and user_id = auth.uid() and status = 'active';
$$;

-- Recipes: any active member reads (unchanged); adding needs editor or
-- better; removing someone else's addition needs manager or owner.
drop policy if exists sfr_insert on shared_folder_recipes;
create policy sfr_insert on shared_folder_recipes for insert
  with check (
    shared_folder_my_role(folder_id) in ('owner', 'manager', 'editor')
    and added_by = auth.uid()
  );

drop policy if exists sfr_delete on shared_folder_recipes;
create policy sfr_delete on shared_folder_recipes for delete
  using (
    (added_by = auth.uid() and shared_folder_my_role(folder_id) in ('owner', 'manager', 'editor'))
    or shared_folder_my_role(folder_id) in ('owner', 'manager')
  );

-- Invites may carry any non-owner role
drop policy if exists sfm_insert on shared_folder_members;
create policy sfm_insert on shared_folder_members for insert
  with check (
    is_shared_folder_owner(folder_id)
    and user_id <> auth.uid()
    and role in ('manager', 'editor', 'viewer')
    and status = 'invited'
  );

-- Self-updates exist to accept the invite. The trigger below stops a
-- member smuggling a role upgrade into that same update (WITH CHECK
-- alone cannot compare old and new values).
drop policy if exists sfm_update on shared_folder_members;
create policy sfm_update on shared_folder_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'active');

create or replace function shared_folder_members_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new; -- dashboard / service role
  end if;
  if new.user_id = auth.uid() and new.role is distinct from old.role then
    raise exception 'cannot change your own role';
  end if;
  return new;
end;
$$;

drop trigger if exists shared_folder_members_guard_t on shared_folder_members;
create trigger shared_folder_members_guard_t
  before update on shared_folder_members
  for each row execute function shared_folder_members_guard();

-- The owner sets a member's role (never the owner row, never their own)
create or replace function set_shared_folder_member_role(p_folder uuid, p_user uuid, p_role text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare updated int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not is_shared_folder_owner(p_folder) then
    raise exception 'owner only';
  end if;
  if p_role not in ('manager', 'editor', 'viewer') then
    raise exception 'invalid role';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot change the owner role';
  end if;
  update shared_folder_members
  set role = p_role
  where folder_id = p_folder and user_id = p_user and role <> 'owner';
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke execute on function set_shared_folder_member_role(uuid, uuid, text) from public, anon;
grant execute on function set_shared_folder_member_role(uuid, uuid, text) to authenticated;

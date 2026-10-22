-- Shared cookbooks: a folder several accounts can add recipes to.
--
-- v1 access model:
--   - owner: creates the folder, invites/removes members, removes any
--     recipe, renames, deletes the folder.
--   - editor (every invited member): adds recipes, removes their OWN
--     additions, leaves whenever they want.
--   - invites are rows with status 'invited'; accepting flips them to
--     'active'. Declining deletes the row.
--
-- Content model: a shared folder holds references to global_recipes
-- (the shared, unchanging layer of the dual-write). Members see the
-- GLOBAL version only - personal notes/edits in user_recipes_v2 are
-- never exposed. global_recipes is already readable by authenticated
-- users (deep links and imports depend on it), so no new read grant
-- on recipes is involved; the folder just tells members which ids to
-- look at.

create table if not exists shared_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists shared_folder_members (
  folder_id uuid not null references shared_folders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  status text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);

create table if not exists shared_folder_recipes (
  folder_id uuid not null references shared_folders(id) on delete cascade,
  global_recipe_id uuid not null references global_recipes(id) on delete cascade,
  added_by uuid not null,
  added_at timestamptz not null default now(),
  primary key (folder_id, global_recipe_id)
);

create index if not exists sfm_user_idx on shared_folder_members (user_id);
create index if not exists sfr_folder_idx on shared_folder_recipes (folder_id);

alter table shared_folders enable row level security;
alter table shared_folder_members enable row level security;
alter table shared_folder_recipes enable row level security;

-- SECURITY DEFINER helpers so the three tables' policies can check
-- each other without recursive RLS (members policy -> folders policy
-- -> members policy would error otherwise).

create or replace function is_shared_folder_member(fid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from shared_folder_members
    where folder_id = fid and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function has_shared_folder_row(fid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from shared_folder_members
    where folder_id = fid and user_id = auth.uid()
  );
$$;

create or replace function is_shared_folder_owner(fid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from shared_folders
    where id = fid and owner_id = auth.uid()
  );
$$;

-- Atomic create: the folder plus its owner's active member row.
create or replace function create_shared_folder(folder_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare fid uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if folder_name is null
     or char_length(trim(folder_name)) < 1
     or char_length(trim(folder_name)) > 60 then
    raise exception 'invalid folder name';
  end if;
  insert into shared_folders (owner_id, name)
  values (auth.uid(), trim(folder_name))
  returning id into fid;
  insert into shared_folder_members (folder_id, user_id, role, status, invited_by)
  values (fid, auth.uid(), 'owner', 'active', auth.uid());
  return fid;
end;
$$;

-- shared_folders: visible to the owner and anyone with a member row
-- (invitees need the name to decide on the invite).
drop policy if exists sf_select on shared_folders;
create policy sf_select on shared_folders for select
  using (owner_id = auth.uid() or has_shared_folder_row(id));

drop policy if exists sf_insert on shared_folders;
create policy sf_insert on shared_folders for insert
  with check (owner_id = auth.uid());

drop policy if exists sf_update on shared_folders;
create policy sf_update on shared_folders for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists sf_delete on shared_folders;
create policy sf_delete on shared_folders for delete
  using (owner_id = auth.uid());

-- shared_folder_members: you see your own rows; active members and the
-- owner see the roster. Only the owner invites (always as 'editor',
-- always 'invited' - the owner row comes from create_shared_folder).
-- You may flip your own invite to active; you or the owner may delete
-- your row (decline / leave / remove).
drop policy if exists sfm_select on shared_folder_members;
create policy sfm_select on shared_folder_members for select
  using (
    user_id = auth.uid()
    or is_shared_folder_member(folder_id)
    or is_shared_folder_owner(folder_id)
  );

drop policy if exists sfm_insert on shared_folder_members;
create policy sfm_insert on shared_folder_members for insert
  with check (
    is_shared_folder_owner(folder_id)
    and user_id <> auth.uid()
    and role = 'editor'
    and status = 'invited'
  );

drop policy if exists sfm_update on shared_folder_members;
create policy sfm_update on shared_folder_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = 'editor' and status = 'active');

drop policy if exists sfm_delete on shared_folder_members;
create policy sfm_delete on shared_folder_members for delete
  using (user_id = auth.uid() or is_shared_folder_owner(folder_id));

-- shared_folder_recipes: active members read and add (as themselves);
-- you remove your own additions, the owner removes anything.
drop policy if exists sfr_select on shared_folder_recipes;
create policy sfr_select on shared_folder_recipes for select
  using (is_shared_folder_member(folder_id));

drop policy if exists sfr_insert on shared_folder_recipes;
create policy sfr_insert on shared_folder_recipes for insert
  with check (is_shared_folder_member(folder_id) and added_by = auth.uid());

drop policy if exists sfr_delete on shared_folder_recipes;
create policy sfr_delete on shared_folder_recipes for delete
  using (
    (added_by = auth.uid() and is_shared_folder_member(folder_id))
    or is_shared_folder_owner(folder_id)
  );

-- Shared edit versions on shared-cookbook recipes ("Spicier",
-- "Gluten-free swap"): named variants members publish for everyone in
-- the folder to see. Stored as a jsonb array on shared_folder_recipes;
-- every write goes through a definer RPC that re-checks the caller's
-- folder role, so the column needs no direct UPDATE policy.
--
-- Variant shape: { id, name, byUserId, byUsername, createdAt,
--                  edits: { title, ingredients, instructions } }
--
-- Rules: publishing needs editor or better; a user's same-named
-- version is replaced by their new publish; removal needs to be the
-- author, a manager, or the owner; 10 versions per recipe at most.

alter table shared_folder_recipes
  add column if not exists shared_variants jsonb not null default '[]'::jsonb;

create or replace function publish_shared_variant(
  p_folder_id uuid,
  p_global_recipe_id uuid,
  p_name text,
  p_edits jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  v_name text;
  v_username text;
  v_variants jsonb;
  v_variant jsonb;
begin
  v_role := shared_folder_my_role(p_folder_id);
  if v_role is null or v_role not in ('owner', 'manager', 'editor') then
    raise exception 'you cannot publish versions to this cookbook';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if v_name = '' or length(v_name) > 60 then
    raise exception 'version name must be 1-60 characters';
  end if;
  if p_edits is null or length(p_edits::text) > 60000 then
    raise exception 'version content is too large';
  end if;

  select username into v_username from user_profiles where user_id = auth.uid();

  select shared_variants into v_variants from shared_folder_recipes
    where folder_id = p_folder_id and global_recipe_id = p_global_recipe_id;
  if v_variants is null then
    raise exception 'recipe not found in this cookbook';
  end if;

  -- Re-publishing under the same name replaces the user's own version
  v_variants := coalesce((
    select jsonb_agg(v) from jsonb_array_elements(v_variants) v
    where not (v->>'byUserId' = auth.uid()::text
               and lower(v->>'name') = lower(v_name))
  ), '[]'::jsonb);

  if jsonb_array_length(v_variants) >= 10 then
    raise exception 'this recipe already has 10 shared versions';
  end if;

  v_variant := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', v_name,
    'byUserId', auth.uid()::text,
    'byUsername', coalesce(v_username, 'unknown'),
    'createdAt', (extract(epoch from now()) * 1000)::bigint,
    'edits', p_edits
  );

  update shared_folder_recipes
    set shared_variants = v_variants || jsonb_build_array(v_variant)
    where folder_id = p_folder_id and global_recipe_id = p_global_recipe_id;

  return v_variant;
end;
$$;

create or replace function remove_shared_variant(
  p_folder_id uuid,
  p_global_recipe_id uuid,
  p_variant_id text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  v_author text;
begin
  v_role := shared_folder_my_role(p_folder_id);
  if v_role is null then
    raise exception 'not a member of this cookbook';
  end if;

  select v->>'byUserId' into v_author
    from shared_folder_recipes r,
         jsonb_array_elements(r.shared_variants) v
    where r.folder_id = p_folder_id
      and r.global_recipe_id = p_global_recipe_id
      and v->>'id' = p_variant_id;

  if v_author is null then
    return; -- already gone
  end if;
  if v_author <> auth.uid()::text and v_role not in ('owner', 'manager') then
    raise exception 'only its author, a manager, or the owner can remove a version';
  end if;

  update shared_folder_recipes
    set shared_variants = coalesce((
      select jsonb_agg(v) from jsonb_array_elements(shared_variants) v
      where v->>'id' <> p_variant_id
    ), '[]'::jsonb)
    where folder_id = p_folder_id and global_recipe_id = p_global_recipe_id;
end;
$$;

revoke all on function publish_shared_variant(uuid, uuid, text, jsonb) from public;
revoke all on function remove_shared_variant(uuid, uuid, text) from public;
grant execute on function publish_shared_variant(uuid, uuid, text, jsonb) to authenticated;
grant execute on function remove_shared_variant(uuid, uuid, text) to authenticated;

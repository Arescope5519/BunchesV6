-- Lets a signed-in user promote a healed (mirrored) image to the
-- shared global_recipes row, so one phone fixing a dead external photo
-- fixes it for every surface that reads the global layer - shared
-- cookbooks, profiles, the feed. Before this, the launch self-heal
-- only repaired the healer's own copy (legacy row + local cache) and
-- the global stayed broken for everyone else.
--
-- Guards (globals are otherwise immutable to users):
--   1. The new URL must live in OUR public recipe-images bucket -
--      i.e. the device really mirrored something.
--   2. Only replaces an image that is NOT already mirrored, so a good
--      storage image can never be clobbered.
--   3. The caller must actually hold the recipe (a live
--      user_recipes_v2 row), not just know its id.

create or replace function heal_global_recipe_image(p_global_id uuid, p_image_url text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  if p_image_url is null or p_image_url not like
    'https://azdhiunzwslogbaiwtgi.supabase.co/storage/v1/object/public/recipe-images/%' then
    raise exception 'not a mirrored image';
  end if;

  if not exists (
    select 1 from user_recipes_v2
    where user_id = auth.uid()
      and global_recipe_id = p_global_id
      and deleted_at is null
  ) then
    raise exception 'not a holder of this recipe';
  end if;

  update global_recipes
  set image_url = p_image_url,
      updated_at = now()
  where id = p_global_id
    and (image_url is null or image_url not like '%.supabase.co/storage/%');

  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke execute on function heal_global_recipe_image(uuid, text) from public, anon;
grant execute on function heal_global_recipe_image(uuid, text) to authenticated;

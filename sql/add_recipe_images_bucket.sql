-- Public storage bucket for re-hosted recipe photos.
--
-- Imported recipes keep their source site's image URL, and bot-walled
-- CDNs refuse the app's image requests on some platforms (Akamai
-- rejected Android's loads of food.fnr.sndimg.com while Chrome on the
-- same phone loaded them). The mirror-image Edge Function copies the
-- photo in here at import time and recipes point at our bucket.
--
-- Public bucket: anyone can READ via the public URL (recipe photos
-- are already public content). Writes happen only through the Edge
-- Function's service role, so no insert/update policies are granted.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

-- The bot walls turned out to block datacenter IPs too, so the DEVICE
-- now downloads and uploads the photo itself (the Edge Function stays
-- as fallback). Device uploads go through RLS, so signed-in users need
-- insert on this bucket - scoped to their own folder (uploads are
-- keyed <user_id>/<random>.<ext>).
create policy "Users upload own recipe images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Sharing = Caring, update 5
-- Run this ONCE in Supabase > SQL Editor > New query, BEFORE you upload the new app files.

-- "Make your own texture": a tiny crop of someone's own photo as their picture
alter table public.profiles add column if not exists avatar_src text;

-- Public bucket for these crops: small JPGs only, everyone can see them (they're abstract on purpose)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 300000, array['image/jpeg'])
  on conflict (id) do nothing;
create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

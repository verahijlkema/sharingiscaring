-- SHARING=CARING, update 10: your own (inspiration) photo on a call
-- Run this ONCE in Supabase > SQL Editor > New query, BEFORE you upload the new app files.

alter table public.calls add column if not exists photo text;

-- The photo lives in "<user id>/calls/" in the private photo storage; only you and your friends can see it
create policy "friends see call photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[2] = 'calls'
         and public.can_see(((storage.foldername(name))[1])::uuid));

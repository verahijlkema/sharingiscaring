-- Sharing = Caring, update 4
-- Run this ONCE in Supabase > SQL Editor > New query, BEFORE you upload the new app files.

-- Bio and closet backdrop: only you and your friends can see them
create table if not exists public.profile_extras (
  user_id uuid primary key references public.profiles on delete cascade default auth.uid(),
  bio text check (bio is null or char_length(bio) <= 300),
  backdrop text
);
alter table public.profile_extras enable row level security;
create policy "friends see extras" on public.profile_extras for select to authenticated using (public.can_see(user_id));
create policy "add own extras" on public.profile_extras for insert to authenticated with check (user_id = auth.uid());
create policy "edit own extras" on public.profile_extras for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.profile_extras to authenticated;

-- Friends may see the closet photo, which lives in "<user id>/profile/" in the photo storage
create policy "friends see profile photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[2] = 'profile'
         and public.can_see(((storage.foldername(name))[1])::uuid));

-- Tidy old terms: care instructions move to Care, thank-yous move to Thank-you
update public.pieces set
  care  = care  || array(select t from unnest(terms) t where t ~* '(dry|clean|wash|steam|iron)'),
  terms = array(select t from unnest(terms) t where t !~* '(dry|clean|wash|steam|iron)')
  where exists (select 1 from unnest(terms) t where t ~* '(dry|clean|wash|steam|iron)');
update public.pieces set
  thanks = thanks || array(select t from unnest(terms) t where t ~* '(chocolate|wine|photo|drink|flowers)'),
  terms  = array(select t from unnest(terms) t where t !~* '(chocolate|wine|photo|drink|flowers)')
  where exists (select 1 from unnest(terms) t where t ~* '(chocolate|wine|photo|drink|flowers)');

-- SHARING=CARING, update 9: "Looking for" (ask your friends for a piece)
-- Run this ONCE in Supabase > SQL Editor > New query, BEFORE you upload the new app files.

-- A call: "I'm looking for a long dress for a gala". Only you and your friends see it.
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles on delete cascade default auth.uid(),
  what text not null check (char_length(what) between 1 and 120),
  details text check (details is null or char_length(details) <= 500),
  category text,
  size text,
  needed_by date,
  status text not null default 'open' check (status in ('open', 'found')),
  created_at timestamptz default now()
);
alter table public.calls enable row level security;
create policy "friends see calls" on public.calls for select to authenticated using (public.can_see(owner));
create policy "post own calls" on public.calls for insert to authenticated with check (owner = auth.uid());
create policy "edit own calls" on public.calls for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "delete own calls" on public.calls for delete to authenticated using (owner = auth.uid());
grant select, insert, update, delete on public.calls to authenticated;

-- A reply: "I have something", optionally pointing at one of your own pieces.
-- Everyone who can see the call sees the replies (name and piece title).
-- The photo of the piece stays visible to the owner's friends only, as before.
create table if not exists public.call_replies (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls on delete cascade,
  author uuid not null references public.profiles on delete cascade default auth.uid(),
  piece_id uuid references public.pieces on delete set null,
  piece_title text check (piece_title is null or char_length(piece_title) <= 200),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz default now()
);
create index if not exists call_replies_call on public.call_replies (call_id);
alter table public.call_replies enable row level security;
create policy "see replies on calls you see" on public.call_replies for select to authenticated
  using (exists (select 1 from public.calls c where c.id = call_id and public.can_see(c.owner)));
create policy "reply to open calls of friends" on public.call_replies for insert to authenticated
  with check (
    author = auth.uid()
    and exists (select 1 from public.calls c where c.id = call_id and c.status = 'open' and c.owner <> auth.uid() and public.can_see(c.owner))
    and (piece_id is null or exists (select 1 from public.pieces p where p.id = piece_id and p.owner = auth.uid()))
  );
create policy "remove own reply, or replies on your call" on public.call_replies for delete to authenticated
  using (author = auth.uid() or exists (select 1 from public.calls c where c.id = call_id and c.owner = auth.uid()));
grant select, insert, delete on public.call_replies to authenticated;

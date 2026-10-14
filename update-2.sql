-- Sharing = Caring, update 2
-- Run this ONCE in Supabase > SQL Editor > New query, BEFORE you upload the new app files.

-- Pieces: a description, care instructions and thank-you wishes (terms stays for "other terms")
alter table public.pieces add column if not exists description text;
alter table public.pieces add column if not exists care text[] not null default '{}';
alter table public.pieces add column if not exists thanks text[] not null default '{}';

-- Profiles: which petri-dish picture someone picked
alter table public.profiles add column if not exists avatar smallint;

-- Shared labels for brands and extra categories, so everyone picks the same spelling
create table if not exists public.tags (
  kind text not null check (kind in ('brand','category')),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_by uuid references public.profiles on delete set null default auth.uid(),
  created_at timestamptz default now()
);
create unique index if not exists tags_unique on public.tags (kind, lower(btrim(name)));
alter table public.tags enable row level security;
create policy "see tags" on public.tags for select to authenticated using (true);
create policy "add tags" on public.tags for insert to authenticated with check (created_by = auth.uid());
grant select, insert on public.tags to authenticated;

-- Tidy existing data
update public.pieces set brand = 'Vintage' where brand ilike 'second hand' or brand ilike 'second-hand';
insert into public.tags (kind, name, created_by)
  select distinct on (lower(btrim(brand))) 'brand', btrim(brand), owner from public.pieces
  where brand is not null and btrim(brand) <> ''
  on conflict do nothing;

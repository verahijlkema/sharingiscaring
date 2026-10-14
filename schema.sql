-- Sharing = Caring: database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run. Run it once.

-- ============ PEOPLE ============
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  username text unique,
  colour text default '#D9D4F2',
  created_at timestamptz default now()
);

-- Phone numbers are kept apart so only friends can see them
create table public.contacts (
  user_id uuid primary key references public.profiles on delete cascade,
  phone text
);

-- Create a profile automatically when someone signs up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  insert into public.contacts (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ FRIENDSHIPS (both sides must say yes) ============
create table public.friendships (
  requester uuid references public.profiles on delete cascade default auth.uid(),
  addressee uuid references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- "Can the person who is logged in see things owned by this user?"
create function public.can_see(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or public.are_friends(auth.uid(), owner);
$$;

-- ============ PIECES ============
create table public.pieces (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles on delete cascade default auth.uid(),
  title text not null,
  category text not null,
  material text,
  size text,
  brand text,
  buy_url text,
  terms text[] not null default '{}',
  available boolean not null default true,
  created_at timestamptz default now()
);

create table public.piece_photos (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.pieces on delete cascade,
  added_by uuid not null references public.profiles on delete cascade default auth.uid(),
  path text not null unique,
  caption text,
  created_at timestamptz default now()
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.pieces on delete cascade,
  author uuid not null references public.profiles on delete cascade default auth.uid(),
  body text not null,
  fit text check (fit in ('Runs small','True to size','Runs large')),
  created_at timestamptz default now()
);

create table public.worn_to (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.pieces on delete cascade,
  author uuid not null references public.profiles on delete cascade default auth.uid(),
  occasion text not null,
  created_at timestamptz default now()
);

create table public.hearts (
  user_id uuid references public.profiles on delete cascade default auth.uid(),
  piece_id uuid references public.pieces on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, piece_id)
);

-- ============ BORROWING ============
create table public.borrow_requests (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.pieces on delete cascade,
  borrower uuid not null references public.profiles on delete cascade default auth.uid(),
  owner uuid references public.profiles on delete cascade,
  date_from date not null,
  date_until date not null,
  message text,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','returned','confirmed','cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (date_until >= date_from)
);

-- Fill in the owner, and only allow the steps that make sense, by the right person
create function public.borrow_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select owner into new.owner from pieces where id = new.piece_id;
    if new.owner = new.borrower then raise exception 'You cannot borrow your own piece'; end if;
    if not are_friends(new.borrower, new.owner) then raise exception 'Only friends can borrow'; end if;
    new.status := 'pending';
    return new;
  end if;
  if new.piece_id <> old.piece_id or new.borrower <> old.borrower or new.owner <> old.owner then
    raise exception 'This request cannot be moved to another piece or person';
  end if;
  if new.status <> old.status then
    if auth.uid() = old.owner and (
         (old.status = 'pending'  and new.status in ('accepted','declined')) or
         (old.status = 'returned' and new.status in ('confirmed','accepted'))) then null;
    elsif auth.uid() = old.borrower and (
         (old.status = 'accepted' and new.status = 'returned') or
         (old.status = 'pending'  and new.status = 'cancelled')) then null;
    else raise exception 'That step is not allowed'; end if;
  end if;
  new.updated_at := now();
  -- keep the piece's availability in sync
  if new.status = 'accepted' then update pieces set available = false where id = new.piece_id;
  elsif new.status in ('confirmed') then update pieces set available = true where id = new.piece_id; end if;
  return new;
end $$;
create trigger borrow_rules before insert or update on public.borrow_requests
  for each row execute function public.borrow_rules();

-- ============ WHO MAY SEE AND DO WHAT ============
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.friendships enable row level security;
alter table public.pieces enable row level security;
alter table public.piece_photos enable row level security;
alter table public.reactions enable row level security;
alter table public.worn_to enable row level security;
alter table public.hearts enable row level security;
alter table public.borrow_requests enable row level security;

-- Names are visible to logged-in people, so you can find friends
create policy "see names" on public.profiles for select to authenticated using (true);
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid());

create policy "friends see phone" on public.contacts for select to authenticated using (public.can_see(user_id));
create policy "edit own phone" on public.contacts for update to authenticated using (user_id = auth.uid());

create policy "see own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
create policy "send friend request" on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending');
create policy "accept friend request" on public.friendships for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy "remove friendship" on public.friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));

create policy "friends see pieces" on public.pieces for select to authenticated using (public.can_see(owner));
create policy "add own piece" on public.pieces for insert to authenticated with check (owner = auth.uid());
create policy "edit own piece" on public.pieces for update to authenticated using (owner = auth.uid());
create policy "delete own piece" on public.pieces for delete to authenticated using (owner = auth.uid());

-- Photos, reactions and "worn to": visible and addable when you can see the piece
create policy "see photos" on public.piece_photos for select to authenticated
  using (exists (select 1 from public.pieces p where p.id = piece_id and public.can_see(p.owner)));
create policy "add photo" on public.piece_photos for insert to authenticated
  with check (added_by = auth.uid() and exists (select 1 from public.pieces p where p.id = piece_id and public.can_see(p.owner)));
create policy "remove photo" on public.piece_photos for delete to authenticated
  using (added_by = auth.uid() or exists (select 1 from public.pieces p where p.id = piece_id and p.owner = auth.uid()));

create policy "see reactions" on public.reactions for select to authenticated
  using (exists (select 1 from public.pieces p where p.id = piece_id and public.can_see(p.owner)));
create policy "add reaction" on public.reactions for insert to authenticated
  with check (author = auth.uid() and exists (select 1 from public.pieces p where p.id = piece_id and public.can_see(p.owner)));
create policy "remove reaction" on public.reactions for delete to authenticated
  using (author = auth.uid() or exists (select 1 from public.pieces p where p.id = piece_id and p.owner = auth.uid()));

create policy "see worn to" on public.worn_to for select to authenticated
  using (exists (select 1 from public.pieces p where p.id = piece_id and public.can_see(p.owner)));
create policy "add worn to" on public.worn_to for insert to authenticated
  with check (author = auth.uid() and exists (select 1 from public.pieces p where p.id = piece_id and public.can_see(p.owner)));
create policy "remove worn to" on public.worn_to for delete to authenticated using (author = auth.uid());

create policy "own hearts" on public.hearts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "see own requests" on public.borrow_requests for select to authenticated
  using (auth.uid() in (borrower, owner));
create policy "ask to borrow" on public.borrow_requests for insert to authenticated
  with check (borrower = auth.uid());
create policy "update own requests" on public.borrow_requests for update to authenticated
  using (auth.uid() in (borrower, owner));

-- ============ ACCESS FOR THE APP ============
-- New tables are not exposed automatically, so we open exactly these to logged-in users.
-- What each person may actually see or change is still decided by the rules above.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.contacts, public.friendships, public.pieces, public.piece_photos,
  public.reactions, public.worn_to, public.hearts, public.borrow_requests
  to authenticated;
grant execute on function public.are_friends(uuid, uuid), public.can_see(uuid) to authenticated;

-- ============ PHOTO STORAGE ============
-- Private bucket: photos are only shown to friends, through short-lived links
insert into storage.buckets (id, name, public) values ('photos', 'photos', false);

create policy "upload into own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "friends see photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.piece_photos pp join public.pieces p on p.id = pp.piece_id
               where pp.path = name and public.can_see(p.owner))));
create policy "delete own uploads" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- ============ UPDATE 2 (already included for new installs) ============

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

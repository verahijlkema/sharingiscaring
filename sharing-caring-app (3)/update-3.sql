-- Sharing = Caring, update 3
-- Run this ONCE in Supabase > SQL Editor > New query, BEFORE you upload the new app files.

-- The colour of the initial on someone's picture (empty = the suggested complementary colour)
alter table public.profiles add column if not exists avatar_ink text
  check (avatar_ink is null or avatar_ink ~ '^#[0-9A-Fa-f]{6}$');

-- The picture set changed (textures only now), so everyone picks again
update public.profiles set avatar = null;

-- Run once using Supabase SQL Editor. Project Google OAuth must be enabled separately.
-- Access limited to the authenticated owner; no anonymous database access.
create table if not exists public.chinese_lab_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);
alter table public.chinese_lab_progress add column if not exists revision bigint not null default 1;
alter table public.chinese_lab_progress add column if not exists updated_at timestamptz not null default now();
alter table public.chinese_lab_progress enable row level security;
revoke all on table public.chinese_lab_progress from anon, authenticated;
grant select,insert,update on table public.chinese_lab_progress to authenticated;
drop policy if exists "chinese_lab_read_own" on public.chinese_lab_progress;
drop policy if exists "chinese_lab_insert_own" on public.chinese_lab_progress;
drop policy if exists "chinese_lab_update_own" on public.chinese_lab_progress;
create policy "chinese_lab_read_own" on public.chinese_lab_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "chinese_lab_insert_own" on public.chinese_lab_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "chinese_lab_update_own" on public.chinese_lab_progress
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

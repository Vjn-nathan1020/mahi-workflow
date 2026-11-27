-- =====================================================================
-- MAHI – Personal Workflow AI Assistant · Supabase database setup
-- Run this whole file once in Supabase ▸ SQL Editor ▸ New query ▸ Run.
-- Safe to re-run (idempotent).
-- =====================================================================

-- ---------- 1. Workflow state ----------------------------------------
-- The app stores its state as ~11 JSON documents per user:
--   assets_S01 … assets_S07 (production records per set), meta (settings,
--   notes, personal tasks, campaigns, achievements…), media (pictures),
--   activity (notifications + history).
create table if not exists public.mahi_docs (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  doc_key    text        not null check (doc_key ~ '^[a-zA-Z0-9_]{1,40}$'),
  body       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_key)
);

-- ---------- 2. Saved reports -----------------------------------------
create table if not exists public.mahi_reports (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  title       text        not null check (char_length(title) <= 200),
  report_type text        check (char_length(report_type) <= 40),
  period_from date,
  period_to   date,
  content     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists mahi_reports_user_created on public.mahi_reports (user_id, created_at desc);

-- Keep updated_at current on every write.
create or replace function public.mahi_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists mahi_docs_touch on public.mahi_docs;
create trigger mahi_docs_touch before update on public.mahi_docs
for each row execute function public.mahi_touch_updated_at();

-- Size guard: no single document above 2 MB (the app keeps them < 240 KB).
alter table public.mahi_docs drop constraint if exists mahi_docs_body_size;
alter table public.mahi_docs add constraint mahi_docs_body_size check (pg_column_size(body) < 2097152);
alter table public.mahi_reports drop constraint if exists mahi_reports_content_size;
alter table public.mahi_reports add constraint mahi_reports_content_size check (pg_column_size(content) < 2097152);

-- ---------- 3. Row Level Security: each user sees ONLY their own rows -
alter table public.mahi_docs    enable row level security;
alter table public.mahi_reports enable row level security;
alter table public.mahi_docs    force row level security;
alter table public.mahi_reports force row level security;

drop policy if exists "mahi_docs owner select" on public.mahi_docs;
drop policy if exists "mahi_docs owner insert" on public.mahi_docs;
drop policy if exists "mahi_docs owner update" on public.mahi_docs;
drop policy if exists "mahi_docs owner delete" on public.mahi_docs;
create policy "mahi_docs owner select" on public.mahi_docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "mahi_docs owner insert" on public.mahi_docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mahi_docs owner update" on public.mahi_docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "mahi_docs owner delete" on public.mahi_docs for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "mahi_reports owner select" on public.mahi_reports;
drop policy if exists "mahi_reports owner insert" on public.mahi_reports;
drop policy if exists "mahi_reports owner delete" on public.mahi_reports;
create policy "mahi_reports owner select" on public.mahi_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy "mahi_reports owner insert" on public.mahi_reports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mahi_reports owner delete" on public.mahi_reports for delete to authenticated using ((select auth.uid()) = user_id);
-- v2: writes are not allowed on the v1 tables, so the write policies are removed again (owner-read only).
drop policy if exists "mahi_docs owner insert"    on public.mahi_docs;
drop policy if exists "mahi_docs owner update"    on public.mahi_docs;
drop policy if exists "mahi_docs owner delete"    on public.mahi_docs;
drop policy if exists "mahi_reports owner insert" on public.mahi_reports;
drop policy if exists "mahi_reports owner delete" on public.mahi_reports;

-- Signed-out visitors (anon role) get no access at all.
revoke all on public.mahi_docs, public.mahi_reports from anon;
-- v1 tables are READ-ONLY since MAHI v2 (migration_003): all writes go through public.mahi_push().
-- Re-running this file must never re-open direct writes.
revoke insert, update, delete, truncate on public.mahi_docs, public.mahi_reports from authenticated;
grant select on public.mahi_docs, public.mahi_reports to authenticated;

-- ---------- 4. Realtime: live updates between your devices ------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mahi_docs') then
    alter publication supabase_realtime add table public.mahi_docs;
  end if;
end $$;

-- =====================================================================================
-- MAHI migration 003 – make the v1 cloud tables (mahi_docs, mahi_reports) read-only.
-- Run AFTER schema.sql and schema_v2.sql. Safe to re-run. Deletes nothing.
--
-- Why: both tables are owner-only under RLS (no cross-user access), but direct writes to
-- mahi_docs would bypass v2's versions, history, idempotency and conflict checks.
-- All new writes go through public.mahi_push(). The tables and any rows in them are kept
-- (read-only) so any v1 data can still be read and migrated into v2.
-- To reverse (not recommended): see the commented block at the end.
-- =====================================================================================

revoke insert, update, delete, truncate on public.mahi_docs    from public, anon, authenticated;
revoke insert, update, delete, truncate on public.mahi_reports from public, anon, authenticated;
revoke all on public.mahi_docs, public.mahi_reports from anon;
grant select on public.mahi_docs, public.mahi_reports to authenticated;

-- Keep RLS on and leave only the owner-read policies.
alter table public.mahi_docs    enable row level security;
alter table public.mahi_reports enable row level security;
drop policy if exists "mahi_docs owner insert"    on public.mahi_docs;
drop policy if exists "mahi_docs owner update"    on public.mahi_docs;
drop policy if exists "mahi_docs owner delete"    on public.mahi_docs;
drop policy if exists "mahi_reports owner insert" on public.mahi_reports;
drop policy if exists "mahi_reports owner delete" on public.mahi_reports;

-- Reverse (only if ever needed):
--   grant insert, update, delete on public.mahi_docs to authenticated;
--   grant insert, delete on public.mahi_reports to authenticated;
--   then re-run the policy section of schema.sql.

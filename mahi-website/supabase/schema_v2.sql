-- =====================================================================================
-- MAHI v2 – record-level permanent storage (Supabase / PostgreSQL 15+)          rev 2
-- Run AFTER schema.sql in Supabase ▸ SQL Editor ▸ New query ▸ Run. Safe to re-run.
--
-- Security and integrity model
--  • One row per real record. Every row has: user_id (owner), stable text id, version (server),
--    created_at / updated_at (server clock), deleted_at (soft delete), change_xid + change_seq
--    (transaction-safe sync cursor), updated_by (device).
--  • Signed-in users can only READ their own rows (RLS). They have NO direct insert/update/delete
--    rights on any table: every write goes through public.mahi_push(), which enforces ownership,
--    validation, version checks, row locks, idempotency and all-or-nothing batches.
--  • History, audit and sync-result tables are written only by trusted database functions.
--  • Registration fails closed: only e-mails on mahi_allowed_emails can create an account,
--    and an empty list blocks every sign-up.
--  • Records that cannot fit the schema during migration are kept in mahi_legacy_records,
--    never discarded.
-- =====================================================================================

-- ---------- 0. Registration allow-list (fails closed) ----------
create table if not exists public.mahi_allowed_emails (
  email text primary key check (email = lower(email) and email like '%_@_%'),
  note  text,
  added_at timestamptz not null default now()
);
alter table public.mahi_allowed_emails enable row level security;      -- no policies: never readable through the API
alter table public.mahi_allowed_emails no force row level security;
revoke all on public.mahi_allowed_emails from public, anon, authenticated;

create or replace function public.mahi_check_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or not exists (select 1 from public.mahi_allowed_emails a where a.email = lower(new.email)) then
    raise exception 'MAHI: sign-up is not allowed for this address' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke all on function public.mahi_check_signup() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    drop trigger if exists mahi_check_signup on auth.users;
    create trigger mahi_check_signup before insert on auth.users for each row execute function public.mahi_check_signup();
  end if;
end $$;

-- schema.sql's trigger helper: triggers only, never callable through the API.
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'mahi_touch_updated_at') then
    revoke all on function public.mahi_touch_updated_at() from public, anon, authenticated;
  end if;
end $$;

-- ---------- 1. Change sequence and row stamp ----------
create sequence if not exists public.mahi_change_seq;
revoke all on sequence public.mahi_change_seq from public, anon, authenticated;

create or replace function public.mahi_row_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1; new.created_at := now(); new.updated_at := now();
  else
    if new.user_id <> old.user_id or new.id <> old.id then raise exception 'MAHI: owner and id cannot change'; end if;
    new.version := old.version + 1; new.created_at := old.created_at; new.updated_at := now();
  end if;
  new.change_xid := pg_current_xact_id();
  new.change_seq := nextval('public.mahi_change_seq');
  return new;
end; $$;
revoke all on function public.mahi_row_stamp() from public, anon, authenticated;

-- ---------- 2. Record tables ----------
create table if not exists public.mahi_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  id text not null default 'profile' check (id = 'profile'),
  display_name text check (char_length(display_name) <= 200),
  call_name text check (char_length(call_name) <= 100),
  organization text check (char_length(organization) <= 300),
  department text check (char_length(department) <= 300),
  time_zone text not null default 'Asia/Kolkata',
  preferences jsonb not null default '{}'::jsonb check (pg_column_size(preferences) < 1048576)
);

create table if not exists public.mahi_brands (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  name text not null check (char_length(name) between 1 and 300),
  services text check (char_length(services) <= 10000), notes text check (char_length(notes) <= 20000),
  is_core boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.mahi_campaigns (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  name text not null check (char_length(name) between 1 and 300),
  kind text check (char_length(kind) <= 100), festival text check (char_length(festival) <= 100),
  start_date date, end_date date, targets jsonb not null default '{}'::jsonb, notes text check (char_length(notes) <= 20000),
  primary key (user_id, id)
);

create table if not exists public.mahi_sets (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^S[0-9]{2}$'),
  festival text not null, prod_start date, prod_end date, pub_start date, pub_end date,
  primary key (user_id, id)
);

-- Planned production deliverables (the 616 and any later ones). Editor fields not promoted to columns live in `fields`.
create table if not exists public.mahi_deliverables (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^S[0-9]{2}-[A-Z0-9]+-(P|AI|VJ)[0-9]{1,3}$'),
  type text not null check (type in ('Poster', 'AI Video', 'VJ Video')),
  category text not null default 'creative' check (char_length(category) <= 60),
  set_code text not null, brand text not null, festival text not null, vj text,
  status text not null default 'Not Started', pub_status text not null default 'Not Scheduled',
  priority text not null default 'Medium',
  prod_start date, deadline date, completion_date date, pub_date date,
  qc text, final_approval text, correction text,
  fields jsonb not null default '{}'::jsonb check (pg_column_size(fields) < 1048576),
  primary key (user_id, id)
  -- Date/status consistency is validated by the app for NEW input. Existing records are stored exactly as they are.
);

-- Personal and non-festival work (SEO, Meta Ads, website, meetings…). Carry-forward keeps original_date.
create table if not exists public.mahi_tasks (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  title text not null check (char_length(title) <= 2000),
  category text not null default 'Personal' check (char_length(category) <= 100),
  priority text not null default 'Medium',
  task_date date not null, original_date date, deadline date, assignee text check (char_length(assignee) <= 200),
  stage text not null default 'Pending', status text not null default 'Pending',
  completed_at timestamptz, completed_on date, linked_id text, reminder text, notes text check (char_length(notes) <= 20000),
  primary key (user_id, id)
);

-- Work reported to MAHI – the audit trail behind Undo.
create table if not exists public.mahi_work_reports (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  report_date date not null, text text not null check (char_length(text) <= 10000),
  deliverable_ids text[] not null default '{}', task_ids text[] not null default '{}',
  previous jsonb not null default '{}'::jsonb, undone_at timestamptz,
  primary key (user_id, id)
);

-- Start / End Workday records.
create table if not exists public.mahi_work_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  work_date date not null, started_at timestamptz, ended_at timestamptz, tracked_minutes int check (tracked_minutes between 0 and 1440),
  plan jsonb not null default '{}'::jsonb, summary jsonb not null default '{}'::jsonb, reopened_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.mahi_focus_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  started_at timestamptz, ended_at timestamptz, minutes int not null check (minutes between 0 and 1440), label text check (char_length(label) <= 300),
  primary key (user_id, id)
);

-- One row per achievement key: an achievement can never be awarded twice.
create table if not exists public.mahi_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  unlocked_at timestamptz not null, kind text not null default 'achievement', detail jsonb not null default '{}'::jsonb,
  primary key (user_id, id)
);

create table if not exists public.mahi_notifications (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  ts timestamptz not null, type text not null check (char_length(type) <= 60), title text not null check (char_length(title) <= 500),
  body text check (char_length(body) <= 5000), ref text, read boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.mahi_notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  note_date date not null, title text check (char_length(title) <= 1000),
  category text check (char_length(category) <= 100),
  text text not null check (char_length(text) <= 200000),
  linked_id text, pinned boolean not null default false,
  primary key (user_id, id)
);

-- Common columns, added in one place (also upgrades tables from an earlier run of this file).
do $$
declare t text;
begin
  foreach t in array array['mahi_profiles', 'mahi_brands', 'mahi_campaigns', 'mahi_sets', 'mahi_deliverables', 'mahi_tasks', 'mahi_work_reports',
                           'mahi_work_sessions', 'mahi_focus_sessions', 'mahi_achievements', 'mahi_notifications', 'mahi_notes'] loop
    execute format('alter table public.%I add column if not exists version int not null default 1', t);
    execute format('alter table public.%I add column if not exists created_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table public.%I add column if not exists updated_by text', t);
    execute format('alter table public.%I add column if not exists change_xid xid8 not null default pg_current_xact_id()', t);
    execute format('alter table public.%I add column if not exists change_seq bigint not null default nextval(''public.mahi_change_seq'')', t);
    execute format('create index if not exists %I on public.%I (user_id, change_xid, change_seq)', t || '_sync', t);
  end loop;
end $$;
create index if not exists mahi_deliverables_status on public.mahi_deliverables (user_id, status);
create index if not exists mahi_deliverables_done on public.mahi_deliverables (user_id, completion_date) where completion_date is not null;
create index if not exists mahi_deliverables_deadline on public.mahi_deliverables (user_id, deadline);
create index if not exists mahi_tasks_day on public.mahi_tasks (user_id, task_date);
create index if not exists mahi_tasks_done on public.mahi_tasks (user_id, completed_on) where completed_on is not null;
create index if not exists mahi_work_reports_day on public.mahi_work_reports (user_id, report_date);
create index if not exists mahi_work_sessions_day on public.mahi_work_sessions (user_id, work_date);
create index if not exists mahi_notifications_ts on public.mahi_notifications (user_id, ts desc);

-- ---------- 3. History, audit, sync results, quarantine (written only by trusted functions) ----------
create table if not exists public.mahi_status_history (
  seq bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entity text not null, entity_id text not null, field text not null, from_value text, to_value text,
  op_id text, changed_at timestamptz not null default now()
);
create index if not exists mahi_status_history_entity on public.mahi_status_history (user_id, entity, entity_id, seq);

create table if not exists public.mahi_audit_log (
  seq bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entity text not null, entity_id text not null, action text not null,
  old_row jsonb, new_row jsonb, op_id text, at timestamptz not null default now()
);
create index if not exists mahi_audit_log_entity on public.mahi_audit_log (user_id, entity, entity_id, seq);

create table if not exists public.mahi_sync_ops (
  user_id uuid not null references auth.users (id) on delete cascade,
  op_id text not null check (op_id ~ '^[A-Za-z0-9_.:-]{8,80}$'),
  payload_hash text not null default '',
  device text, op_count int not null,
  result jsonb not null, applied_at timestamptz not null default now(),
  primary key (user_id, op_id)
);
alter table public.mahi_sync_ops add column if not exists payload_hash text not null default '';

-- Records that could not be stored in their normal table during migration (kept, never discarded).
create table if not exists public.mahi_legacy_records (
  seq bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_table text not null, source_id text, raw jsonb not null, reason text not null,
  op_id text, created_at timestamptz not null default now()
);
create index if not exists mahi_legacy_records_user on public.mahi_legacy_records (user_id, seq);

-- ---------- 4. Triggers ----------
create or replace function public.mahi_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text; o jsonb; n jsonb; op text := nullif(current_setting('mahi.op_id', true), '');
  tracked text[] := array['status', 'pub_status', 'qc', 'final_approval', 'correction', 'stage', 'deadline', 'task_date',
                          'completion_date', 'completed_on', 'deleted_at', 'undone_at'];
begin
  n := to_jsonb(new) - 'change_xid' - 'change_seq';
  o := case when tg_op = 'UPDATE' then to_jsonb(old) - 'change_xid' - 'change_seq' else '{}'::jsonb end;
  foreach k in array tracked loop
    if n ? k and (o -> k) is distinct from (n -> k) and not (tg_op = 'INSERT' and n -> k = 'null'::jsonb) then
      insert into public.mahi_status_history (user_id, entity, entity_id, field, from_value, to_value, op_id)
      values (new.user_id, tg_table_name, new.id, k, o ->> k, n ->> k, op);
    end if;
  end loop;
  insert into public.mahi_audit_log (user_id, entity, entity_id, action, old_row, new_row, op_id)
  values (new.user_id, tg_table_name, new.id, lower(tg_op), case when tg_op = 'UPDATE' then o end, n, op);
  return new;
end; $$;
revoke all on function public.mahi_history() from public, anon, authenticated;

create or replace function public.mahi_new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    insert into public.mahi_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  exception when others then
    raise warning 'MAHI: profile row not created (%); the app creates it on first sync', sqlerrm;  -- never block account creation
  end;
  return new;
end; $$;
revoke all on function public.mahi_new_profile() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    drop trigger if exists mahi_new_profile on auth.users;
    create trigger mahi_new_profile after insert on auth.users for each row execute function public.mahi_new_profile();
  end if;
end $$;

-- ---------- 5. Privileges and Row Level Security ----------
-- Every table: the owner may READ own rows. No insert/update/delete for any API role.
do $$
declare t text; p record;
begin
  foreach t in array array['mahi_profiles', 'mahi_brands', 'mahi_campaigns', 'mahi_sets', 'mahi_deliverables', 'mahi_tasks', 'mahi_work_reports',
                           'mahi_work_sessions', 'mahi_focus_sessions', 'mahi_achievements', 'mahi_notifications', 'mahi_notes',
                           'mahi_status_history', 'mahi_audit_log', 'mahi_sync_ops', 'mahi_legacy_records'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I no force row level security', t);   -- the owner (trusted functions only) is not restricted
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || ' owner read', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    if t not in ('mahi_status_history', 'mahi_audit_log', 'mahi_sync_ops', 'mahi_legacy_records') then
      execute format('drop trigger if exists %I on public.%I', t || '_stamp', t);
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.mahi_row_stamp()', t || '_stamp', t);
    end if;
    if t in ('mahi_deliverables', 'mahi_tasks', 'mahi_work_reports', 'mahi_work_sessions', 'mahi_notes') then
      execute format('drop trigger if exists %I on public.%I', t || '_history', t);
      execute format('create trigger %I after insert or update on public.%I for each row execute function public.mahi_history()', t || '_history', t);
    end if;
  end loop;
end $$;

-- ---------- 6. mahi_push: the only write path ----------
-- p_ops: [{ "table": "deliverables", "id": "S01-…", "base_version": 3 | null, "row": {…}, "quarantine_on_error": false }, …]
--   base_version null → create; an existing row is a conflict (never overwritten)
--   base_version n    → update only if the stored row is at version n
-- Behaviour
--   • all-or-nothing: if ANY op conflicts, nothing is written and {status:"conflict"} lists every conflict;
--     any other error rolls back the whole batch.
--   • rows are locked (FOR UPDATE) before checking, and updates repeat the version condition.
--   • idempotent: the same op_id with the same payload returns the stored result ({replay:true});
--     the same op_id with a different payload is an error. Simultaneous calls are serialised.
--   • quarantine_on_error (migration only): a row the schema cannot hold is copied to mahi_legacy_records.
create or replace function public.mahi_push(p_op_id text, p_device text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_hash text; v_prior record; op jsonb; tbl text; tname text; rid text; basev int; quarantine boolean;
  cur_v int; cur_row jsonb; rowdata jsonb; col record; cols text; newv int; newts timestamptz; rc int;
  conflicts jsonb := '[]'::jsonb; applied jsonb := '[]'::jsonb; quarantined jsonb := '[]'::jsonb; res jsonb;
  allowed text[] := array['profiles', 'brands', 'campaigns', 'sets', 'deliverables', 'tasks', 'work_reports', 'work_sessions',
                          'focus_sessions', 'achievements', 'notifications', 'notes'];
  protected text[] := array['user_id', 'id', 'version', 'created_at', 'updated_at', 'change_xid', 'change_seq', 'updated_by'];
begin
  if uid is null then raise exception 'MAHI: not signed in' using errcode = '28000'; end if;
  if p_op_id is null or p_op_id !~ '^[A-Za-z0-9_.:-]{8,80}$' then raise exception 'MAHI: invalid operation id' using errcode = '22023'; end if;
  if p_device is not null and char_length(p_device) > 80 then raise exception 'MAHI: device name too long' using errcode = '22023'; end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 or jsonb_array_length(p_ops) > 1000
     or pg_column_size(p_ops) > 8388608 then
    raise exception 'MAHI: ops must be a non-empty array of at most 1000 records (8 MB)' using errcode = '22023';
  end if;

  -- Serialise calls with the same op id, then check for a replay.
  v_hash := md5(p_ops::text);
  perform pg_advisory_xact_lock(hashtextextended(uid::text || '|' || p_op_id, 0));
  select s.payload_hash, s.result into v_prior from public.mahi_sync_ops s where s.user_id = uid and s.op_id = p_op_id;
  if found then
    if v_prior.payload_hash <> v_hash then
      raise exception 'MAHI: operation id % was already used for different data', p_op_id using errcode = '22023';
    end if;
    return v_prior.result || jsonb_build_object('replay', true);
  end if;
  perform set_config('mahi.op_id', p_op_id, true);

  -- Phase 1: validate, lock and version-check every target row. Nothing is written yet.
  for op in select value from jsonb_array_elements(p_ops) loop
    if jsonb_typeof(op) <> 'object' then raise exception 'MAHI: every op must be an object' using errcode = '22023'; end if;
    tbl := op ->> 'table'; rid := op ->> 'id';
    if tbl is null or not (tbl = any (allowed)) then raise exception 'MAHI: unknown table %', coalesce(tbl, '(none)') using errcode = '22023'; end if;
    if tbl = 'profiles' then rid := 'profile'; end if;
    if rid is null or char_length(rid) > 80 then raise exception 'MAHI: missing or invalid id' using errcode = '22023'; end if;
    if op ? 'base_version' and jsonb_typeof(op -> 'base_version') not in ('number', 'null') then raise exception 'MAHI: base_version must be a number' using errcode = '22023'; end if;
    if op ? 'row' and jsonb_typeof(op -> 'row') <> 'object' then raise exception 'MAHI: row must be an object' using errcode = '22023'; end if;
    basev := (op ->> 'base_version')::int;
    cur_v := null; cur_row := null;
    execute format('select version, to_jsonb(t) - ''change_xid'' - ''change_seq'' from public.%I t where user_id = $1 and id = $2 for update', 'mahi_' || tbl)
      into cur_v, cur_row using uid, rid;
    if (cur_v is not null and (basev is null or cur_v <> basev)) or (cur_v is null and basev is not null) then
      conflicts := conflicts || jsonb_build_object('table', tbl, 'id', rid, 'base_version', basev, 'server_version', cur_v, 'server_row', cur_row);
    end if;
  end loop;
  if jsonb_array_length(conflicts) > 0 then
    return jsonb_build_object('status', 'conflict', 'applied', '[]'::jsonb, 'quarantined', '[]'::jsonb, 'conflicts', conflicts,
                              'replay', false, 'server_time', now());   -- op id not consumed: the client resolves and retries
  end if;

  -- Phase 2: apply every op; a concurrent create or any error rolls back the whole batch.
  begin
    for op in select value from jsonb_array_elements(p_ops) loop
      tbl := op ->> 'table'; tname := 'mahi_' || tbl;
      rid := case when tbl = 'profiles' then 'profile' else op ->> 'id' end;
      basev := (op ->> 'base_version')::int;
      quarantine := coalesce((op ->> 'quarantine_on_error')::boolean, false);
      rowdata := '{}'::jsonb; cols := 'updated_by';
      -- keep only real, writable columns; empty strings become NULL for non-text columns (dates, numbers, json…)
      for col in select c.column_name, c.data_type from information_schema.columns c
                  where c.table_schema = 'public' and c.table_name = tname and not (c.column_name = any (protected))
                  order by c.ordinal_position loop
        if coalesce(op -> 'row', '{}'::jsonb) ? col.column_name then
          rowdata := rowdata || jsonb_build_object(col.column_name,
                       case when col.data_type not in ('text', 'character varying') and op -> 'row' ->> col.column_name = ''
                            then 'null'::jsonb else op -> 'row' -> col.column_name end);
          cols := cols || ', ' || format('%I', col.column_name);
        end if;
      end loop;
      rowdata := rowdata || jsonb_build_object('updated_by', p_device);

      begin
        if basev is null then
          execute format('insert into public.%1$I (user_id, id, %2$s) select $2, $3, %2$s from jsonb_populate_record(null::public.%1$I, $1) returning version, updated_at', tname, cols)
            into newv, newts using rowdata, uid, rid;
        else
          execute format('update public.%1$I t set (%2$s) = (select %2$s from jsonb_populate_record(t, $1)) where user_id = $2 and id = $3 and version = $4 returning version, updated_at', tname, cols)
            into newv, newts using rowdata, uid, rid, basev;
          get diagnostics rc = row_count;
          if rc <> 1 then raise exception 'MAHI: record % changed concurrently', rid using errcode = '40001'; end if;
        end if;
        applied := applied || jsonb_build_object('table', tbl, 'id', rid, 'version', newv, 'updated_at', newts);
      exception
        when unique_violation or serialization_failure then raise;              -- handled for the whole batch below
        when data_exception or integrity_constraint_violation then
          if not quarantine then raise; end if;
          insert into public.mahi_legacy_records (user_id, source_table, source_id, raw, reason, op_id)
          values (uid, tbl, rid, coalesce(op -> 'row', '{}'::jsonb), sqlstate || ': ' || sqlerrm, p_op_id);
          quarantined := quarantined || jsonb_build_object('table', tbl, 'id', rid, 'reason', sqlerrm);
      end;
    end loop;
  exception
    when unique_violation or serialization_failure then
      return jsonb_build_object('status', 'conflict', 'applied', '[]'::jsonb, 'quarantined', '[]'::jsonb,
                                'conflicts', jsonb_build_array(jsonb_build_object('table', tbl, 'id', rid, 'reason', 'changed or created on another device at the same time')),
                                'replay', false, 'server_time', now());
  end;

  res := jsonb_build_object('status', 'ok', 'applied', applied, 'quarantined', quarantined, 'conflicts', '[]'::jsonb,
                            'replay', false, 'server_time', now());
  insert into public.mahi_sync_ops (user_id, op_id, payload_hash, device, op_count, result)
  values (uid, p_op_id, v_hash, p_device, jsonb_array_length(p_ops), res);
  return res;
end; $$;
revoke all on function public.mahi_push(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mahi_push(text, text, jsonb) to authenticated;

-- ---------- 7. mahi_pull: transaction-safe paged download ----------
-- Cursor = "<change_xid>:<change_seq>" of the last row received (null = from the beginning).
-- Only rows from transactions older than every still-running transaction are returned, ordered by
-- (change_xid, change_seq), so a later-committing transaction can never be skipped and rows with the
-- same timestamp can never be lost between pages.
create or replace function public.mahi_pull(p_cursor text default null, p_limit int default 1000) returns jsonb
language plpgsql security invoker stable set search_path = '' as $$
declare
  uid uuid := auth.uid(); lim int := least(greatest(coalesce(p_limit, 1000), 1), 5000);
  cx xid8 := '0'::xid8; cs bigint := 0; horizon xid8 := pg_snapshot_xmin(pg_current_snapshot());
  q text := ''; t text; page jsonb; n int; last jsonb;
begin
  if uid is null then raise exception 'MAHI: not signed in' using errcode = '28000'; end if;
  if p_cursor is not null then
    if p_cursor !~ '^[0-9]+:[0-9]+$' then raise exception 'MAHI: invalid cursor' using errcode = '22023'; end if;
    cx := split_part(p_cursor, ':', 1)::xid8; cs := split_part(p_cursor, ':', 2)::bigint;
  end if;
  foreach t in array array['profiles', 'brands', 'campaigns', 'sets', 'deliverables', 'tasks', 'work_reports', 'work_sessions',
                           'focus_sessions', 'achievements', 'notifications', 'notes'] loop
    q := q || case when q = '' then '' else ' union all ' end
           || format('select %L as tbl, x.change_xid, x.change_seq, to_jsonb(x) - ''user_id'' - ''change_xid'' - ''change_seq'' as row from public.%I x where x.user_id = $1 and x.change_xid < $4 and (x.change_xid, x.change_seq) > ($2, $3)', t, 'mahi_' || t);
  end loop;
  execute format('select coalesce(jsonb_agg(jsonb_build_object(''table'', tbl, ''row'', row, ''cursor'', change_xid::text || '':'' || change_seq) order by change_xid, change_seq), ''[]''::jsonb), count(*)::int from (select * from (%s) u order by change_xid, change_seq limit $5) p', q)
    into page, n using uid, cx, cs, horizon, lim + 1;
  if n > lim then page := page - lim; end if;   -- drop the look-ahead row
  last := page -> (jsonb_array_length(page) - 1);
  return jsonb_build_object('changes', page, 'has_more', n > lim,
                            'next_cursor', coalesce(last ->> 'cursor', p_cursor), 'server_time', now());
end; $$;
revoke all on function public.mahi_pull(text, int) from public, anon, authenticated;
grant execute on function public.mahi_pull(text, int) to authenticated;

-- ---------- 8. Realtime (live notifications between devices; read access still governed by RLS) ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['mahi_deliverables', 'mahi_tasks', 'mahi_work_reports', 'mahi_notes', 'mahi_achievements', 'mahi_work_sessions'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

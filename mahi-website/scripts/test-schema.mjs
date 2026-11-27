// MAHI v2 database tests on a REAL PostgreSQL 17 server (embedded-postgres), with several concurrent sessions.
// Mirrors Supabase: tables owned by a normal (non-superuser, no BYPASSRLS) admin role, anon/authenticated roles,
// auth.users + auth.uid(), and a supabase_realtime publication. Covers RLS, write lock-down, atomic batches,
// row locks, idempotency under concurrency, cursor paging, fail-closed sign-up and migration of all 440 deliverables.
// This proves the SQL; it does not replace testing on the real Supabase project.
// Usage: node scripts/test-schema.mjs <folder whose node_modules has embedded-postgres and pg>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const toolDir = process.argv[2] || path.join(here, '..');
const req = createRequire(path.join(toolDir, 'package.json'));
const EmbeddedPostgres = (await import(pathToFileURL(req.resolve('embedded-postgres')).href)).default;
const pg = req('pg');

const PORT = 54331, PW = 'local-test-only';
const dataDir = path.join(toolDir, 'pgdata-' + Date.now());
const server = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: PW, port: PORT, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {} });
await server.initialise(); await server.start();
const connect = async () => { const c = new pg.Client({ host: 'localhost', port: PORT, user: 'postgres', password: PW, database: 'postgres' }); c.on('error', () => {}); await c.connect(); return c; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail) => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail != null ? '  → ' + String(detail).slice(0, 200) : ''}`); };
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
const err = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

try {
  // ---------- Supabase-like environment ----------
  const admin = await connect();
  await admin.query(`
    create role anon nologin; create role authenticated nologin;
    create role supa_admin nologin nosuperuser nobypassrls;      -- like Supabase's postgres role: owns the tables, is NOT a superuser
    create role auth_owner nologin; grant auth_owner to supa_admin;
    create schema auth authorization auth_owner;
    create table auth.users (id uuid primary key, email text); alter table auth.users owner to auth_owner;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, supa_admin; grant execute on function auth.uid() to anon, authenticated, supa_admin;
    grant create, usage on schema public to supa_admin; grant usage on schema public to anon, authenticated;
    create publication supabase_realtime; alter publication supabase_realtime owner to supa_admin;
  `);
  const runAsOwner = async (file) => { await admin.query('set role supa_admin'); try { await admin.query(fs.readFileSync(path.join(here, '../supabase', file), 'utf8')); } finally { await admin.query('reset role'); } };
  await runAsOwner('schema.sql'); await runAsOwner('schema_v2.sql'); await runAsOwner('migration_003_lock_v1_tables.sql');
  await runAsOwner('schema.sql'); await runAsOwner('schema_v2.sql'); await runAsOwner('migration_003_lock_v1_tables.sql');   // full re-run must be safe
  check('schema.sql + schema_v2.sql apply as a non-superuser owner, and re-run safely', true);

  // Session helpers: each "device" is its own database connection acting as an authenticated user.
  const session = async (uid) => { const c = await connect(); await c.query('set role ' + (uid ? 'authenticated' : 'anon')); await c.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || '']); return c; };
  const push = async (c, opId, ops) => (await c.query('select public.mahi_push($1, $2, $3::jsonb) as r', [opId, 'test-device', JSON.stringify(ops)])).rows[0].r;
  const one = async (c, sql, p) => (await c.query(sql, p)).rows;

  // ---------- 6. registration fails closed ----------
  const emptyList = await err(() => admin.query(`insert into auth.users values ('${A}', 'nathan@example.com')`));
  check('Empty allow-list blocks every sign-up (fails closed)', /not allowed/.test(emptyList || ''), emptyList);
  await admin.query("insert into public.mahi_allowed_emails (email) values ('nathan@example.com'), ('nathan+mahitest@example.com')");
  await admin.query(`insert into auth.users values ('${A}', 'Nathan@Example.com'), ('${B}', 'nathan+mahitest@example.com')`);
  const stranger = await err(() => admin.query("insert into auth.users values ('33333333-3333-3333-3333-333333333333', 'stranger@example.com')"));
  check('Allowed addresses can sign up; others are refused', /not allowed/.test(stranger || ''), stranger);
  check('A profile row is created for each new account', (await one(admin, 'select count(*)::int n from public.mahi_profiles'))[0].n === 2);

  const a = await session(A), a2 = await session(A), b = await session(B), anon = await session(null);

  // ---------- 2/3. direct writes and fake history are impossible ----------
  const directIns = await err(() => a.query("insert into public.mahi_tasks (user_id, id, title, task_date) values ($1, 'X1', 'direct', '2026-11-27')", [A]));
  check('Signed-in users cannot insert directly (must use mahi_push)', /permission denied/.test(directIns || ''), directIns);
  const directUpd = await err(() => a.query("update public.mahi_profiles set call_name = 'x'"));
  check('Signed-in users cannot update directly', /permission denied/.test(directUpd || ''), directUpd);
  for (const t of ['mahi_status_history', 'mahi_audit_log', 'mahi_sync_ops', 'mahi_legacy_records']) {
    const e = await err(() => a.query(`insert into public.${t} (user_id) values ($1)`, [A]));
    check(`Fabricated rows cannot be written to ${t}`, /permission denied/.test(e || ''), e);
  }
  const allowRead = await err(() => a.query('select * from public.mahi_allowed_emails'));
  check('The allow-list cannot be read through the API', /permission denied/.test(allowRead || ''), allowRead);
  const seqUse = await err(() => a.query("select nextval('public.mahi_change_seq')"));
  check('The sync sequence cannot be advanced by users', /permission denied/.test(seqUse || ''), seqUse);

  // ---------- normal save, defaults, ownership ----------
  const r1 = await push(a, 'op-0000001', [
    { table: 'deliverables', id: 'S01-VALLUVAM-P01', row: { type: 'Poster', set_code: 'S01', brand: 'Valluvam', festival: 'Christmas', status: 'Completed', completion_date: '2026-11-27', deadline: '2026-12-03', prod_start: '2026-11-27', user_id: B, version: 99, not_a_column: 'ignored' } },
    { table: 'tasks', id: 'T1', row: { title: 'SEO blog: Pongal offers', task_date: '2026-11-27', status: 'Completed', completed_on: '2026-11-27', category: 'SEO', deadline: '' } },
    { table: 'work_reports', id: 'R1', row: { report_date: '2026-11-27', text: 'I completed one poster and one SEO blog', deliverable_ids: ['S01-VALLUVAM-P01'], task_ids: ['T1'] } },
  ]);
  check('Work report batch saved atomically (3 records, version 1)', r1.status === 'ok' && r1.applied.length === 3 && r1.applied.every((x) => x.version === 1), JSON.stringify(r1.applied.map((x) => x.table)));
  const d1 = (await one(a, "select user_id, version, pub_status, priority from public.mahi_deliverables where id = 'S01-VALLUVAM-P01'"))[0];
  check('Owner and version cannot be forged in the payload; defaults kept', d1.user_id === A && d1.version === 1 && d1.pub_status === 'Not Scheduled', JSON.stringify(d1));
  check('Empty date strings are stored as NULL instead of failing', (await one(a, "select deadline from public.mahi_tasks where id = 'T1'"))[0].deadline === null);

  // ---------- 8. idempotency ----------
  const replay = await push(a, 'op-0000001', JSON.parse(JSON.stringify([
    { table: 'deliverables', id: 'S01-VALLUVAM-P01', row: { type: 'Poster', set_code: 'S01', brand: 'Valluvam', festival: 'Christmas', status: 'Completed', completion_date: '2026-11-27', deadline: '2026-12-03', prod_start: '2026-11-27', user_id: B, version: 99, not_a_column: 'ignored' } },
    { table: 'tasks', id: 'T1', row: { title: 'SEO blog: Pongal offers', task_date: '2026-11-27', status: 'Completed', completed_on: '2026-11-27', category: 'SEO', deadline: '' } },
    { table: 'work_reports', id: 'R1', row: { report_date: '2026-11-27', text: 'I completed one poster and one SEO blog', deliverable_ids: ['S01-VALLUVAM-P01'], task_ids: ['T1'] } },
  ])));
  check('Retrying the same operation returns the stored result (no second write)', replay.replay === true && replay.status === 'ok' && (await one(a, 'select count(*)::int n from public.mahi_sync_ops'))[0].n === 1);
  const reuse = await err(() => push(a, 'op-0000001', [{ table: 'tasks', id: 'T-other', row: { title: 'different data', task_date: '2026-11-27' } }]));
  check('Reusing an operation ID with different data is rejected (never a fake success)', /already used for different data/.test(reuse || ''), reuse);
  check('…and that different data was not written', (await one(a, "select count(*)::int n from public.mahi_tasks where id = 'T-other'"))[0].n === 0);

  // Simultaneous retries of the same op on two connections.
  await a.query('begin');
  const firstP = push(a, 'op-0000002', [{ table: 'tasks', id: 'T2', row: { title: 'Meta Ads report', task_date: '2026-11-27' } }]);
  await firstP;
  const secondP = push(a2, 'op-0000002', [{ table: 'tasks', id: 'T2', row: { title: 'Meta Ads report', task_date: '2026-11-27' } }]);
  let secondDone = false; secondP.then(() => { secondDone = true; }, () => { secondDone = true; });
  await sleep(400);
  const waited = !secondDone;
  await a.query('commit');
  const second = await secondP;
  check('A simultaneous retry waits for the first, then replays it', waited && second.replay === true && (await one(a, "select count(*)::int n from public.mahi_tasks where id = 'T2'"))[0].n === 1, `waited=${waited}, replay=${second.replay}`);

  // ---------- 1. concurrent updates ----------
  await a.query('begin');
  const upd1 = await push(a, 'op-0000003', [{ table: 'deliverables', id: 'S01-VALLUVAM-P01', base_version: 1, row: { pub_status: 'Scheduled' } }]);
  const upd2P = push(a2, 'op-0000004', [{ table: 'deliverables', id: 'S01-VALLUVAM-P01', base_version: 1, row: { status: 'Not Started' } }]);
  let upd2Done = false; upd2P.then(() => { upd2Done = true; });
  await sleep(400);
  const blocked = !upd2Done;
  await a.query('commit');
  const upd2 = await upd2P;
  const after = (await one(a, "select status, pub_status, version from public.mahi_deliverables where id = 'S01-VALLUVAM-P01'"))[0];
  check('Two devices updating the same record at once: the second waits on the row lock', blocked, `blocked=${blocked}`);
  check('…then gets a conflict, and the first update is kept', upd1.status === 'ok' && upd2.status === 'conflict' && after.status === 'Completed' && after.pub_status === 'Scheduled' && after.version === 2, JSON.stringify(after));
  const stale = await push(a, 'op-0000005', [{ table: 'deliverables', id: 'S01-VALLUVAM-P01', base_version: 1, row: { status: 'Not Started' } }]);
  check('A stale version is a conflict that returns the newer server row', stale.status === 'conflict' && stale.conflicts[0].server_version === 2 && stale.conflicts[0].server_row.pub_status === 'Scheduled');
  const createOver = await push(a, 'op-0000006', [{ table: 'tasks', id: 'T1', row: { title: 'blank copy', task_date: '2026-11-27' } }]);
  check('"Create" over an existing record is a conflict, never an overwrite', createOver.status === 'conflict');

  // Concurrent creation of the same new record.
  await a.query('begin');
  const c1 = await push(a, 'op-0000007', [{ table: 'tasks', id: 'T-race', row: { title: 'from laptop', task_date: '2026-11-27' } }]);
  const c2P = push(a2, 'op-0000008', [{ table: 'tasks', id: 'T-race', row: { title: 'from phone', task_date: '2026-11-27' } }]);
  await sleep(400);
  await a.query('commit');
  const c2 = await c2P;
  const race = (await one(a, "select title from public.mahi_tasks where id = 'T-race'"))[0];
  check('Same new record created on two devices at once: one wins, the other gets a conflict', c1.status === 'ok' && c2.status === 'conflict' && race.title === 'from laptop', `${c1.status}/${c2.status}/${race.title}`);

  // ---------- 4. all-or-nothing ----------
  const mixed = await push(a, 'op-0000009', [
    { table: 'deliverables', id: 'S01-VALLUVAM-P02', row: { type: 'Poster', set_code: 'S01', brand: 'Valluvam', festival: 'Christmas', status: 'Completed' } },
    { table: 'deliverables', id: 'S01-VALLUVAM-P01', base_version: 1, row: { status: 'Not Started' } },   // stale (now v2) → conflict
  ]);
  check('A batch with one conflict writes nothing at all', mixed.status === 'conflict' && (await one(a, "select count(*)::int n from public.mahi_deliverables where id = 'S01-VALLUVAM-P02'"))[0].n === 0);
  check('…and its operation ID stays free for the resolved retry', (await one(a, "select count(*)::int n from public.mahi_sync_ops where op_id = 'op-0000009'"))[0].n === 0);
  const badMid = await err(() => push(a, 'op-0000010', [
    { table: 'tasks', id: 'T-atomic', row: { title: 'first op', task_date: '2026-11-27' } },
    { table: 'tasks', id: 'T-bad', row: { title: 'bad date', task_date: '2026-13-45' } },
  ]));
  check('A batch with an invalid value is rolled back completely', !!badMid && (await one(a, "select count(*)::int n from public.mahi_tasks where id = 'T-atomic'"))[0].n === 0, badMid);
  const unknown = await err(() => push(a, 'op-0000011', [{ table: 'secrets', id: 'x', row: {} }]));
  check('Unknown tables are refused', /unknown table/.test(unknown || ''), unknown);

  // ---------- isolation ----------
  check('User B sees none of A\'s records', (await one(b, 'select count(*)::int n from public.mahi_deliverables'))[0].n === 0 && (await one(b, 'select public.mahi_pull() as r'))[0].r.changes.every((c) => c.table === 'profiles'));
  const bSame = await push(b, 'op-0000001', [{ table: 'tasks', id: 'T1', row: { title: 'B task', task_date: '2026-11-27' } }]);
  check('B can use the same record and operation IDs without touching A', bSame.status === 'ok' && (await one(a, "select title from public.mahi_tasks where id = 'T1'"))[0].title === 'SEO blog: Pongal offers');
  const bHist = await one(b, 'select count(*)::int n from public.mahi_audit_log');
  const aHist = await one(a, 'select count(*)::int n from public.mahi_audit_log');
  check('History and audit are private to each user', bHist[0].n >= 1 && aHist[0].n > bHist[0].n, `A=${aHist[0].n} B=${bHist[0].n}`);
  for (const [label, sql] of [['read records', 'select * from public.mahi_deliverables'], ['call mahi_push', "select public.mahi_push('op-anon-01', 'x', '[{\"table\":\"tasks\",\"id\":\"x\",\"row\":{}}]'::jsonb)"], ['call mahi_pull', 'select public.mahi_pull()'], ['read v1 documents', 'select * from public.mahi_docs']]) {
    const e = await err(() => anon.query(sql));
    check(`Signed-out visitors cannot ${label}`, /permission denied|not signed in/.test(e || ''), e);
  }
  const delA = await err(() => a.query("delete from public.mahi_deliverables where id = 'S01-VALLUVAM-P01'"));
  check('Records cannot be hard-deleted', /permission denied/.test(delA || ''), delA);

  // ---------- history ----------
  const hist = await one(a, "select field, from_value, to_value, op_id from public.mahi_status_history where entity_id = 'S01-VALLUVAM-P01' order by seq");
  check('Every status change is recorded with its operation ID', hist.some((h) => h.field === 'pub_status' && h.to_value === 'Scheduled' && h.op_id === 'op-0000003') && hist.every((h) => h.op_id), hist.map((h) => `${h.field}:${h.to_value}@${h.op_id}`).join(', '));
  const soft = await push(a, 'op-0000012', [{ table: 'tasks', id: 'T2', base_version: 1, row: { deleted_at: '2026-11-27T10:00:00Z' } }]);
  const softRow = (await one(a, "select deleted_at from public.mahi_tasks where id = 'T2'"))[0];
  check('Soft delete keeps the record (recoverable)', soft.status === 'ok' && softRow.deleted_at);

  // ---------- 5. cursor paging ----------
  const many = Array.from({ length: 25 }, (_, i) => ({ table: 'notes', id: 'N' + String(i).padStart(2, '0'), row: { note_date: '2026-11-27', text: 'note ' + i } }));
  await push(a, 'op-0000013', many);   // one transaction → all 25 share the same timestamp
  const pageAll = async (c, start) => { let cur = start, out = [], pages = 0; for (;;) { const r = (await c.query('select public.mahi_pull($1, 10) as r', [cur])).rows[0].r; out.push(...r.changes); pages++; cur = r.next_cursor; if (!r.has_more) break; } return { out, cur, pages }; };
  const full = await pageAll(a, null);
  const ids = full.out.map((x) => x.table + ':' + x.row.id);
  const notes = ids.filter((x) => x.startsWith('notes:'));
  check('Paging returns 25 same-timestamp rows exactly once across pages', notes.length === 25 && new Set(ids).size === ids.length && full.pages >= 3, `${notes.length} notes, ${full.pages} pages`);
  // A transaction that started earlier but commits later must not be skipped.
  await a.query('begin');
  await push(a, 'op-0000014', [{ table: 'notes', id: 'N-slow', row: { note_date: '2026-11-27', text: 'slow transaction' } }]);
  await push(a2, 'op-0000015', [{ table: 'notes', id: 'N-fast', row: { note_date: '2026-11-27', text: 'fast transaction' } }]);
  const mid = await pageAll(a2, full.cur);
  const midIds = mid.out.map((x) => x.row.id);
  await a.query('commit');
  const fin = await pageAll(a2, mid.cur);
  const finIds = fin.out.map((x) => x.row.id);
  check('A later-committing transaction is never skipped by the cursor', !midIds.includes('N-slow') && !midIds.includes('N-fast') && finIds.includes('N-slow') && finIds.includes('N-fast'), `mid=[${midIds}] after=[${finIds}]`);
  const badCursor = await err(() => a.query("select public.mahi_pull('drop table x', 10)"));
  check('Malformed cursors are refused', /invalid cursor/.test(badCursor || ''), badCursor);

  // ---------- 7. migration of all 440 deliverables + incompatible legacy records ----------
  const ctx = { console, Math, JSON, Date, Intl }; ctx.self = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(here, '../src/legacy/data.js'), 'utf8'), ctx);
  const plan = ctx.MAHI_DATA.buildAssets();
  const toRow = (x) => { const { id, type, set, brand, festival, vj, status, pubStatus, priority, prodStart, deadline, completionDate, pubDate, qc, finalApproval, correction, ...rest } = x;
    return { type, set_code: set, brand, festival, vj, status, pub_status: pubStatus, priority, prod_start: prodStart, deadline, completion_date: completionDate, pub_date: pubDate, qc, final_approval: finalApproval, correction, fields: rest }; };
  const m = await session(B);
  let applied = 0, quarantined = 0;
  for (let i = 0; i < plan.length; i += 200) {
    const r = await push(m, 'migrate-' + String(i).padStart(4, '0'), plan.slice(i, i + 200).map((x) => ({ table: 'deliverables', id: x.id, row: toRow(x), quarantine_on_error: true })));
    applied += r.applied.length; quarantined += r.quarantined.length;
  }
  const stored = (await one(m, 'select count(*)::int n, count(distinct id)::int d from public.mahi_deliverables'))[0];
  check(`All ${plan.length} planned deliverables migrate (none quarantined)`, plan.length === 440 && applied === 440 && quarantined === 0 && stored.n === 440 && stored.d === 440, `plan=${plan.length} applied=${applied} quarantined=${quarantined} stored=${stored.n}`);
  const sample = (await one(m, "select fields from public.mahi_deliverables where id = $1", [plan[0].id]))[0];
  check('Every editor field is preserved (inside fields)', Object.keys(sample.fields).length >= 20, Object.keys(sample.fields).length + ' fields');
  const legacy = [
    { table: 'deliverables', id: 'S09-LEGACY-P03', row: { type: 'Poster', set_code: 'S09', brand: 'Valluvam', festival: 'Christmas', status: 'Not Started', completion_date: '2026-11-01', prod_start: '2026-12-20', deadline: '2026-12-01' } },
    { table: 'tasks', id: 'Tmwx-blank', row: { title: '   ', task_date: '2026-11-26' } },
    { table: 'deliverables', id: 'S09-LEGACY-P04', row: { type: 'Reel', set_code: 'S09', brand: 'Valluvam', festival: 'Christmas' } },
    { table: 'tasks', id: 'T-long', row: { title: 'L'.repeat(5000), task_date: '2026-11-26' } },
    { table: 'notes', id: 'N-huge', row: { note_date: '2026-11-26', text: 'Q'.repeat(300000) } },
    { table: 'tasks', id: 'T-baddate', row: { title: 'bad date', task_date: '2026-13-45' } },
  ];
  const lr = await push(m, 'migrate-legacy-01', legacy.map((x) => Object.assign({ quarantine_on_error: true }, x)));
  const q = await one(m, 'select source_table, source_id, length(raw::text) as size from public.mahi_legacy_records order by seq');
  check('Imperfect but valid legacy records are stored as they are', lr.status === 'ok' && lr.applied.some((x) => x.id === 'S09-LEGACY-P03') && lr.applied.some((x) => x.id === 'Tmwx-blank'));
  check('Records the schema cannot hold are quarantined with their full data, not lost', lr.quarantined.length === 4 && q.length === 4 && q.find((x) => x.source_id === 'N-huge').size > 300000 && lr.applied.length + lr.quarantined.length === legacy.length, q.map((x) => x.source_id).join(', '));

  // ---------- 9. function security review (catalogue checks) ----------
  const fns = await one(admin, `select p.proname, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') cfg,
      has_function_privilege('anon', p.oid, 'execute') anon_x, has_function_privilege('authenticated', p.oid, 'execute') auth_x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'mahi%' order by 1`);
  check('Every MAHI function pins search_path', fns.every((f) => /search_path=/.test(f.cfg)), fns.map((f) => f.proname + ':' + f.cfg).join(' | '));
  check('No MAHI function is executable by signed-out visitors', fns.every((f) => !f.anon_x));
  check('Signed-in users can execute only mahi_push and mahi_pull', fns.filter((f) => f.auth_x).map((f) => f.proname).sort().join(',') === 'mahi_pull,mahi_push', fns.filter((f) => f.auth_x).map((f) => f.proname).join(','));
  const grants = await one(admin, `select table_name, string_agg(privilege_type, ',' order by privilege_type) privs from information_schema.role_table_grants
    where table_schema = 'public' and table_name like 'mahi%' and grantee in ('anon', 'authenticated') group by table_name, grantee order by 1`);
  check('API roles hold only SELECT on every MAHI table, including v1 mahi_docs / mahi_reports', grants.length === 18 && grants.every((g) => g.privs === 'SELECT'), grants.map((g) => g.table_name + ':' + g.privs).join(' | '));
  const v1w = [await err(() => a.query("insert into public.mahi_docs (user_id, doc_key, body) values ($1, 'meta', '{}')", [A])), await err(() => a.query("insert into public.mahi_reports (user_id, title) values ($1, 'x')", [A])), await err(() => a.query('delete from public.mahi_reports'))];
  check('v1 tables are read-only (no insert / delete) and still exist', v1w.every((e) => /permission denied/.test(e || '')) && (await one(a, 'select count(*)::int n from public.mahi_docs'))[0].n === 0, v1w.join(' | '));
  const v1pol = await one(admin, "select tablename, cmd from pg_policies where tablename in ('mahi_docs', 'mahi_reports') order by 1, 2");
  check('v1 tables keep only owner-read policies', v1pol.length === 2 && v1pol.every((p) => p.cmd === 'SELECT'), v1pol.map((p) => p.tablename + ':' + p.cmd).join(', '));
  const rls = await one(admin, `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'mahi%'`);
  check('RLS is on for every MAHI table (2 from schema.sql + 17 from schema_v2.sql)', rls.length === 19 && rls.every((r) => r.relrowsecurity), rls.length + ' tables');

  for (const c of [a, a2, b, anon, m]) await c.end();
  await admin.end();
} catch (e) {
  console.error('ERROR', e.message, e.where || ''); results.push(false);
} finally {
  await server.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} passed (PostgreSQL 17 server, concurrent sessions)`);
process.exit(pass === results.length ? 0 : 1);

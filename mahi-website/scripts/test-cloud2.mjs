// MAHI v2 cloud sync (src/legacy/cloud2.js) end-to-end against a REAL PostgreSQL 17 server running the real
// schema files (schema.sql, schema_v2.sql, migration_003). Each "device" is its own engine instance (own browser
// storage) talking to the database through its own connection as an authenticated user, exactly like
// supabase.rpc('mahi_push' | 'mahi_pull'). Covers first upload, read-back on a fresh browser, cross-device edits,
// conflicts, lost replies (idempotent retry), offline queue across restarts, soft delete, user isolation,
// sign-out/clear-storage recovery and the plan-update lock.
// This proves the client + SQL together; it does NOT replace a test on the real Supabase project.
// Usage: node scripts/test-cloud2.mjs <folder whose node_modules has embedded-postgres and pg>
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
const src = (f) => fs.readFileSync(path.join(here, '../src/legacy', f), 'utf8');

const PORT = 54332, PW = 'local-test-only';
const server = new EmbeddedPostgres({ databaseDir: path.join(toolDir, 'pgdata-c2-' + Date.now()), user: 'postgres', password: PW, port: PORT, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {} });
await server.initialise(); await server.start();
const connect = async () => { const c = new pg.Client({ host: 'localhost', port: PORT, user: 'postgres', password: PW, database: 'postgres' }); c.on('error', () => {}); await c.connect(); return c; };
const results = [];
const check = (name, ok, detail) => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail != null ? '  → ' + String(detail).slice(0, 220) : ''}`); };
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
const tick = () => new Promise((r) => setTimeout(r, 30));

// ---------- one device = one browser profile + one engine + one DB session ----------
function browser() { return { ls: {} }; }
async function device(br, uid, opts = {}) {
  const db = await connect();
  await db.query('set role authenticated'); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  const net = { online: true, loseNextReply: false, calls: 0 };
  const ctx = {
    console: { log() {}, warn() {}, error: console.error }, Math, JSON, Promise, Intl, Date,
    setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},   // timers never fire: the test drives every save and sync step itself
    localStorage: { getItem: (k) => (k in br.ls ? br.ls[k] : null), setItem: (k, v) => { br.ls[k] = String(v); }, removeItem: (k) => { delete br.ls[k]; } },
    navigator: { get onLine() { return net.online; } }, MAHI_STORAGE_KEY: 'mahi.state.' + uid,
  };
  ctx.self = ctx; vm.createContext(ctx);
  ['data.js', 'store.js', 'cloud2.js', 'report.js'].forEach((f) => vm.runInContext(src(f), ctx, { filename: f }));
  ctx.MAHI_STORE.load();
  const adapter = {
    label: 'test cloud', device: opts.name || 'dev',
    async rpc(name, args) {
      net.calls++;
      if (!net.online) throw Object.assign(new Error('Failed to fetch'), { network: true });
      const sql = name === 'mahi_push' ? 'select public.mahi_push($1, $2, $3::jsonb) as r' : 'select public.mahi_pull($1, $2) as r';
      const params = name === 'mahi_push' ? [args.p_op_id, args.p_device, JSON.stringify(args.p_ops)] : [args.p_cursor, args.p_limit];
      const r = (await db.query(sql, params)).rows[0].r;
      if (net.loseNextReply && name === 'mahi_push') { net.loseNextReply = false; throw Object.assign(new Error('connection reset'), { network: true }); }
      return r;
    },
  };
  const S = ctx.MAHI_STORE, Y = ctx.MAHI_SYNC;
  return { S, Y, D: ctx.MAHI_DATA, R: ctx.MAHI_REPORT, net, db, adapter, start: () => Y.start(adapter), close: () => { Y.stop(); return db.end(); } };
}
const count = async (c, sql, p) => (await c.query(sql, p)).rows[0];

try {
  // ---------- Supabase-like environment + real schema ----------
  const admin = await connect();
  await admin.query(`
    create role anon nologin; create role authenticated nologin; create role supa_admin nologin nosuperuser nobypassrls;
    create role auth_owner nologin; grant auth_owner to supa_admin; create schema auth authorization auth_owner;
    create table auth.users (id uuid primary key, email text); alter table auth.users owner to auth_owner;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, supa_admin; grant execute on function auth.uid() to anon, authenticated, supa_admin;
    grant create, usage on schema public to supa_admin; grant usage on schema public to anon, authenticated;
    create publication supabase_realtime; alter publication supabase_realtime owner to supa_admin;`);
  await admin.query('set role supa_admin');
  for (const f of ['schema.sql', 'schema_v2.sql', 'migration_003_lock_v1_tables.sql']) await admin.query(fs.readFileSync(path.join(here, '../supabase', f), 'utf8'));
  await admin.query('reset role');
  await admin.query("insert into public.mahi_allowed_emails (email) values ('a@example.com'), ('b@example.com')");
  await admin.query(`insert into auth.users values ('${A}', 'a@example.com'), ('${B}', 'b@example.com')`);

  // ---------- 1. first upload from a laptop that already has work ----------
  const lapBr = browser();
  const lap = await device(lapBr, A, { name: 'laptop' });
  lap.S.updateAssets(['S01-VALLUVAM-P01', 'S01-VALLUVAM-P02', 'S01-PALMCAFE-VJ01'], { status: 'Completed' }, { silent: true });
  const task = lap.S.addCustomTask({ title: 'SEO blog: Pongal recipes', category: 'SEO' });
  lap.S.updateCustomTask(task.id, { status: 'Completed' });
  const note = lap.S.addNote({ title: 'Client call', text: 'Valluvam wants a gift-box poster.' });
  await lap.start();
  const srv = await count(admin, `select (select count(*) from mahi_deliverables where user_id=$1)::int d, (select count(*) from mahi_deliverables where user_id=$1 and status='Completed')::int done,
    (select count(*) from mahi_tasks where user_id=$1)::int t, (select count(*) from mahi_notes where user_id=$1)::int n, (select count(*) from mahi_sets where user_id=$1)::int s`, [A]);
  check('First sign-in uploads every record through mahi_push', srv.d === 440 && srv.done === 3 && srv.t === 1 && srv.n === 1 && srv.s === 5, JSON.stringify(srv));
  check('Status is "synced" only after the server acknowledged', lap.Y.status === 'synced' && /Cloud synced \d\d:\d\d IST/.test(lap.Y.detail), lap.Y.detail);
  check('Nothing left unsent (safe to clear this browser)', lap.Y.canDropLocalCopy(), lap.Y.unsyncedParts().slice(0, 3));

  // ---------- 2. a fresh browser (other device, or cleared storage) gets everything back ----------
  const phone = await device(browser(), A, { name: 'phone' });
  check('Fresh browser starts empty before sign-in sync', phone.S.state.assets.filter(phone.D.isDone).length === 0);
  await phone.start();
  check('Fresh browser receives completed work, tasks and notes', phone.S.state.assets.filter(phone.D.isDone).length === 3 && phone.S.state.customTasks.some((x) => x.id === task.id && x.status === 'Completed') && phone.S.state.notes.some((x) => x.id === note.id && /gift-box/.test(x.text)));
  const v1 = await count(admin, "select max(version)::int v from mahi_deliverables where user_id=$1", [A]);
  check('Fresh browser never pushes its empty copy over the cloud', v1.v === 1 && phone.Y.status === 'synced' && Object.keys(phone.Y.conflicts()).length === 0, `max version ${v1.v}, status ${phone.Y.status}`);

  // ---------- 3. edits flow between devices ----------
  phone.S.updateAssets(['S02-IGOACADEMY-P03'], { status: 'Completed' }, { silent: true }); await phone.Y.pushNow();
  await lap.Y.pull();
  check('Change on the phone reaches the laptop', lap.S.asset('S02-IGOACADEMY-P03').status === 'Completed');
  lap.S.updateNote(note.id, { text: 'Valluvam wants a gift-box poster. Deadline 2 Dec.' }); await lap.Y.pushNow(); await phone.Y.pull();
  check('Note edit on the laptop reaches the phone', phone.S.state.notes.find((x) => x.id === note.id).text.includes('2 Dec'));

  // ---------- 4. the same record edited on both devices → conflict, never a silent overwrite ----------
  lap.S.updateAssets(['S01-PROTEINCUTS-P01'], { status: 'Under Review' }, { silent: true }); await lap.Y.pushNow();
  phone.S.updateAssets(['S01-PROTEINCUTS-P01'], { status: 'Correction Required' }, { silent: true }); await phone.Y.pushNow();
  const srvRow = await count(admin, "select status, version from mahi_deliverables where user_id=$1 and id='S01-PROTEINCUTS-P01'", [A]);
  check('Second device does not overwrite the first device’s newer change', srvRow.status === 'Under Review' && phone.Y.status === 'conflict' && phone.Y.conflicts().length === 1, `${srvRow.status} v${srvRow.version}, phone ${phone.Y.status}`);
  check('Other records still sync while one conflict waits', lap.Y.status === 'synced');
  phone.Y.resolve(phone.Y.conflicts()[0].key, 'mine'); await phone.Y.pushNow();
  const afterMine = await count(admin, "select status, version from mahi_deliverables where user_id=$1 and id='S01-PROTEINCUTS-P01'", [A]);
  check('"Keep this device’s version" writes on top of the newer server version', afterMine.status === 'Correction Required' && afterMine.version === srvRow.version + 1 && phone.Y.status === 'synced', `${afterMine.status} v${afterMine.version}`);
  await lap.Y.pull();
  lap.S.updateAssets(['S01-PROTEINCUTS-P02'], { status: 'Editing' }, { silent: true }); await lap.Y.pushNow();
  phone.S.updateAssets(['S01-PROTEINCUTS-P02'], { status: 'Planning' }, { silent: true }); await phone.Y.pushNow();
  phone.Y.resolve(phone.Y.conflicts()[0].key, 'theirs'); await phone.Y.pushNow();
  check('"Use the other device’s version" adopts the server record', phone.S.asset('S01-PROTEINCUTS-P02').status === 'Editing' && phone.Y.status === 'synced');

  // ---------- 5. reply lost after the server saved → retry with the same op id, applied once ----------
  phone.net.loseNextReply = true;
  phone.S.updateAssets(['S03-VALLUVAM-P01'], { status: 'Completed' }, { silent: true }); await phone.Y.pushNow();
  check('Lost reply leaves the operation queued (not shown as synced)', phone.Y.pending === 1 && phone.Y.status !== 'synced', `pending ${phone.Y.pending}, ${phone.Y.status}`);
  await phone.Y.pushNow();
  const once = await count(admin, "select count(*)::int n from mahi_status_history where user_id=$1 and entity_id='S03-VALLUVAM-P01' and field='status' and to_value='Completed'", [A]);
  const replays = await count(admin, "select count(*)::int n from mahi_sync_ops where user_id=$1", [A]);
  check('Retry reuses the op id: the change is applied exactly once', once.n === 1 && phone.Y.pending === 0 && phone.Y.status === 'synced', `history rows ${once.n}, ops ${replays.n}`);

  // ---------- 6. offline: work is queued, survives a restart, uploads when back online ----------
  const tabBr = browser();
  const tab = await device(tabBr, A, { name: 'tablet' }); await tab.start();
  tab.net.online = false;
  tab.S.updateAssets(['S04-IGONURSERY-P01'], { status: 'Completed' }, { silent: true });
  const offTask = tab.S.addCustomTask({ title: 'Reels scheduling – 5 posts', category: 'Social Media' });
  await tab.Y.pushNow();
  check('Offline: status says saved on this device, not synced', tab.Y.status === 'offline' && tab.Y.pending >= 1, tab.Y.detail);
  tab.S.flush(); await tab.close();                                    // the page is closed (pagehide flushes the save delay)
  const tab2 = await device(tabBr, A, { name: 'tablet' });            // browser restarted, still the same storage
  check('Offline work survives a restart in the browser copy', tab2.S.asset('S04-IGONURSERY-P01').status === 'Completed' && tab2.S.state.customTasks.some((x) => x.id === offTask.id));
  await tab2.start();
  const up = await count(admin, "select (select status from mahi_deliverables where user_id=$1 and id='S04-IGONURSERY-P01') s, (select count(*) from mahi_tasks where user_id=$1 and id=$2)::int t", [A, offTask.id]);
  check('Back online: the queued work reaches the cloud', up.s === 'Completed' && up.t === 1 && tab2.Y.status === 'synced', JSON.stringify(up));

  // ---------- 7. soft delete ----------
  lap.S.deleteNote(note.id); await lap.Y.pushNow();
  const del = await count(admin, "select deleted_at is not null d from mahi_notes where user_id=$1 and id=$2", [A, note.id]);
  await phone.Y.pull();
  check('Deleting a note is a recoverable soft delete that reaches other devices', del.d === true && !phone.S.state.notes.some((x) => x.id === note.id));

  // ---------- 8. isolation between accounts ----------
  const other = await device(browser(), B, { name: 'b-phone' }); await other.start();
  check('Another account sees none of this account’s work', other.S.state.assets.filter(other.D.isDone).length === 0 && !other.S.state.customTasks.length);
  const bRows = await count(other.db, "select count(*)::int n from mahi_deliverables where user_id = $1", [A]);
  check('RLS: another account cannot read these rows even directly', bRows.n === 0);

  // ---------- 9. sign out on a fully synced browser, clear storage, sign in again ----------
  await lap.Y.pull(); await lap.Y.pushNow();
  check('Sign-out is safe only when everything is confirmed', lap.Y.canDropLocalCopy());
  const beforeV = await count(admin, "select sum(version)::int v from mahi_deliverables where user_id=$1", [A]);
  Object.keys(lapBr.ls).forEach((k) => delete lapBr.ls[k]);         // browser data cleared
  await lap.close();
  const lap2 = await device(lapBr, A, { name: 'laptop' }); await lap2.start();
  const afterV = await count(admin, "select sum(version)::int v from mahi_deliverables where user_id=$1", [A]);
  const done2 = lap2.S.state.assets.filter(lap2.D.isDone).map((x) => x.id).sort().join();
  check('After clearing browser data, everything returns from the cloud', done2 === 'S01-PALMCAFE-VJ01,S01-VALLUVAM-P01,S01-VALLUVAM-P02,S02-IGOACADEMY-P03,S03-VALLUVAM-P01,S04-IGONURSERY-P01' && lap2.S.state.customTasks.length === 2, done2);
  check('…and nothing on the server was rewritten', afterV.v === beforeV.v && lap2.Y.status === 'synced', `${beforeV.v} → ${afterV.v}`);

  // ---------- 10. a pending plan update blocks cloud sync ----------
  const oldBr = browser();
  const v1state = JSON.parse(JSON.stringify(lap2.S.state)); v1state.schema = 1; v1state.assets = v1state.assets.map((x) => Object.assign({}, x)); // pretend 7-set data
  oldBr.ls['mahi.state.' + B] = JSON.stringify(v1state);
  const old = await device(oldBr, B, { name: 'old' });
  const callsBefore = old.net.calls; await old.start();
  check('While a plan update waits for confirmation, nothing is sent to the cloud', !!old.S.pendingUpgrade && old.net.calls === callsBefore && old.Y.status === 'waiting', old.Y.detail);

  for (const d of [phone, tab2, other, lap2, old]) await d.close();
  await admin.end();
} catch (e) { console.error(e); results.push(false); }
finally { await server.stop(); }
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} passed (cloud sync engine + real PostgreSQL 17 schema)`);
process.exit(pass === results.length ? 0 : 1);

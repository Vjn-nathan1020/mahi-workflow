// Two simulated devices sharing one in-memory "Supabase" table, running the real
// data.js + store.js + sync.js engine with the same adapter contract as src/lib/supabaseAdapter.js.
// Usage: npm run test:sync
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => fs.readFileSync(path.join(here, '../src/legacy', f), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- in-memory table mahi_docs keyed by user ----
const table = new Map(); const subs = []; let writes = 0, maxRow = 0;
function adapter(userId) {
  return {
    label: 'your MAHI cloud account',
    async listDocs() { const out = {}; for (const [k, v] of table) { const [u, key] = k.split('|'); if (u === userId) out[key] = JSON.parse(JSON.stringify(v)); } return out; },
    async writeDoc(key, body) { const s = JSON.stringify(body).length; maxRow = Math.max(maxRow, s); writes++; table.set(userId + '|' + key, JSON.parse(JSON.stringify(body))); subs.filter((x) => x.userId === userId).forEach((x) => setTimeout(() => x.cb(key, body), 10)); },
    subscribe(cb) { const s = { userId, cb }; subs.push(s); return () => subs.splice(subs.indexOf(s), 1); },
  };
}
function device(userId) {
  const ls = {};
  const ctx = {
    console, setTimeout, clearTimeout, Date, Math, JSON, Promise,
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    document: { visibilityState: 'visible', addEventListener() {} }, navigator: { onLine: true },
    MAHI_STORAGE_KEY: 'mahi.state.' + userId,
  };
  ctx.self = ctx; ctx.window = Object.assign(ctx, { addEventListener() {} });
  vm.createContext(ctx);
  ['data.js', 'store.js', 'sync.js'].forEach((f) => vm.runInContext(src(f), ctx, { filename: f }));
  ctx.MAHI_STORE.load();
  return { S: ctx.MAHI_STORE, D: ctx.MAHI_DATA, Y: ctx.MAHI_SYNC, ls, start: () => ctx.MAHI_SYNC.start(adapter(userId)) };
}

const results = []; const check = (n, c, d) => { results.push(!!c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d != null ? '  [' + d + ']' : ''}`); };
const laptop = device('nathan');
laptop.S.updateAssets(['S01-VALLUVAM-P01', 'S01-VALLUVAM-AI01'], { status: 'Completed' }, { silent: true });
laptop.S.addNote({ title: 'Laptop note', text: 'hello' });
await sleep(300);
await laptop.start(); await sleep(50);
check('First sign-in uploads existing browser data', [...table.keys()].filter((k) => k.startsWith('nathan|')).length === 10 && laptop.Y.status === 'synced', laptop.Y.status);
check('Browser cache is per user', Object.keys(laptop.ls).includes('mahi.state.nathan'));

const phone = device('nathan');
await phone.start(); await sleep(50);
check('Second device loads the cloud copy', phone.S.state.assets.filter(phone.D.isDone).length === 2 && phone.S.state.notes[0]?.title === 'Laptop note');

phone.S.updateAssets(['S02-PALMCAFE-VJ01'], { status: 'Approved' });
await sleep(2300);
check('Change on phone reaches laptop live', laptop.S.asset('S02-PALMCAFE-VJ01').status === 'Approved');

laptop.S.setSettings({ vjs: laptop.S.state.settings.vjs.map((v, i) => (i === 1 ? { ...v, name: 'Priya' } : v)) });
await sleep(2300);
check('Settings sync (VJ rename)', phone.S.state.settings.vjs[1].name === 'Priya');

const w0 = writes; await sleep(3000);
check('No write loop', writes === w0, `${writes - w0} extra writes`);

const other = device('someone-else');
await other.start(); await sleep(50);
check('Another account never sees Nathan\'s data', other.S.state.assets.filter(other.D.isDone).length === 0 && !other.S.state.notes.length);

laptop.S.updateAssets(laptop.S.state.assets.map((a) => a.id), { status: 'Completed', remarks: 'Final export checked' });
await sleep(4800);
check('All 616 complete syncs to the phone', phone.S.state.assets.filter(phone.D.isDone).length === 616, `largest row ${Math.round(maxRow / 1024)} KB`);

const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);

// MAHI – persistence / daily-rollover regression test with a controlled clock.
// Runs the real data.js + store.js + sync.js engine in isolated "app instances" that share one
// browser storage (local mode) and/or one in-memory cloud table (cloud mode).
// The Node process runs in UTC on purpose, so every IST (Asia/Kolkata) date rule is really exercised.
// Usage: npm run test:persistence
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f) => fs.readFileSync(path.join(here, '../src/legacy', f), 'utf8');
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- controlled clock (shared by every instance) ----------
let NOW = 0;
const setClock = (isoWithOffset) => { NOW = Date.parse(isoWithOffset); };
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}

// ---------- in-memory cloud (same contract as src/lib/supabaseAdapter.js) ----------
const table = new Map();
let online = true;
const netError = () => Object.assign(new Error('Failed to fetch'), {});
function cloudAdapter(userId) {
  return {
    label: 'your MAHI cloud account',
    async listDocs() { if (!online) throw netError(); const out = {}; for (const [k, v] of table) { const [u, key] = k.split('|'); if (u === userId) out[key] = JSON.parse(JSON.stringify(v)); } return out; },
    async writeDoc(key, body) { if (!online) throw netError(); table.set(userId + '|' + key, JSON.parse(JSON.stringify(body))); },
    subscribe() { return () => {}; },
  };
}

// ---------- one "app instance" = one page load in a browser profile ----------
function browser() { return { ls: {} }; }
function open(br, opts = {}) {
  const timers = new Set();
  const listeners = { pagehide: [], beforeunload: [], visibilitychange: [] };
  const doc = { visibilityState: 'visible', addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); } };
  const ctx = {
    console: { log() {}, warn() {}, error: console.error }, Math, JSON, Promise, Intl,
    Date: FakeDate,
    setTimeout: (f, ms) => { const id = setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); return id; },
    clearTimeout: (id) => { clearTimeout(id); timers.delete(id); },
    setInterval: () => 0, clearInterval: () => {},
    localStorage: { getItem: (k) => (k in br.ls ? br.ls[k] : null), setItem: (k, v) => { br.ls[k] = String(v); }, removeItem: (k) => { delete br.ls[k]; }, key: (i) => Object.keys(br.ls)[i] ?? null, get length() { return Object.keys(br.ls).length; } },
    document: doc, navigator: { get onLine() { return online; } },
    MAHI_STORAGE_KEY: opts.key || 'mahi.state.local',
  };
  ctx.self = ctx;
  ctx.window = Object.assign(ctx, { addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); } });
  vm.createContext(ctx);
  ['data.js', 'store.js', 'sync.js', 'report.js', 'chat.js'].forEach((f) => vm.runInContext(src(f), ctx, { filename: f }));
  ctx.MAHI_STORE.load();
  const app = { S: ctx.MAHI_STORE, D: ctx.MAHI_DATA, Y: ctx.MAHI_SYNC, R: ctx.MAHI_REPORT, C: ctx.MAHI_CHAT, ctx, shown: [] };
  ctx.MAHI_STORE.on('reactions', (list) => app.shown.push(...list)); // what MAHI would display
  // Report through the MAHI chat exactly like the dock: answer → confirm plan → apply → verify.
  app.report = (text) => { const r = app.C.answer(text); if (!r.confirm) return { reply: r, res: null }; return { reply: r, res: app.R.apply(r.confirm) }; };
  // Closing the tab: the browser fires pagehide, then every pending timer dies with the page.
  app.close = () => { (listeners.pagehide || []).forEach((f) => f()); (listeners.beforeunload || []).forEach((f) => f()); timers.forEach((id) => clearTimeout(id)); timers.clear(); };
  return app;
}

// ---------- helpers that read the numbers the dashboard would show ----------
const posters = (D, n, from = 0) => D.buildAssets().filter((a) => a.type === 'Poster').slice(from, from + n).map((a) => a.id);
const videos = (D, n) => D.buildAssets().filter((a) => a.type === 'AI Video').slice(0, n).map((a) => a.id);
const perf = (S) => (typeof S.performance === 'function' ? S.performance() : null);
const doneDeliverables = (app) => app.S.state.assets.filter(app.D.isDone).length;
const doneTasks = (app) => app.S.state.customTasks.filter((t) => t.status === 'Completed').length;

const results = [];
let group = '';
const check = (name, ok, detail) => { results.push({ group, name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${detail != null ? '  → ' + detail : ''}`); };

// Day 1 workload: 5 posters + 3 video edits (deliverables) + 2 SEO blogs (personal tasks),
// plus 2 personal tasks left unfinished, and a focus session.
async function day1(app, viaChat) {
  const { S, D } = app;
  if (viaChat) {
    const a = app.report('I completed five posters today');
    const b = app.report('I completed three video edits');
    const c = app.report('I finished two SEO blogs');
    check('Chat: "five posters" → 5 posters planned', a.reply.confirm && a.reply.confirm.ids.length === 5 && a.reply.confirm.ids.every((id) => S.asset(id).type === 'Poster'), a.reply.confirm && a.reply.confirm.ids.join(','));
    check('Chat: "three video edits" → 3 AI videos', b.reply.confirm && b.reply.confirm.ids.length === 3 && b.reply.confirm.ids.every((id) => S.asset(id).type === 'AI Video'));
    check('Chat: "two SEO blogs" → 2 personal tasks, no deliverables', c.reply.confirm && c.reply.confirm.ids.length === 0 && c.reply.confirm.tasks.length === 2);
    check('Each chat report verified as saved before success', [a, b, c].every((x) => x.res && x.res.ok), [a, b, c].map((x) => x.res && x.res.ok).join(','));
    check('Success reactions held back (not shown before verification)', app.shown.filter((r) => ['poster', 'ai', 'multi', 'custom', 'achievement'].includes(r.kind)).length === 0, app.shown.map((r) => r.kind).join(',') || 'none shown');
    check('Reports kept in the saved history', JSON.parse(app.ctx.localStorage.getItem(app.ctx.MAHI_STORAGE_KEY)).mahiReports.length === 3);
    S.addCustomTask({ title: 'Meta Ads weekly report', priority: 'High' });
    S.addCustomTask({ title: 'Website analytics review', priority: 'Low' });
    return;
  }
  S.updateAssets(posters(D, 5), { status: 'Completed' });
  S.updateAssets(videos(D, 3), { status: 'Completed' });
  const seo = [S.addCustomTask({ title: 'SEO blog: Pongal offers', priority: 'High' }), S.addCustomTask({ title: 'SEO blog: Farm loans guide', priority: 'Medium' })];
  seo.forEach((t) => S.updateCustomTask(t.id, { status: 'Completed' }));
  S.addCustomTask({ title: 'Meta Ads weekly report', priority: 'High' });
  S.addCustomTask({ title: 'Website analytics review', priority: 'Low' });
}

async function scenario(label, { variant }) {
  group = label;
  table.clear(); online = true;
  const br = browser();
  const cloud = variant === 'cloud' || variant === 'offline';
  const key = cloud ? 'mahi.state.user-1' : 'mahi.state.local';

  // ---------------- DAY 1 – Thu 26 Nov 2026, 10:00 IST ----------------
  setClock('2026-11-26T10:00:00+05:30');
  let app = open(br, { key });
  if (cloud) { await app.Y.start(cloudAdapter('user-1')); }
  if (variant === 'offline') online = false; // network drops before the work is done
  await day1(app, variant === 'chat');
  const p1 = perf(app.S);
  check('Day 1 dashboard: 8 deliverables + 2 personal tasks completed', doneDeliverables(app) === 8 && doneTasks(app) === 2, `${doneDeliverables(app)} deliverables, ${doneTasks(app)} tasks`);
  check('Day 1 daily counter = 10', p1 && p1.day.total === 10, p1 ? `day=${p1.day.total}` : 'no daily/weekly performance API');
  const achievementsDay1 = JSON.stringify(app.S.state.achievements);
  check('Day 1 achievements unlocked', Object.keys(app.S.state.achievements).length >= 2, Object.keys(app.S.state.achievements).join(', '));

  await realSleep(400); // a normal pause after finishing the work (longer than the save delay)
  if (variant === 'refresh') { app.close(); app = open(br, { key }); check('Refresh on Day 1 keeps all 10', doneDeliverables(app) === 8 && doneTasks(app) === 2); }
  if (variant === 'offline') {
    await realSleep(4500); // the debounced push and its retry both fail while offline
    check('Offline: work kept in the browser, status shows not synced', app.Y.status === 'error' && doneDeliverables(open(br, { key })) === 8, app.Y.status + ' · ' + app.Y.detail);
    online = true; await app.Y.pushNow();
    check('Back online: pending changes reach the cloud', app.Y.status === 'synced');
  }
  if (cloud) {
    await app.Y.pushNow();
    // Sign out: the browser copy may only be dropped once the cloud copy is confirmed.
    const canDrop = typeof app.Y.canDropLocalCopy === 'function' ? app.Y.canDropLocalCopy() : true;
    if (canDrop) delete br.ls[key];
    check('Sign-out only clears the browser copy after a confirmed cloud save', typeof app.Y.canDropLocalCopy === 'function' && canDrop === true, typeof app.Y.canDropLocalCopy === 'function' ? 'checked' : 'cleared unconditionally');
  }
  // Close the app 30 ms after the last change (well inside the save debounce).
  const last = app.S.addNote({ title: 'Day 1 wrap-up', text: 'Closed the laptop right away' });
  await realSleep(30);
  app.close();
  const reopenedSame = open(br, { key });
  if (!cloud) check('Change made 30 ms before closing the tab is saved', reopenedSame.S.state.notes.some((n) => n.id === last.id));

  // ---------------- DAY 2 – Fri 27 Nov 2026 ----------------
  // 01:00 IST is still 26 Nov in UTC: a UTC-based "today" would get this wrong.
  setClock('2026-11-27T01:00:00+05:30');
  const br2 = cloud ? browser() : br; // cloud: next day on a fresh device / after logout
  app = open(br2, { key });
  if (cloud) await app.Y.start(cloudAdapter('user-1'));
  const p2 = perf(app.S);
  check('Day 2: previous completed deliverables still saved (8)', doneDeliverables(app) === 8, String(doneDeliverables(app)));
  check('Day 2: completed personal tasks still saved (2)', doneTasks(app) === 2, String(doneTasks(app)));
  check('Day 2: "today" is 27 Nov in Asia/Kolkata', app.S.today() === '2026-11-27', app.S.today());
  check('Day 2: daily counter starts at 0', p2 && p2.day.total === 0, p2 ? `day=${p2.day.total}` : 'no performance API');
  check('Day 2: weekly total remains 10', p2 && p2.week.total === 10, p2 ? `week=${p2.week.total}` : 'no performance API');
  check('Day 2: achievements unchanged', JSON.stringify(app.S.state.achievements) === achievementsDay1);
  const carried = app.S.state.customTasks.filter((t) => t.status !== 'Completed' && t.date === app.S.today());
  check('Day 2: 2 unfinished tasks carried forward to today', carried.length === 2, app.S.state.customTasks.filter((t) => t.status !== 'Completed').map((t) => t.title + '@' + t.date).join(', '));
  const before = doneDeliverables(app);
  if (variant === 'chat') {
    const wk = app.C.answer('Weekly report');
    check('Day 2 chat: weekly report says 10', /: 10 completed/.test(wk.text), wk.text);
    const r = app.report('Completed 2 posters');
    check('Day 2 chat: 2 more posters saved and verified', r.res && r.res.ok && r.res.rec.deliverables.length === 2);
  } else app.S.updateAssets(posters(app.D, 2, 5), { status: 'Completed' });
  const p3 = perf(app.S);
  check('Day 2: two more posters → cumulative 12 completed', before + 2 + doneTasks(app) === 12 && (!p3 || p3.all.total === 12), p3 ? `all-time=${p3.all.total}, day=${p3.day.total}, week=${p3.week.total}` : `${doneDeliverables(app) + doneTasks(app)}`);
  check('Day 2: daily counter = 2, weekly = 12', p3 && p3.day.total === 2 && p3.week.total === 12, p3 ? `day=${p3.day.total}, week=${p3.week.total}` : 'no performance API');
  if (cloud) await app.Y.pushNow();
  app.close();

  // ---------------- DAY 2 restart ----------------
  const again = open(br2, { key });
  if (cloud) await again.Y.start(cloudAdapter('user-1'));
  check('Application restart on Day 2 keeps 12', doneDeliverables(again) + doneTasks(again) === 12);
  again.close();
}

async function safetyChecks() {
  group = 'startup safety';
  // 1. A corrupt saved copy must never be silently overwritten by a fresh plan.
  setClock('2026-11-26T10:00:00+05:30');
  const br = browser();
  br.ls['mahi.state.local'] = '{"assets":[{"id":"S01-VALLUVAM-P01","status":"Completed"'; // truncated write
  const a = open(br);
  a.S.updateAssets(posters(a.D, 1), { status: 'In Progress' });
  await realSleep(300); a.close();
  const kept = Object.keys(br.ls).find((k) => k.startsWith('mahi.state.local.corrupt'));
  check('Unreadable saved data is preserved before starting fresh', !!kept, kept || 'overwritten');

  // 2. Data saved under an older storage key is adopted instead of showing an empty plan.
  const br2 = browser();
  const old = open(br2, { key: 'mahi.state.v1' });
  old.S.updateAssets(posters(old.D, 3), { status: 'Completed' }); await realSleep(300); old.close();
  const fresh = open(br2, { key: 'mahi.state.local' });
  check('Work saved under an older storage key is recovered', doneDeliverables(fresh) === 3, String(doneDeliverables(fresh)));
  fresh.close();

  // 3. Cloud start must not silently replace newer, unsynced browser work (personal tasks only).
  table.clear(); online = true;
  const dev1 = browser();
  const x = open(dev1, { key: 'mahi.state.user-2' }); await x.Y.start(cloudAdapter('user-2')); await x.Y.pushNow(); x.close();
  setClock('2026-11-26T12:00:00+05:30');
  const dev2 = browser();
  const y = open(dev2, { key: 'mahi.state.user-2' });
  y.S.addCustomTask({ title: 'Offline work before first sync' }); y.S.updateCustomTask(y.S.state.customTasks[0].id, { status: 'Completed' });
  await realSleep(300);
  await y.Y.start(cloudAdapter('user-2'));
  check('Cloud start keeps newer unsynced browser work', y.S.state.customTasks.some((t) => t.title === 'Offline work before first sync'), y.S.state.customTasks.length + ' task(s) after start');
  y.close();
}

async function reportChecks() {
  group = 'Report to MAHI';
  setClock('2026-11-27T11:00:00+05:30');
  const br = browser();
  const app = open(br);
  const { S, R, C } = app;
  const p1 = R.plan(R.parse('Finished 2 AI videos for Valluvam and 1 SEO blog'));
  check('Brand-scoped report picks only that brand', p1.ids.length === 2 && p1.ids.every((id) => S.asset(id).brand === 'Valluvam' && S.asset(id).type === 'AI Video') && p1.tasks.length === 1, p1.ids.join(','));
  const p2 = R.plan(R.parse('S01-VALLUVAM-P01 is done'));
  check('Explicit content ID is used as given', p2.ids.length === 1 && p2.ids[0] === 'S01-VALLUVAM-P01');
  const neg = C.answer("I haven't finished the posters yet");
  check('Unfinished work is not saved', !neg.confirm || neg.confirm.ids.length === 0, neg.text);
  const r1 = R.apply(R.plan(R.parse('completed S01-VALLUVAM-P01')));
  const again = R.plan(R.parse('completed S01-VALLUVAM-P01'));
  check('Already completed record is not counted twice', r1.ok && again.ids.length === 0 && again.warnings.some((w) => /already/.test(w)));
  check('Completion date is the IST date', S.asset('S01-VALLUVAM-P01').completionDate === '2026-11-27');
  // Storage failure: success must NOT be shown; retry works once storage is back.
  const realSet = app.ctx.localStorage.setItem;
  app.ctx.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  app.shown.length = 0;
  const bad = R.apply(R.plan(R.parse('I completed one poster')));
  check('Failed save is reported (no false success)', bad.ok === false && app.shown.length === 0, bad.reason);
  app.ctx.localStorage.setItem = realSet;
  const fixed = R.retry(bad.rec);
  check('Retry after storage recovers saves and verifies', fixed.ok === true);
  const undone = R.undo(r1.rec.id);
  check('Undo returns the record to its earlier status', undone && S.asset('S01-VALLUVAM-P01').status === 'Not Started' && !S.asset('S01-VALLUVAM-P01').completionDate);
  const q = C.answer('What should I do next?');
  check('Suggestions come from saved records', q.emotion === 'searching' && q.lines.length > 0, q.lines[0]);
  const unk = C.answer('banana');
  check('Unknown message → confused, no change', unk.emotion === 'confused' && !unk.confirm);
  app.close();
}

for (const v of [['Reported via MAHI chat · close & reopen', 'chat'], ['Local mode · close & reopen', 'local'], ['Local mode · refresh', 'refresh'], ['Cloud · logout/login on another device', 'cloud'], ['Cloud · network interruption', 'offline']]) {
  await scenario(v[0], { variant: v[1] });
}
await safetyChecks();
await reportChecks();
await planUpgradeChecks();

// Saved data from the old 7-set plan must load into the 5-set plan with nothing lost.
async function planUpgradeChecks() {
  group = 'plan v2 upgrade';
  setClock('2026-11-27T12:00:00+05:30');
  // Build a realistic v1 state: the old 616 IDs with work on old Set 01, old Set 03 (removed) and old Set 05 (New Year).
  const BR = ['VALLUVAM', 'FARMERSFACTORY', 'PROTEINCUTS', 'PALMCAFE', 'IGOACADEMY', 'IGOFRANCHISE', 'IFINTECH', 'IGOFARMGATEMANDI', 'IGOFARMLANDESTATES', 'IGOCROPCARE', 'IGONURSERY', 'IGOFARMFACTORIES', 'IGOFARMLOANS', 'IGOAGRIMART', 'IGOGREENENERGY'];
  const probe = open(browser()); const D2 = probe.D; probe.close();
  const fest1 = { S01: 'Christmas', S02: 'Christmas', S03: 'Christmas', S04: 'Christmas', S05: 'New Year', S06: 'Pongal', S07: 'Pongal' };
  const v1assets = [];
  Object.keys(fest1).forEach((code) => D2.BRANDS.forEach((b, i) => {
    const mk = (suffix, type, n) => { for (let k = 1; k <= n; k++) v1assets.push(Object.assign(D2.blankAsset(), { id: `${code}-${BR[i]}-${suffix}${D2.pad2(k)}`, type, set: code, brand: b.name, festival: fest1[code], num: k })); };
    mk('P', 'Poster', b.posters); mk('AI', 'AI Video', b.ai); mk('VJ', 'VJ Video', b.vj);
  }));
  const set = (id, patch) => Object.assign(v1assets.find((a) => a.id === id), patch);
  set('S01-VALLUVAM-P01', { status: 'Completed', completionDate: '2026-11-27' });
  set('S03-PALMCAFE-P01', { status: 'In Progress', topic: 'Xmas week 3 offer' });          // removed set, has work
  set('S05-IGOGREENENERGY-VJ01', { status: 'Script Completed', script: 'New Year solar' }); // becomes S03
  set('S07-VALLUVAM-P02', { fileLink: 'https://drive.example/S07-VALLUVAM-P02.png' });     // becomes S05, link untouched
  const v1 = { schema: 1, assets: v1assets, settings: { pubWindows: { S05: { start: '2026-12-31', end: '2027-01-02' } } }, milestones: { 'set100:S05': '2026-12-30T10:00:00Z' },
    history: [{ ts: 'x', id: 'S06-IGONURSERY-P01', field: 'status', from: 'Not Started', to: 'Planning' }], platformLogs: [{ id: 'L1', contentId: 'S05-PALMCAFE-P01' }],
    mahiReports: [{ id: 'R1', text: 'did S05-PALMCAFE-P01', deliverables: ['S05-PALMCAFE-P01'], tasks: [], prev: { 'S05-PALMCAFE-P01': 'Not Started' } }], customTasks: [], notes: [{ id: 'N1', text: 'remember S05 lights' }] };
  check('Old plan fixture has 616 records', v1assets.length === 616, v1assets.length);
  v1.assets.push(Object.assign({}, v1assets[0], { status: 'In Progress', remarks: 'second copy' }));           // duplicate ID with work
  v1.assets.push(Object.assign(D2.blankAsset(), { id: 'S09-UNKNOWN-P01', type: 'Poster', brand: 'X', status: 'Completed' })); // unknown ID with work
  const v1raw = JSON.stringify(v1);
  const br = browser(); br.ls['mahi.state.local'] = v1raw;
  const a = open(br); const st = a.S.state;
  const pu = a.S.pendingUpgrade, r = pu && pu.report;
  check('Old-plan data opens with an update preview, not a silent change', !!pu && br.ls['mahi.state.local'] === v1raw);
  check('Preview counts: 618 original, 440 migrated, 1 completed + 2 in progress kept', r && r.original === 618 && r.migrated === 440 && r.completedRetained === 1 && r.inProgressRetained === 2 && r.activeAfter === 440, JSON.stringify(r));
  check('Preview counts: 1 archived with work, 175 empty removed, 1 duplicate, 2 quarantined', r && r.archivedWithWork === 1 && r.archivedEmpty === 175 && r.duplicates === 1 && r.quarantined === 2 && r.unresolved === 0);
  check('Verbatim archive copy written before anything else', br.ls[pu.archiveKey] === v1raw, pu.archiveKey);
  a.S.updateAssets(['S01-VALLUVAM-P03'], { status: 'In Progress' }); await realSleep(300);
  check('Nothing is saved while the update waits for confirmation', br.ls['mahi.state.local'] === v1raw);
  const applied = a.S.applyUpgrade();
  check('Apply update saves and verifies', applied.ok && JSON.parse(br.ls['mahi.state.local']).schema === 2 && !a.S.pendingUpgrade, applied.reason);
  check('Quarantined records kept for review', st.quarantine === undefined ? a.S.state.quarantine.length === 2 : a.S.state.quarantine.length === 2, a.S.state.quarantine.map((x) => x.quarantineReason).join(' | '));
  check('New plan has 5 sets and 440 deliverables', a.D.SETS.length === 5 && st.assets.length === 440 && new Set(st.assets.map((x) => x.id)).size === 440, `${a.D.SETS.length} sets, ${st.assets.length} records`);
  check('Christmas now 2 sets (176), New Year 88, Pongal 176', ['Christmas', 'New Year', 'Pongal'].map((f) => st.assets.filter((x) => x.festival === f).length).join() === '176,88,176');
  check('VJ videos 60 (20 per VJ)', st.assets.filter((x) => x.type === 'VJ Video').length === 60 && a.D.VJ_IDS.every((v) => st.assets.filter((x) => x.vj === v).length === 20));
  check('Set 01 work kept as-is', a.S.asset('S01-VALLUVAM-P01').status === 'Completed' && a.S.asset('S01-VALLUVAM-P01').completionDate === '2026-11-27');
  const ny = a.S.asset('S03-IGOGREENENERGY-VJ01');
  check('Old Set 05 (New Year) work moved to new Set 03', ny.status === 'Script Completed' && ny.script === 'New Year solar' && ny.festival === 'New Year' && ny.set === 'S03');
  check('Old Set 07 moved to Set 05, file link text untouched', a.S.asset('S05-VALLUVAM-P02').fileLink === 'https://drive.example/S07-VALLUVAM-P02.png');
  check('New Set 03/04 do not inherit removed Christmas work', a.S.asset('S03-PALMCAFE-P01').status === 'Not Started' && a.S.asset('S03-PALMCAFE-P01').festival === 'New Year');
  check('Removed-set work archived, not lost', st.removedAssets.length === 1 && st.removedAssets[0].id === 'OLD-S03-PALMCAFE-P01' && st.removedAssets[0].topic === 'Xmas week 3 offer', JSON.stringify(st.removedAssets.map((x) => x.id)));
  check('Publishing window, milestone, history, logs and reports renumbered',
    st.settings.pubWindows.S03.start === '2026-12-31' && st.milestones['set100:S03'] && st.history.some((h) => h.id === 'S04-IGONURSERY-P01')
    && st.platformLogs[0].contentId === 'S03-PALMCAFE-P01' && st.mahiReports[0].deliverables[0] === 'S03-PALMCAFE-P01' && st.mahiReports[0].prev['S03-PALMCAFE-P01'] === 'Not Started');
  check('Personal notes are not rewritten', st.notes[0].text === 'remember S05 lights');
  a.S.updateAssets(['S01-VALLUVAM-P02'], { status: 'In Progress' }); await realSleep(300); a.close();
  const saved = JSON.parse(br.ls['mahi.state.local']);
  check('Saved copy is schema 2', saved.schema === 2 && saved.assets.length === 440);
  const b = open(br);
  check('Reopening does not renumber twice', !b.S.pendingUpgrade && b.S.asset('S03-IGOGREENENERGY-VJ01').status === 'Script Completed' && b.S.asset('S01-VALLUVAM-P02').status === 'In Progress' && b.S.state.removedAssets.length === 1);
  check('Rollback: archived pre-update data can be restored', b.S.restorePlanArchive() && br.ls['mahi.state.local'] === v1raw && !!br.ls['mahi.state.local.before-archive-restore']);
  b.close();
  const c = open(br);
  check('After rollback the preview appears again', !!c.S.pendingUpgrade && c.S.pendingUpgrade.report.original === 618);
  c.close();
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} passed`);
if (process.env.MAHI_TEST_JSON) fs.writeFileSync(process.env.MAHI_TEST_JSON, JSON.stringify(results, null, 2));
process.exit(pass === results.length ? 0 : 1);

/* MAHI – cloud sync core (storage-agnostic).
 * The browser keeps an instant offline cache; this module mirrors the state to a small set of
 * per-user cloud documents through an ADAPTER, so every signed-in device shows the same work.
 *
 * Adapter contract (see src/lib/supabaseAdapter.js):
 *   listDocs()            -> Promise<{ [docKey]: body }>
 *   writeDoc(key, body)   -> Promise<void>   (upsert one document)
 *   subscribe(onChange)   -> unsubscribe fn   (onChange(docKey, body) for remote writes)
 */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA, S = root.MAHI_STORE;
  const SESSION = Math.random().toString(36).slice(2, 10);
  const MAX_DOC = 240 * 1024;
  const sync = { status: 'local', detail: 'Saved in this browser', lastSync: null };
  let adapter = null, lastHash = {}, pushTimer = null, pushing = false, pushAgain = false, applying = false, unsub = null, pullTimer = null;
  const listeners = [];
  sync.onStatus = (fn) => listeners.push(fn);
  const setStatus = (status, detail) => { sync.status = status; sync.detail = detail; listeners.forEach((f) => { try { f(sync); } catch (e) { /* ignore */ } }); };

  // ---------- encoding: state <-> small documents ----------
  const BASE = {}; D.buildAssets().forEach((a) => { BASE[a.id] = a; });
  function encodeAssets(list) {
    const out = {};
    list.forEach((a) => {
      const b = BASE[a.id]; if (!b) return;
      const diff = {};
      Object.keys(a).forEach((k) => { if (k.startsWith('__')) return; if (a[k] !== b[k] && !(a[k] === '' && b[k] == null)) diff[k] = a[k]; });
      out[a.id] = diff;
    });
    return out;
  }
  const size = (o) => JSON.stringify(o).length;
  function trimAlertLog(log) { const t = D.addDays(D.localISO(), -3); const out = {}; Object.keys(log || {}).forEach((k) => { const d = (k.match(/\d{4}-\d{2}-\d{2}$/) || [])[0]; if (!d || d >= t) out[k] = log[k]; }); return out; }
  function encode(st) {
    const docs = {};
    D.SETS.forEach((s) => { docs['assets_' + s.code] = { assets: encodeAssets(st.assets.filter((a) => a.set === s.code)) }; });
    const settings = Object.assign({}, st.settings, { ownerPic: '', logo: '', vjs: st.settings.vjs.map((v) => ({ id: v.id, name: v.name, pic: '' })) });
    docs.meta = { schema: D.SCHEMA_VERSION, settings, customTasks: st.customTasks, notes: st.notes, campaigns: st.campaigns, extraBrands: st.extraBrands, platformLogs: st.platformLogs, achievements: st.achievements, milestones: st.milestones, focusSessions: st.focusSessions.slice(-500), mahiReports: (st.mahiReports || []).slice(0, 300), welcomed: !!st.welcomed, alertLog: trimAlertLog(st.alertLog) };
    docs.media = { ownerPic: st.settings.ownerPic || '', logo: st.settings.logo || '', vjPics: st.settings.vjs.map((v) => v.pic || '') };
    docs.activity = { notifications: st.notifications.slice(0, 300), history: st.history.slice(-1200) };
    if (size(docs.media) > MAX_DOC) docs.media.logo = '';
    if (size(docs.media) > MAX_DOC) docs.media = { ownerPic: '', logo: '', vjPics: ['', '', ''] };
    while (size(docs.activity) > MAX_DOC && docs.activity.history.length) docs.activity.history = docs.activity.history.slice(Math.floor(docs.activity.history.length / 2));
    return docs;
  }
  function decode(docs, current) {
    const assets = D.buildAssets().map((b) => { let diff = null; D.SETS.forEach((s) => { const d = docs['assets_' + s.code]; if (d && d.assets && d.assets[b.id]) diff = d.assets[b.id]; }); return Object.assign(D.blankAsset(), b, diff || {}); });
    const meta = docs.meta || {}, media = docs.media || {}, act = docs.activity || {};
    const settings = Object.assign({}, current.settings, meta.settings || {});
    settings.ownerPic = media.ownerPic || ''; settings.logo = media.logo || '';
    settings.vjs = (settings.vjs || current.settings.vjs).map((v, i) => Object.assign({}, v, { pic: (media.vjPics || [])[i] || '' }));
    return Object.assign({}, current, {
      assets, settings, customTasks: meta.customTasks || [], notes: meta.notes || [], campaigns: meta.campaigns || [], extraBrands: meta.extraBrands || [],
      platformLogs: meta.platformLogs || [], achievements: meta.achievements || {}, milestones: meta.milestones || {}, focusSessions: meta.focusSessions || [], mahiReports: meta.mahiReports || [],
      welcomed: meta.welcomed != null ? meta.welcomed : current.welcomed, alertLog: meta.alertLog || {}, notifications: act.notifications || [], history: act.history || [],
    });
  }
  const strip = (d) => { const o = Object.assign({}, d); delete o._writer; delete o._updatedAt; return o; };
  const hashAll = (docs) => { const h = {}; Object.keys(docs).forEach((k) => { h[k] = JSON.stringify(docs[k]); }); return h; };

  // ---------- push ----------
  function schedulePush() { if (!adapter || applying) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }
  async function push() {
    if (!adapter) return;
    if (pushing) { pushAgain = true; return; }
    pushing = true;
    try {
      const docs = encode(S.state), now = Date.now();
      const changed = Object.keys(docs).filter((k) => lastHash[k] !== JSON.stringify(docs[k]));
      if (!changed.length) { setStatus('synced', `Saved to ${adapter.label}`); return; }
      setStatus('syncing', `Saving ${changed.length} part(s)…`);
      changed.sort((a, b) => (a === 'meta') - (b === 'meta')); // meta last = "complete save" marker
      if (!changed.includes('meta')) changed.push('meta');
      for (const k of changed) {
        await withRetry(() => adapter.writeDoc(k, Object.assign({}, docs[k], { _writer: SESSION, _updatedAt: now })));
        lastHash[k] = JSON.stringify(docs[k]);
      }
      S.state.syncedAt = now; sync.lastSync = now;
      S.save(true, { fromSync: true }); // remember the confirmed sync point across restarts
      setStatus('synced', `Saved to ${adapter.label}`);
    } catch (e) {
      console.warn('MAHI sync push failed', e);
      setStatus('error', errorText(e));
    } finally {
      pushing = false;
      if (pushAgain) { pushAgain = false; schedulePush(); }
    }
  }
  async function withRetry(fn) {
    try { return await fn(); }
    catch (e) { if (e && e.auth) throw e; await new Promise((r) => setTimeout(r, 900 + Math.random() * 1200)); return fn(); }
  }
  function errorText(e) {
    if (e && e.auth) return 'Session expired – please sign in again. Your work is kept in this browser.';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Offline – changes are kept in this browser and will sync when you are back online.';
    return 'Could not reach the cloud right now – your work is kept in this browser and will sync on the next change.';
  }

  // ---------- pull / apply ----------
  function applyDocs(docs) {
    applying = true;
    try {
      const next = decode(docs, S.state);
      next.syncedAt = (docs.meta && docs.meta._updatedAt) || Date.now();
      next.localChangedAt = next.syncedAt;
      S.replaceAll(next, { fromSync: true });
      lastHash = hashAll(encode(S.state));
      sync.lastSync = Date.now();
    } finally { applying = false; }
  }
  async function pullIfNewer(showToast) {
    const docs = await adapter.listDocs();
    if (!docs.meta || (docs.meta._updatedAt || 0) <= (S.state.syncedAt || 0) || docs.meta._writer === SESSION) return false;
    applyDocs(docs);
    if (showToast && root.MAHI_UI) root.MAHI_UI.toast('Updated from your other device', 'ok');
    return true;
  }

  async function start(ad) {
    adapter = ad;
    if (!adapter) { setStatus('local', 'Saved in this browser only'); return; }
    setStatus('connecting', `Connecting to ${adapter.label}…`);
    const slow = setTimeout(() => { if (sync.status === 'connecting') setStatus('connecting', 'Cloud not reachable yet – working from this browser'); }, 10000);
    try {
      const docs = await adapter.listDocs();
      clearTimeout(slow);
      const remoteAt = docs.meta ? docs.meta._updatedAt || 0 : 0;
      const localAt = S.state.localChangedAt || 0;
      const syncedAt = S.state.syncedAt || 0;
      const localChanged = localAt > syncedAt && hasWork(S.state);
      const remoteChanged = remoteAt > syncedAt;
      if (!docs.meta) { lastHash = {}; await push(); if (sync.status === 'synced') S.notify('import', 'Cloud sync enabled', `Your MAHI data is now saved to ${adapter.label}.`); }
      else if (localChanged && remoteChanged) {
        // Both copies changed since they were last in step (first sign-in on a browser that already has work,
        // or edits on two devices while one was offline): merge, never overwrite either side.
        await mergeAndPush(docs, localAt > remoteAt);
      } else if (remoteChanged) applyDocs(docs);
      else { lastHash = hashAll(Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, strip(v)]))); await push(); }
      if (sync.status !== 'error') setStatus('synced', `Saved to ${adapter.label}`);
    } catch (e) { clearTimeout(slow); console.warn('MAHI sync start failed', e); setStatus('error', errorText(e)); }
    // live updates: when another device finishes a save (meta written last), reload the account copy
    try {
      unsub = adapter.subscribe((key, body) => {
        if (key !== 'meta' || !body || body._writer === SESSION) return;
        clearTimeout(pullTimer); pullTimer = setTimeout(() => pullIfNewer(true).catch(() => {}), 400);
      });
    } catch (e) { console.warn('MAHI realtime unavailable', e); }
    // safety net: re-check when the tab becomes visible again or the network returns
    const recheck = () => { if (document.visibilityState === 'visible' && adapter) pullIfNewer(true).then(() => schedulePush()).catch(() => {}); };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('online', () => { recheck(); schedulePush(); });
  }
  // ---------- merge (no completed work, task or note is ever dropped) ----------
  function hasWork(st) {
    return st.assets.some((a) => a.status !== 'Not Started' || a.pubStatus !== 'Not Scheduled') || st.customTasks.length > 0 || st.notes.length > 0 || st.focusSessions.length > 0;
  }
  const pristine = (a) => { const b = BASE[a.id]; return !b || Object.keys(a).every((k) => k.startsWith('__') || a[k] === b[k] || (a[k] === '' && b[k] == null)); };
  function unionById(newer, older, prefer) {
    const out = new Map();
    older.forEach((x) => { if (x && x.id != null) out.set(x.id, x); });
    newer.forEach((x) => { if (!x || x.id == null) return; const o = out.get(x.id); out.set(x.id, o && prefer ? prefer(x, o) : x); });
    return [...out.values()];
  }
  function earliest(a, b) { const o = Object.assign({}, b); Object.keys(a || {}).forEach((k) => { if (!o[k] || String(a[k]) < String(o[k])) o[k] = a[k]; }); return o; }
  function mergeStates(local, remote, localNewer) {
    const newer = localNewer ? local : remote, older = localNewer ? remote : local;
    const rById = {}; remote.assets.forEach((a) => { rById[a.id] = a; });
    const assets = local.assets.map((l) => {
      const r = rById[l.id]; if (!r) return l;
      if (pristine(r)) return l; if (pristine(l)) return r;
      if (D.isDone(l) !== D.isDone(r)) return D.isDone(l) ? l : r; // a completion on either device wins
      return localNewer ? l : r;
    });
    const doneWins = (x, o) => (o.status === 'Completed' && x.status !== 'Completed' ? o : x);
    const list = (k, prefer) => unionById(newer[k] || [], older[k] || [], prefer);
    const byTs = (a, b) => String(b.ts || '').localeCompare(String(a.ts || ''));
    return Object.assign({}, newer, {
      assets, settings: newer.settings,
      customTasks: list('customTasks', doneWins), notes: list('notes'), focusSessions: list('focusSessions'), mahiReports: list('mahiReports'), campaigns: list('campaigns'),
      extraBrands: list('extraBrands'), platformLogs: list('platformLogs'), notifications: list('notifications').sort(byTs).slice(0, 500),
      history: unionById(newer.history.map((h, i) => Object.assign({ id: 'h' + h.ts + h.id + h.field }, h)), older.history.map((h) => Object.assign({ id: 'h' + h.ts + h.id + h.field }, h))).sort((a, b) => String(a.ts).localeCompare(String(b.ts))).map((h) => { const c = Object.assign({}, h); delete c.id; return c; }),
      achievements: earliest(local.achievements, remote.achievements), milestones: earliest(local.milestones, remote.milestones),
    });
  }
  async function mergeAndPush(docs, localNewer) {
    const before = S.state.assets.filter(D.isDone).length + S.state.customTasks.length + S.state.notes.length;
    const merged = mergeStates(S.state, decode(docs, S.state), localNewer);
    S.replaceAll(merged); // keeps the previous browser copy under "<key>.before-replace"
    lastHash = {}; await push();
    const after = S.state.assets.filter(D.isDone).length + S.state.customTasks.length + S.state.notes.length;
    S.notify('import', 'Browser and cloud copies merged', `Work from this browser and your cloud account was combined (${after} completed items, tasks and notes; ${before} were in this browser). Nothing was discarded.`);
  }

  // True only when every part of the current state is confirmed in the cloud.
  function unsyncedParts() { const docs = encode(S.state); return Object.keys(docs).filter((k) => lastHash[k] !== JSON.stringify(docs[k])); }
  function canDropLocalCopy() { return !!adapter && sync.status === 'synced' && !pushing && !S.pendingSave && unsyncedParts().length === 0; }

  S.on('saved', (info) => { if (!(info && info.fromSync)) schedulePush(); });
  sync.start = start;
  sync.canDropLocalCopy = canDropLocalCopy;
  sync.unsyncedParts = unsyncedParts;
  sync.mergeStates = mergeStates;
  sync.pushNow = () => { clearTimeout(pushTimer); return push(); };
  sync.stop = () => { if (unsub) unsub(); adapter = null; };
  sync.encode = encode; sync.decode = decode;
  root.MAHI_SYNC = sync;
})(typeof self !== 'undefined' ? self : this);

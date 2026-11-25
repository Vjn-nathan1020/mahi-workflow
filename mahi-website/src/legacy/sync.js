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
    docs.meta = { schema: D.SCHEMA_VERSION, settings, customTasks: st.customTasks, notes: st.notes, campaigns: st.campaigns, extraBrands: st.extraBrands, platformLogs: st.platformLogs, achievements: st.achievements, milestones: st.milestones, focusSessions: st.focusSessions.slice(-500), welcomed: !!st.welcomed, alertLog: trimAlertLog(st.alertLog) };
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
      platformLogs: meta.platformLogs || [], achievements: meta.achievements || {}, milestones: meta.milestones || {}, focusSessions: meta.focusSessions || [],
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
      if (!docs.meta) { lastHash = {}; await push(); if (sync.status === 'synced') S.notify('import', 'Cloud sync enabled', `Your MAHI data is now saved to ${adapter.label}.`); }
      else if (remoteAt >= localAt || !S.state.syncedAt) {
        if (localAt > remoteAt && S.state.assets.some(D.isDone)) await keepNewerLocal(docs, remoteAt, localAt);
        else applyDocs(docs);
      } else { lastHash = hashAll(Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, strip(v)]))); await push(); }
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
  async function keepNewerLocal(docs, remoteAt, localAt) {
    const UI = root.MAHI_UI;
    const remoteDone = decode(docs, S.state).assets.filter(D.isDone).length, localDone = S.state.assets.filter(D.isDone).length;
    const keepLocal = UI ? await UI.confirm('Two versions found', `This browser has changes from <b>${new Date(localAt).toLocaleString()}</b> (${localDone} completed) that are newer than your cloud copy from <b>${new Date(remoteAt).toLocaleString()}</b> (${remoteDone} completed).<br><br>Keep this browser's version and save it to the cloud? Choose Cancel to load the cloud copy instead.`, "Keep this browser's version") : true;
    if (keepLocal) { lastHash = {}; await push(); } else applyDocs(docs);
  }

  S.on('saved', (info) => { if (!(info && info.fromSync)) schedulePush(); });
  sync.start = start;
  sync.pushNow = () => { clearTimeout(pushTimer); return push(); };
  sync.stop = () => { if (unsub) unsub(); adapter = null; };
  sync.encode = encode; sync.decode = decode;
  root.MAHI_SYNC = sync;
})(typeof self !== 'undefined' ? self : this);

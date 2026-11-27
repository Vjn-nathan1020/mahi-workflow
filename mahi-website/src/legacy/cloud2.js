/* MAHI – record-level cloud sync (schema v2).
 * Every deliverable, task, note, report, session, achievement, notification and the profile is its own
 * database row. All writes go through public.mahi_push (versioned, all-or-nothing, idempotent by op id);
 * all reads come from public.mahi_pull (transaction-safe cursor). Nothing is ever overwritten silently:
 * a record changed on both sides becomes a conflict for the user to resolve.
 *
 * Adapter contract (src/lib/supabaseAdapter.js → createRpcAdapter):
 *   label                     text shown in the UI
 *   rpc(name, args)           -> Promise<data>; errors carry .auth (session) or .network (offline)
 *   subscribe(onChange)       -> unsubscribe fn (optional, realtime hint to pull)
 *   device                    short device name (optional)
 * Replaces the v1 document sync: it exposes the same MAHI_SYNC interface the app already uses.
 */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA, S = root.MAHI_STORE;
  const BATCH = 400;
  const sync = { status: 'local', detail: 'Saved in this browser', lastSync: null, version: 2 };
  const listeners = [];
  let freshLocal = false, adopted = 0, adapter = null, meta = null, pushing = false, pushAgain = false, pushTimer = null, pullTimer = null, retryTimer = null, retryDelay = 2000, unsub = null, pollTimer = null;
  sync.onStatus = (fn) => listeners.push(fn);
  const setStatus = (status, detail) => { sync.status = status; sync.detail = detail; listeners.forEach((f) => { try { f(sync); } catch (e) { /* ignore */ } }); };
  const istTime = (iso) => { const d = new Date(new Date(iso || Date.now()).getTime() + 330 * 60000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') + ' IST'; };

  // ---------------------------------------------------------------- stable hashing
  const canon = (v) => (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v));
  const hash = (row) => canon(row);
  const s = (v) => (v == null ? '' : String(v));
  const d10 = (v) => (v ? String(v).slice(0, 10) : '');

  // ---------------------------------------------------------------- state → rows
  const BIG = 200 * 1024;
  function profileRow(st) {
    const set = Object.assign({}, st.settings);
    if (s(set.ownerPic).length > BIG) set.ownerPic = '';
    if (s(set.logo).length > BIG) set.logo = '';
    if (Array.isArray(set.vjs)) set.vjs = set.vjs.map((v) => Object.assign({}, v, { pic: s(v.pic).length > BIG ? '' : v.pic }));
    return {
      display_name: s(set.owner), call_name: s(set.callName), organization: s(set.organization), department: s(set.department), time_zone: 'Asia/Kolkata',
      preferences: { settings: set, platformLogs: st.platformLogs || [], removedAssets: st.removedAssets || [], quarantine: st.quarantine || [], planUpgrade: st.planUpgrade || null, welcomed: !!st.welcomed },  // history and alert de-duplication stay per device (the server keeps its own audit log)
    };
  }
  function deliverableRow(a) {
    const rest = {}; Object.keys(a).forEach((k) => { if (!k.startsWith('__') && !['id', 'type', 'set', 'brand', 'festival', 'vj', 'status', 'pubStatus', 'priority', 'prodStart', 'deadline', 'completionDate', 'pubDate', 'qc', 'finalApproval', 'correction'].includes(k)) rest[k] = a[k]; });
    return { type: a.type, set_code: a.set, brand: a.brand, festival: a.festival, vj: s(a.vj), status: a.status, pub_status: a.pubStatus, priority: a.priority || 'Medium',
      prod_start: d10(a.prodStart), deadline: d10(a.deadline), completion_date: d10(a.completionDate), pub_date: d10(a.pubDate), qc: s(a.qc), final_approval: s(a.finalApproval), correction: s(a.correction), fields: rest };
  }
  const taskRow = (t) => ({ title: s(t.title), category: s(t.category) || 'Personal', priority: s(t.priority) || 'Medium', task_date: d10(t.date) || D.localISO(), original_date: d10(t.carriedFrom), deadline: d10(t.deadline),
    assignee: s(t.assignee), stage: s(t.stage) || 'Pending', status: s(t.status) || 'Pending', completed_at: s(t.completedAt), completed_on: d10(t.completedOn), linked_id: s(t.linkedId), reminder: s(t.reminder), notes: s(t.notes) });
  const noteRow = (n) => ({ note_date: d10(n.date) || D.localISO(), title: s(n.title), category: s(n.category), text: s(n.text), linked_id: s(n.linkedId), pinned: !!n.pinned });
  const reportRow = (r) => ({ report_date: d10(r.date) || D.localISO(), text: s(r.text), deliverable_ids: r.deliverables || [], task_ids: r.tasks || [], previous: { prev: r.prev || {}, ts: r.ts || null }, undone_at: s(r.undone) });
  const focusRow = (f) => ({ started_at: s(f.start), ended_at: s(f.end || f.ts), minutes: Math.max(0, Math.min(1440, Math.round(Number(f.minutes) || 0))), label: s(f.label).slice(0, 300) });
  const notifRow = (n) => ({ ts: s(n.ts) || new Date().toISOString(), type: s(n.type) || 'info', title: s(n.title).slice(0, 500) || '(no title)', body: s(n.body).slice(0, 5000), ref: s(n.ref), read: !!n.read });
  const campaignRow = (c) => { const extra = Object.assign({}, c); ['id', 'name', 'type', 'festival', 'start', 'end', 'notes'].forEach((k) => delete extra[k]); return { name: s(c.name) || '(unnamed)', kind: s(c.type), festival: s(c.festival), start_date: d10(c.start), end_date: d10(c.end), targets: extra, notes: s(c.notes) }; };
  const brandRow = (b) => ({ name: s(b.name) || '(unnamed)', services: s(b.services), notes: s(b.notes), is_core: false });
  const safeId = (id) => /^[A-Za-z0-9_.:-]{1,80}$/.test(String(id || ''));

  // Returns Map "table|id" → { table, id, row }
  function records(st) {
    const m = new Map(); const put = (table, id, row) => { if (safeId(id)) m.set(table + '|' + id, { table, id: String(id), row }); };
    put('profiles', 'profile', profileRow(st));
    st.assets.forEach((a) => put('deliverables', a.id, deliverableRow(a)));
    (st.customTasks || []).forEach((t) => put('tasks', t.id, taskRow(t)));
    (st.notes || []).forEach((n) => put('notes', n.id, noteRow(n)));
    (st.mahiReports || []).forEach((r) => put('work_reports', r.id, reportRow(r)));
    (st.focusSessions || []).forEach((f) => put('focus_sessions', f.id, focusRow(f)));
    (st.notifications || []).forEach((n) => put('notifications', n.id, notifRow(n)));
    (st.campaigns || []).forEach((c) => put('campaigns', c.id, campaignRow(c)));
    (st.extraBrands || []).forEach((b) => put('brands', b.id, brandRow(b)));
    Object.keys(st.achievements || {}).forEach((k) => put('achievements', 'a:' + k, { unlocked_at: s(st.achievements[k]) || new Date(0).toISOString(), kind: 'achievement', detail: {} }));
    Object.keys(st.milestones || {}).forEach((k) => put('achievements', 'm:' + k, { unlocked_at: s(st.milestones[k]) || new Date(0).toISOString(), kind: 'milestone', detail: {} }));
    D.SETS.forEach((x) => { const w = (st.settings.pubWindows || {})[x.code] || {}; put('sets', x.code, { festival: x.festival, prod_start: x.start, prod_end: x.end, pub_start: d10(w.start), pub_end: d10(w.end) }); });
    return m;
  }

  // ---------------------------------------------------------------- server row → state (in place)
  const SERVER_COLS = ['user_id', 'id', 'version', 'created_at', 'updated_at', 'updated_by', 'deleted_at', 'change_xid', 'change_seq'];
  const pick = (row) => { const o = {}; Object.keys(row).forEach((k) => { if (!SERVER_COLS.includes(k)) o[k] = row[k] == null ? '' : row[k]; }); return o; };
  const upsertList = (list, id, obj) => { const i = list.findIndex((x) => x.id === id); if (i >= 0) list[i] = Object.assign({}, list[i], obj); else list.push(obj); };
  function applyRow(st, table, row) {
    const r = pick(row), id = row.id, del = !!row.deleted_at;
    const drop = (k) => { st[k] = (st[k] || []).filter((x) => x.id !== id); };
    switch (table) {
      case 'profiles': {
        const p = r.preferences || {};
        if (p.settings) st.settings = Object.assign({}, st.settings, p.settings, { ownerPic: p.settings.ownerPic || st.settings.ownerPic, logo: p.settings.logo || st.settings.logo });
        ['platformLogs', 'removedAssets', 'quarantine'].forEach((k) => { if (Array.isArray(p[k])) st[k] = p[k]; });
        if (p.planUpgrade) st.planUpgrade = p.planUpgrade; if (p.welcomed) st.welcomed = true;
        break;
      }
      case 'deliverables': {
        const a = st.assets.find((x) => x.id === id); if (!a) return false; // not in the active plan: never invent records
        Object.assign(a, r.fields || {}, { status: r.status, pubStatus: r.pub_status, priority: r.priority, prodStart: d10(r.prod_start), deadline: d10(r.deadline), completionDate: d10(r.completion_date),
          pubDate: d10(r.pub_date), qc: r.qc, finalApproval: r.final_approval, correction: r.correction });
        break;
      }
      case 'tasks': if (del) drop('customTasks'); else upsertList(st.customTasks, id, { id, title: r.title, category: r.category, priority: r.priority, date: d10(r.task_date), carriedFrom: d10(r.original_date) || undefined, deadline: d10(r.deadline) || undefined,
        assignee: r.assignee || undefined, stage: r.stage === 'Pending' ? undefined : r.stage, status: r.status, completedAt: r.completed_at || undefined, completedOn: d10(r.completed_on) || undefined, linkedId: r.linked_id, reminder: r.reminder, notes: r.notes }); break;
      case 'notes': if (del) drop('notes'); else upsertList(st.notes, id, { id, date: d10(r.note_date), title: r.title, category: r.category, text: r.text, linkedId: r.linked_id, pinned: !!r.pinned }); break;
      case 'work_reports': if (del) drop('mahiReports'); else { st.mahiReports = st.mahiReports || []; upsertList(st.mahiReports, id, { id, date: d10(r.report_date), text: r.text, deliverables: r.deliverable_ids || [], tasks: r.task_ids || [], prev: (r.previous || {}).prev || {}, ts: (r.previous || {}).ts || undefined, undone: r.undone_at || undefined }); } break;
      case 'focus_sessions': if (del) drop('focusSessions'); else upsertList(st.focusSessions, id, { id, ts: r.ended_at || undefined, start: r.started_at || undefined, end: undefined, minutes: r.minutes, label: r.label }); break;
      case 'notifications': if (del) drop('notifications'); else { upsertList(st.notifications, id, { id, ts: r.ts, type: r.type, title: r.title, body: r.body, read: !!r.read, ref: r.ref || undefined }); st.notifications.sort((x, y) => s(y.ts).localeCompare(s(x.ts))); if (st.notifications.length > 500) st.notifications.length = 500; } break;
      case 'campaigns': if (del) drop('campaigns'); else upsertList(st.campaigns, id, Object.assign({ id, name: r.name, type: r.kind, festival: r.festival, start: d10(r.start_date), end: d10(r.end_date), notes: r.notes }, r.targets || {})); break;
      case 'brands': if (del) drop('extraBrands'); else upsertList(st.extraBrands, id, { id, name: r.name, services: r.services, notes: r.notes }); break;
      case 'achievements': { const k = id.slice(2), bag = id.startsWith('m:') ? 'milestones' : 'achievements'; st[bag] = st[bag] || {}; if (del) delete st[bag][k]; else st[bag][k] = r.unlocked_at; break; }
      case 'sets': { if (r.pub_start && r.pub_end) st.settings.pubWindows = Object.assign({}, st.settings.pubWindows, { [id]: { start: d10(r.pub_start), end: d10(r.pub_end) } }); break; }
      default: return false;
    }
    return true;
  }
  // A deliverable nobody has worked on yet (safe to replace with the cloud copy).
  const PLAN = {}; D.buildAssets().forEach((a) => { PLAN[a.id] = hash(deliverableRow(a)); });
  const hasWork = (st) => st.assets.some((a) => PLAN[a.id] !== hash(deliverableRow(a))) || (st.customTasks || []).length > 0 || (st.notes || []).length > 0 || (st.focusSessions || []).length > 0 || (st.mahiReports || []).length > 0;
  const pristine = (rec) => rec && rec.table === 'deliverables' && PLAN[rec.id] === hash(rec.row);

  // ---------------------------------------------------------------- persisted sync metadata (per account)
  const metaKey = () => (root.MAHI_STORAGE_KEY || 'mahi.state') + '.cloud2';
  function loadMeta() { try { meta = JSON.parse(localStorage.getItem(metaKey()) || 'null'); } catch (e) { meta = null; } if (!meta || typeof meta !== 'object') meta = {}; meta.shadow = meta.shadow || {}; meta.queue = meta.queue || []; meta.conflicts = meta.conflicts || {}; meta.device = meta.device || ('web-' + Math.random().toString(36).slice(2, 8)); }
  function saveMeta() { try { localStorage.setItem(metaKey(), JSON.stringify(meta)); } catch (e) { /* storage full: sync still works this session */ } }
  const newOpId = () => 'op-' + meta.device + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  // Deletions are soft (deleted_at) and recoverable; deliverables, the profile and sets are never deleted.
  const DELETABLE = ['tasks', 'notes', 'work_reports', 'focus_sessions', 'notifications', 'campaigns', 'brands', 'achievements'];
  function dirtyRecords(recs) {
    const out = [];
    recs.forEach((rec, k) => { if (meta.conflicts[k]) return; const sh = meta.shadow[k]; if (!sh || sh.deleted || sh.h !== hash(rec.row)) out.push([k, rec]); });
    Object.keys(meta.shadow).forEach((k) => {
      const sh = meta.shadow[k], [table, id] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)];
      if (recs.has(k) || sh.deleted || sh.v == null || meta.conflicts[k] || !DELETABLE.includes(table)) return;
      out.push([k, { table, id, row: { deleted_at: new Date().toISOString() }, del: true }]);
    });
    return out;
  }
  function unsyncedParts() { if (!meta) return ['all']; return dirtyRecords(records(S.state)).map(([k]) => k).concat(meta.queue.length ? ['queue'] : [], Object.keys(meta.conflicts)); }
  function canDropLocalCopy() { return !!adapter && sync.status === 'synced' && !pushing && !S.pendingSave && unsyncedParts().length === 0; }

  // ---------------------------------------------------------------- push
  function schedulePush(ms) { if (!adapter) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, ms == null ? 1200 : ms); if (sync.status === 'synced') setStatus('waiting', 'Waiting for cloud sync'); }
  async function sendItem(item) {
    const res = await adapter.rpc('mahi_push', { p_op_id: item.opId, p_device: meta.device, p_ops: item.ops });
    if (!res || typeof res !== 'object') throw Object.assign(new Error('Empty reply from the cloud'), { network: true });
    if (res.status === 'ok') {
      (res.applied || []).forEach((x) => { const k = x.table + '|' + x.id; if (item.hashes[k] != null) meta.shadow[k] = { v: x.version, h: item.hashes[k], deleted: item.hashes[k] === '#deleted' || undefined }; });
      (res.quarantined || []).forEach((x) => { const k = x.table + '|' + x.id; meta.shadow[k] = { v: null, h: item.hashes[k], quarantined: x.reason }; });
      meta.lastAck = res.server_time || new Date().toISOString();
    } else if (res.status === 'conflict') {
      const recs = records(S.state);
      (res.conflicts || []).forEach((c) => {
        const k = c.table + '|' + c.id, local = recs.get(k);
        if (!c.server_row) { meta.shadow[k] = Object.assign({}, meta.shadow[k] || {}, { h: '#retry' }); return; } // concurrent create: pull first, then retry
        // Same content on both sides, or an untouched plan record: adopt the server version, no question needed.
        if (local && (pristine(local) || sameAsServer(local, c.table, c.server_row))) { adopt(c.table, c.server_row); adopted++; return; }
        meta.conflicts[k] = { table: c.table, id: c.id, server_version: c.server_version, server_row: c.server_row, at: new Date().toISOString() };
      });
    }
    meta.queue = meta.queue.filter((q) => q.opId !== item.opId); saveMeta();
    return res;
  }
  function sameAsServer(local, table, serverRow) {
    const probe = JSON.parse(JSON.stringify(S.state)); applyRow(probe, table, serverRow);
    const back = records(probe).get(local.table + '|' + local.id);
    return !!back && hash(back.row) === hash(local.row);
  }
  function adopt(table, row) {
    applyRow(S.state, table, row);
    const k = table + '|' + row.id, rec = records(S.state).get(k);
    meta.shadow[k] = { v: row.version, h: rec ? hash(rec.row) : '', deleted: row.deleted_at ? true : undefined };
    delete meta.conflicts[k];
  }
  async function push() {
    if (!adapter || S.pendingUpgrade) return;
    if (pushing) { pushAgain = true; return; }
    pushing = true; clearTimeout(retryTimer);
    try {
      for (let round = 0; round < 6; round++) {
        if (meta.queue.length) { setStatus('syncing', 'Synchronising…'); await sendItem(meta.queue[0]); continue; } // finish an interrupted send first, same op id
        const dirty = dirtyRecords(records(S.state));
        if (!dirty.length) break;
        setStatus('syncing', `Synchronising ${dirty.length} change${dirty.length === 1 ? '' : 's'}…`);
        for (let i = 0; i < dirty.length; i += BATCH) {
          const part = dirty.slice(i, i + BATCH), hashes = {};
          const ops = part.map(([k, rec]) => { hashes[k] = rec.del ? '#deleted' : hash(rec.row); const sh = meta.shadow[k]; return { table: rec.table, id: rec.id, base_version: sh && sh.v != null ? sh.v : null, row: sh && sh.deleted && !rec.del ? Object.assign({}, rec.row, { deleted_at: '' }) : rec.row, quarantine_on_error: !sh }; });
          const item = { opId: newOpId(), ops, hashes, at: Date.now() };
          meta.queue.push(item); saveMeta();                    // persisted before sending: a retry reuses the same op id
          const res = await sendItem(item);
          if (res.status === 'conflict') break;                 // re-evaluate what is still dirty in the next round
        }
      }
      retryDelay = 2000;
      afterSync();
    } catch (e) { failed(e); } finally {
      pushing = false;
      if (pushAgain) { pushAgain = false; schedulePush(300); }
    }
  }
  function afterSync() {
    if (adopted) { adopted = 0; S.save(true, { fromSync: true }); S.emit('change', { fromSync: true }); }
    const n = Object.keys(meta.conflicts).length;
    if (n) { setStatus('conflict', `${n} record${n === 1 ? '' : 's'} changed on another device – choose which version to keep`); return; }
    if (dirtyRecords(records(S.state)).length || meta.queue.length) { setStatus('waiting', 'Waiting for cloud sync'); return; }
    S.state.syncedAt = Date.now(); sync.lastSync = meta.lastAck || new Date().toISOString();
    setStatus('synced', 'Cloud synced ' + istTime(sync.lastSync));
  }
  function failed(e) {
    console.warn('MAHI cloud sync:', e && e.message);
    if (e && e.auth) { setStatus('auth', 'Session expired – sign in again. Your work is kept on this device.'); return; }
    const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || (e && e.network);
    setStatus(offline ? 'offline' : 'error', offline ? 'Offline – saved on this device, will sync when you are back online' : 'Sync failed – saved on this device. Retrying…');
    clearTimeout(retryTimer); retryTimer = setTimeout(() => { push(); }, retryDelay); retryDelay = Math.min(retryDelay * 2, 60000);
  }

  // ---------------------------------------------------------------- pull
  async function pull() {
    if (!adapter || S.pendingUpgrade) return 0;
    let applied = 0, more = true, guard = 0;
    while (more && guard++ < 200) {
      const res = await adapter.rpc('mahi_pull', { p_cursor: meta.cursor || null, p_limit: 1000 });
      const changes = (res && res.changes) || [];
      if (changes.length) {
        const recs = records(S.state);
        changes.forEach((ch) => {
          const row = ch.row || {}, k = ch.table + '|' + row.id, sh = meta.shadow[k], local = recs.get(k);
          if (sh && sh.v != null && row.version <= sh.v) return;                    // already have this version
          const localDirty = !!local && (!sh || sh.h !== hash(local.row)) && !pristine(local) && !(freshLocal && !sh);
          if (!localDirty || sameAsServer(local, ch.table, row)) { adopt(ch.table, row); applied++; }
          else meta.conflicts[k] = { table: ch.table, id: row.id, server_version: row.version, server_row: row, at: new Date().toISOString() };
        });
        if (applied) { S.save(true, { fromSync: true }); S.emit('change', { fromSync: true }); }
      }
      meta.cursor = (res && res.next_cursor) || meta.cursor; more = !!(res && res.has_more); saveMeta();
    }
    return applied;
  }
  function schedulePull(ms) { clearTimeout(pullTimer); pullTimer = setTimeout(async () => { try { const n = await pull(); if (n && root.MAHI_UI) root.MAHI_UI.toast('Updated from your other device', 'ok'); await push(); } catch (e) { failed(e); } }, ms == null ? 400 : ms); }

  // ---------------------------------------------------------------- conflicts
  sync.conflicts = () => Object.keys((meta && meta.conflicts) || {}).map((k) => Object.assign({ key: k }, meta.conflicts[k]));
  sync.resolve = (key, choice) => {
    const c = meta && meta.conflicts[key]; if (!c) return false;
    if (choice === 'theirs') adopt(c.table, c.server_row);
    else { meta.shadow[key] = { v: c.server_version, h: '#mine' }; delete meta.conflicts[key]; } // next push updates on top of the server version
    saveMeta(); S.save(true, { fromSync: true }); S.emit('change', { fromSync: true }); schedulePush(50); return true;
  };

  // ---------------------------------------------------------------- lifecycle
  async function start(ad) {
    stop(); adapter = ad;
    if (!adapter) { setStatus('local', 'Saved in this browser only'); return; }
    loadMeta();
    // The sync metadata must belong to THIS browser copy. If the copy was cleared or replaced, start the
    // comparison from scratch so an empty or different copy can never be pushed over the cloud records.
    if (!S.state.cloudBound || meta.boundTo !== S.state.cloudBound) {
      meta.shadow = {}; meta.cursor = null; meta.conflicts = {};
      S.state.cloudBound = S.state.cloudBound || ('c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)); meta.boundTo = S.state.cloudBound; saveMeta();
    }
    freshLocal = !hasWork(S.state);
    if (S.pendingUpgrade) { setStatus('waiting', 'Plan update waiting – cloud sync starts after you apply it'); return; }
    setStatus('connecting', 'Connecting to ' + adapter.label + '…');
    try {
      const first = !meta.cursor && !Object.keys(meta.shadow).length;
      await pull();
      freshLocal = false;
      await push();
      if (first && sync.status === 'synced') { S.notify('import', 'Cloud sync enabled', 'Your MAHI work is now saved to ' + adapter.label + '.'); await push(); }
    } catch (e) { failed(e); }
    try { if (adapter.subscribe) unsub = adapter.subscribe(() => schedulePull(600)); } catch (e) { /* realtime is only a hint; polling below covers it */ }
    pollTimer = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') schedulePull(0); }, 60000);
  }
  function stop() { if (unsub) { try { unsub(); } catch (e) { /* ignore */ } } unsub = null; clearInterval(pollTimer); clearTimeout(pushTimer); clearTimeout(pullTimer); clearTimeout(retryTimer); adapter = null; }
  if (typeof root.addEventListener === 'function') root.addEventListener('online', () => { if (adapter) { retryDelay = 2000; schedulePull(0); } });
  if (typeof document !== 'undefined' && document && document.addEventListener) document.addEventListener('visibilitychange', () => { if (adapter && document.visibilityState === 'visible') schedulePull(0); });
  S.on('saved', (info) => { if (adapter && !(info && info.fromSync)) schedulePush(); });

  Object.assign(sync, { start, stop, pull, canDropLocalCopy, unsyncedParts, records, applyRow, hash,
    pushNow: () => { clearTimeout(pushTimer); return push(); } });
  Object.defineProperty(sync, 'pending', { get: () => (meta ? meta.queue.length : 0) });
  root.MAHI_SYNC = sync;
})(typeof self !== 'undefined' ? self : this);

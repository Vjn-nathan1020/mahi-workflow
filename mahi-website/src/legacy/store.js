/* MAHI – application state, persistence, derived metrics and deterministic reaction rules. */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA;
  const KEY0 = 'mahi.state.v1';
  const keyName = () => root.MAHI_STORAGE_KEY || KEY0; // per-user cache key on the website
  const listeners = {};
  let state = null;
  let saveTimer = null;
  let storageOk = true;

  const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  const emit = (ev, payload) => { (listeners[ev] || []).forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } }); };
  const nowISO = () => new Date().toISOString();
  const today = () => D.localISO(new Date());
  const uid = (p) => (p || 'X') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function migrate(s) {
    // Saved data from the 7-set plan (schema 1, or no schema) is renumbered to the 5-set plan first.
    if (s && Array.isArray(s.assets) && !(Number(s.schema) >= 2)) s = D.upgradeV1(s);
    const base = D.initialState();
    const out = Object.assign({}, base, s);
    out.settings = Object.assign({}, base.settings, s.settings || {});
    out.settings.pubWindows = Object.assign({}, base.settings.pubWindows, (s.settings || {}).pubWindows || {});
    if (!Array.isArray(out.settings.vjs) || out.settings.vjs.length !== 3) out.settings.vjs = base.settings.vjs;
    // make sure every confirmed asset exists exactly once (never invent / duplicate)
    const byId = {}; (s.assets || []).forEach((a) => { if (a && a.id && !byId[a.id]) byId[a.id] = a; });
    out.assets = base.assets.map((b) => (byId[b.id] ? Object.assign(D.blankAsset(), b, byId[b.id], { type: b.type, set: b.set, brand: b.brand, festival: b.festival, vj: b.vj }) : b));
    ['customTasks', 'notes', 'notifications', 'history', 'focusSessions', 'campaigns', 'extraBrands', 'platformLogs', 'mahiReports', 'removedAssets', 'quarantine'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
    out.schema = D.SCHEMA_VERSION; delete out.planReport;
    ['achievements', 'milestones', 'alertLog'].forEach((k) => { if (!out[k] || typeof out[k] !== 'object') out[k] = {}; });
    return out;
  }

  // Keys used by earlier MAHI builds. If this build's key is empty, the newest of these is adopted
  // (copied, never deleted) so an update or a key change can never show an empty plan.
  const LEGACY_KEYS = ['mahi.state.v1', 'mahi.state.local'];
  // ---- 5-set plan upgrade: preview first, nothing saved until the user confirms ----
  // Saved data from the 7-set plan is copied verbatim to "<key>.plan-v1-archive" and shown upgraded
  // in memory only. While an upgrade is pending, save() writes nothing.
  let pendingUpgrade = null;
  const needsUpgrade = (p) => !!p && Array.isArray(p.assets) && !(Number(p.schema) >= 2);
  function holdForUpgrade(parsed, raw) {
    const report = D.upgradeV1(parsed).planReport;
    let archiveKey = keyName() + '.plan-v1-archive';
    try {
      const prev = localStorage.getItem(archiveKey);
      if (prev && prev !== raw) archiveKey += '.' + Date.now();
      if (!prev || prev !== raw) localStorage.setItem(archiveKey, raw);
    } catch (e) { report.archiveFailed = true; }
    pendingUpgrade = { report, archiveKey };
    emit('upgrade-pending', pendingUpgrade);
  }
  function applyUpgrade() {
    if (!pendingUpgrade) return { ok: false, reason: 'No plan update is waiting' };
    const p = pendingUpgrade; pendingUpgrade = null;
    state.planUpgrade = { appliedAt: nowISO(), from: '7 sets (616 deliverables)', to: D.SETS.length + ' sets (' + D.buildAssets().length + ' deliverables)', report: p.report, archiveKey: p.archiveKey };
    state.localChangedAt = Date.now(); save(true, { planUpgrade: true });
    const v = verifySaved((saved) => Number(saved.schema) >= 2 && Array.isArray(saved.assets) && saved.assets.length === state.assets.length);
    if (!v.ok) pendingUpgrade = p;
    emit('change', { planUpgrade: true });
    return v;
  }
  // Puts the archived pre-update data back as the working copy (current copy kept as ".before-archive-restore").
  // The caller reloads the page; the update preview then appears again.
  function restorePlanArchive(archiveKey) {
    const k = archiveKey || keyName() + '.plan-v1-archive';
    let raw = null; try { raw = localStorage.getItem(k); } catch (e) { return false; }
    if (!raw) return false;
    flush(); backupRaw('.before-archive-restore');
    try { localStorage.setItem(keyName(), raw); return true; } catch (e) { return false; }
  }
  const planArchiveRaw = (k) => { try { return localStorage.getItem(k || keyName() + '.plan-v1-archive'); } catch (e) { return null; } };
  let recovered = '';
  let lastSavedAt = 0;
  function workScore(s) {
    if (!s || !Array.isArray(s.assets)) return 0;
    return s.assets.filter((a) => a && ((a.status && a.status !== 'Not Started') || (a.pubStatus && a.pubStatus !== 'Not Scheduled'))).length
      + (s.customTasks || []).length + (s.notes || []).length + (s.focusSessions || []).length;
  }
  function backupRaw(suffix) { try { const r = localStorage.getItem(keyName()); if (r) localStorage.setItem(keyName() + suffix, r); } catch (e) { /* storage full – best effort */ } }

  function load() {
    const key = keyName();
    let raw = null, parsed = null;
    recovered = '';
    try { raw = localStorage.getItem(key); } catch (e) { storageOk = false; }
    if (raw) {
      try { parsed = JSON.parse(raw); }
      catch (e) {
        // Never let a fresh plan silently overwrite data that could not be read: keep the bytes for recovery.
        try { localStorage.setItem(key + '.corrupt.' + Date.now(), raw); } catch (e2) { /* ignore */ }
        console.warn('MAHI: saved data unreadable – a copy was kept, starting from the plan', e);
        recovered = 'corrupt';
      }
    } else {
      let best = null;
      let bestRaw = null;
      LEGACY_KEYS.filter((k) => k !== key).forEach((k) => {
        try { const r = localStorage.getItem(k); if (!r) return; const p = JSON.parse(r); if (workScore(p) > workScore(best)) { best = p; bestRaw = r; } } catch (e) { /* skip unreadable */ }
      });
      if (best && workScore(best) > 0) { parsed = best; raw = bestRaw; recovered = 'legacy'; }
    }
    pendingUpgrade = null;
    if (needsUpgrade(parsed)) holdForUpgrade(parsed, raw || JSON.stringify(parsed));
    state = parsed ? migrate(parsed) : Object.assign(D.initialState(), { alertLog: {} });
    index();
    if (recovered === 'corrupt') notify('import', 'Saved data could not be read', 'A copy was kept in this browser for recovery. Restore your latest backup from Excel ▸ Backup & restore.');
    if (recovered === 'legacy') { notify('import', 'Earlier work recovered', 'MAHI found your work saved by an earlier version and loaded it.'); save(true); }
    rollover(false);
    return state;
  }
  let byId = {};
  function index() { byId = {}; state.assets.forEach((a) => { byId[a.id] = a; }); }

  function save(immediate, info) {
    clearTimeout(saveTimer); saveTimer = null;
    if (pendingUpgrade) { emit('save-blocked', pendingUpgrade); return; } // nothing is written before the plan update is confirmed
    const doSave = () => {
      saveTimer = null;
      try { localStorage.setItem(keyName(), JSON.stringify(state)); storageOk = true; lastSavedAt = Date.now(); }
      catch (e) { storageOk = false; emit('storage-error', e); }
      emit('saved', info || {}); // cloud sync listens here, even when browser storage is blocked
    };
    if (immediate) doSave(); else { saveTimer = setTimeout(doSave, 250); emit('saving'); }
  }
  // Write any pending change at once – called when the tab is hidden, closed or reloaded,
  // so a change made just before closing is never lost inside the save delay.
  function flush() { if (saveTimer && state) save(true); }
  if (typeof root.addEventListener === 'function') { root.addEventListener('pagehide', flush); root.addEventListener('beforeunload', flush); }
  if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  function changed(what) { state.localChangedAt = Date.now(); save(); emit('change', what || {}); }

  // ---------------- new day: carry unfinished personal tasks forward ----------------
  // Only the date of unfinished tasks moves; nothing is deleted and completed work keeps its date.
  // Daily counters start at zero by themselves because they are calculated from completion dates.
  function rollover(markChanged) {
    const t = today(); let n = 0;
    state.customTasks.forEach((x) => {
      if (x.status !== 'Completed' && x.date && x.date < t) { if (!x.carriedFrom) x.carriedFrom = x.date; x.date = t; n++; }
    });
    if (n) {
      state.history.push({ ts: nowISO(), id: 'personal-tasks', field: 'carriedForward', from: '', to: String(n) });
      notify('reminder', `${n} unfinished task(s) carried forward`, `Moved to ${D.fmtDate(t)}. Nothing was deleted.`);
      if (markChanged) changed({ rollover: true }); else save(true);
    }
    return n;
  }

  // ---------------- performance history (never reset) ----------------
  // Built from the permanent completion dates of deliverables and personal tasks, in IST.
  function completedItems() {
    const items = [];
    state.assets.forEach((a) => { if (D.isDone(a)) items.push({ d: a.completionDate || '', kind: 'deliverable', type: a.type }); });
    state.customTasks.forEach((x) => { if (x.status === 'Completed') items.push({ d: x.completedOn || (x.completedAt ? D.localISO(new Date(x.completedAt)) : x.date || ''), kind: 'task' }); });
    return items;
  }
  function performance(at) {
    const t = at || today();
    const items = completedItems();
    const count = (l) => ({ total: l.length, deliverables: l.filter((i) => i.kind === 'deliverable').length, tasks: l.filter((i) => i.kind === 'task').length });
    const range = (from, to) => count(items.filter((i) => i.d && i.d >= from && i.d <= (to || t)));
    const y = D.addDays(t, -1);
    return {
      today: t, weekStart: D.weekStart(t),
      day: range(t), yesterday: range(y, y), week: range(D.weekStart(t)), month: range(t.slice(0, 7) + '-01'), year: range(t.slice(0, 4) + '-01-01'),
      all: count(items),
    };
  }

  // ---------------- metrics ----------------
  function pct(a, b) { return b ? a / b : 0; }
  function group(list, keyFn) {
    const g = {};
    list.forEach((a) => { const k = keyFn(a); const x = g[k] = g[k] || { target: 0, done: 0, overdue: 0, due: 0, published: 0, scheduled: 0 }; x.target++; if (D.isDone(a)) x.done++; const f = a.__flag; if (f === 'OVERDUE') x.overdue++; else if (f && f.startsWith('DUE')) x.due++; if (a.pubStatus === 'Published') x.published++; if (a.pubStatus === 'Scheduled') x.scheduled++; });
    Object.values(g).forEach((x) => { x.pending = x.target - x.done; x.pct = pct(x.done, x.target); });
    return g;
  }
  function currentSet(t) {
    const d = t || today();
    return D.SETS.find((s) => s.end >= d) || null;
  }
  function metrics(now) {
    const n = now || new Date();
    const t = D.localISO(n);
    const th = state.settings.thresholds;
    state.assets.forEach((a) => { a.__flag = D.deadlineFlag(a, n, th); a.__stage = D.stageOf(a); });
    const A = state.assets;
    const done = A.filter(D.isDone);
    const m = {
      today: t, total: A.length, done: done.length, pending: A.length - done.length, pct: pct(done.length, A.length),
      byType: group(A, (a) => a.type), byFestival: group(A, (a) => a.festival), bySet: group(A, (a) => a.set), byBrand: group(A, (a) => a.brand),
      byBrandSet: group(A, (a) => a.set + '|' + a.brand), byVJ: group(A.filter((a) => a.vj), (a) => a.vj), byStage: {},
      overdue: A.filter((a) => a.__flag === 'OVERDUE'), dueSoon: A.filter((a) => a.__flag && a.__flag.startsWith('DUE')),
      underReview: A.filter((a) => a.status === 'Under Review'), correction: A.filter((a) => a.status === 'Correction Required'),
      scheduled: A.filter((a) => a.pubStatus === 'Scheduled'), published: A.filter((a) => a.pubStatus === 'Published'),
      todayActive: A.filter((a) => a.prodStart <= t && a.deadline >= t),
      todayCompleted: A.filter((a) => a.completionDate === t && D.isDone(a)),
      current: currentSet(t),
    };
    m.todayPending = m.todayActive.filter((a) => !D.isDone(a));
    A.forEach((a) => { const k = a.type + '|' + a.__stage; m.byStage[k] = (m.byStage[k] || 0) + 1; });
    m.currentStats = m.current ? m.bySet[m.current.code] : null;
    const tasksToday = state.customTasks.filter((x) => x.date === t);
    m.customToday = tasksToday; m.customTodayDone = tasksToday.filter((x) => x.status === 'Completed');
    return m;
  }

  // ---------------- notifications & history ----------------
  function notify(type, title, body, extra) {
    const n = Object.assign({ id: uid('N'), ts: nowISO(), type, title, body: body || '', read: false }, extra || {});
    state.notifications.unshift(n);
    if (state.notifications.length > 500) state.notifications.length = 500;
    emit('notification', n);
    return n;
  }
  function logHistory(id, field, from, to) {
    state.history.push({ ts: nowISO(), id, field, from, to });
    if (state.history.length > 5000) state.history.splice(0, state.history.length - 5000);
  }

  // ---------------- asset updates + reaction engine ----------------
  const label = (a) => `${a.brand} ${a.festival} ${a.type === 'Poster' ? 'poster' : a.type === 'AI Video' ? 'AI video' : 'VJ video'}`;
  const vjName = (id) => { const v = state.settings.vjs.find((x) => x.id === id); return v ? v.name : id; };

  function applyPatch(a, patch) {
    const changes = [];
    Object.keys(patch).forEach((k) => {
      if (k.startsWith('__') || ['id', 'type', 'set', 'brand', 'festival', 'vj'].includes(k)) return;
      const v = patch[k] == null ? '' : patch[k];
      if (a[k] !== v) { changes.push([k, a[k], v]); a[k] = v; }
    });
    // completion date bookkeeping (only when the user did not set it explicitly)
    const wasDone = changes.some(([k, f]) => k === 'status' && D.DONE_STATUSES.includes(f));
    const nowDone = D.isDone(a);
    if (changes.some(([k]) => k === 'status')) {
      if (nowDone && !a.completionDate) { a.completionDate = today(); changes.push(['completionDate', '', a.completionDate]); }
      if (!nowDone && !('completionDate' in patch) && a.completionDate) { changes.push(['completionDate', a.completionDate, '']); a.completionDate = ''; }
      if (a.status === 'Approved' && a.finalApproval !== 'Approved') { a.finalApproval = 'Approved'; }
      if (a.status === 'Correction Required') { a.correction = 'Required'; }
    }
    return { changes, becameDone: !wasDone && nowDone && changes.some(([k]) => k === 'status'), undone: wasDone && !nowDone };
  }

  // Update one or more assets; returns list of change summaries. Triggers deterministic MAHI reactions.
  function updateAssets(ids, patch, opts) {
    opts = opts || {};
    const before = snapshotProgress();
    const completed = [], corrections = [], published = [];
    ids.forEach((id) => {
      const a = byId[id]; if (!a) return;
      const oldStatus = a.status, oldPub = a.pubStatus;
      const r = applyPatch(a, patch);
      r.changes.forEach(([k, f, t]) => logHistory(id, k, f, t));
      if (r.becameDone) completed.push(a);
      if (a.status === 'Correction Required' && oldStatus !== 'Correction Required') corrections.push(a);
      if (a.pubStatus === 'Published' && oldPub !== 'Published') published.push(a);
    });
    // opts.defer: build MAHI's reactions but hand them back instead of showing them, so the caller can
    // show success only after the save is verified (Report to MAHI / chat).
    const reactions = opts.silent ? [] : react(before, completed, corrections, published, !!opts.defer);
    changed({ assets: ids });
    return { completed, corrections, published, reactions };
  }

  function snapshotProgress() {
    const done = state.assets.filter(D.isDone).length;
    return { done, sets: group(state.assets, (a) => a.set), brandSets: group(state.assets, (a) => a.set + '|' + a.brand), fest: group(state.assets, (a) => a.festival) };
  }

  function react(before, completed, corrections, published, defer) {
    const after = snapshotProgress();
    const R = [];
    const name = state.settings.callName || 'Nathan';
    // task completion reactions
    if (completed.length === 1) {
      const a = completed[0];
      if (a.type === 'AI Video') R.push({ kind: 'ai', priority: 1, msg: `Another AI video completed, ${name}! Great work!`, detail: `${a.id} · ${label(a)} is completed!` });
      else if (a.type === 'VJ Video') R.push({ kind: 'vj', priority: 1, msg: `${name}, the assigned VJ video is successfully completed.`, detail: `${vjName(a.vj)} · ${a.brand} (${a.id})` });
      else R.push({ kind: 'poster', priority: 1, msg: `Beautiful work! Another poster is ready, ${name}.`, detail: `${name}, your ${label(a)} is completed! (${a.id})` });
      notify(a.type === 'Poster' ? 'poster' : a.type === 'AI Video' ? 'ai' : 'vj', `${a.type} completed`, `${a.id} · ${label(a)}${a.vj ? ' · ' + vjName(a.vj) : ''}`, { ref: a.id });
    } else if (completed.length > 1) {
      R.push({ kind: 'multi', priority: 1, msg: `Fantastic progress, ${name}! You're getting things done!`, detail: `${completed.length} deliverables completed: ${summarizeTypes(completed)}` });
      notify('task', `${completed.length} tasks completed`, summarizeTypes(completed));
    }
    corrections.forEach((a, i) => {
      if (i === 0) R.push({ kind: 'correction', priority: 2, msg: `${name}, this creative needs a small correction before approval.`, detail: `${a.id} · ${label(a)}`, ref: a.id });
      notify('correction', 'Correction required', `${a.id} · ${label(a)}`, { ref: a.id });
    });
    published.forEach((a) => notify('publish', 'Content published', `${a.id} · ${label(a)}${D.isDone(a) ? '' : ' (⚠ published before production approval)'}`, { ref: a.id }));
    // brand-in-set completion (one celebration per update, however many brands finished)
    const brandsDone = [];
    Object.keys(after.brandSets).forEach((k) => {
      const b = before.brandSets[k], x = after.brandSets[k];
      if (x.done === x.target && (!b || b.done < b.target)) {
        const [set, brand] = k.split('|');
        brandsDone.push({ set, brand, n: x.target });
        notify('brand', 'Brand target completed', `${brand} · ${D.setByCode(set).label} – all ${x.target} deliverables`);
      }
    });
    if (brandsDone.length === 1) {
      const z = brandsDone[0];
      R.push({ kind: 'brand', priority: 3, msg: `${name}, all deliverables for this brand in the selected set are completed!`, detail: `${z.brand} · ${D.setByCode(z.set).label} (${z.n}/${z.n})`, badge: z.brand });
    } else if (brandsDone.length > 1) {
      R.push({ kind: 'brand', priority: 3, msg: `${name}, all deliverables for ${brandsDone.length} brands are completed!`, detail: brandsDone.slice(0, 4).map((z) => `${z.brand} (${D.setByCode(z.set).label})`).join(', ') + (brandsDone.length > 4 ? ` +${brandsDone.length - 4} more` : ''), badge: `${brandsDone.length} brands` });
    }
    // set completion
    Object.keys(after.sets).forEach((k) => {
      const b = before.sets[k], x = after.sets[k];
      if (x.done === x.target && b.done < b.target) {
        const s = D.setByCode(k);
        const mk = 'set100:' + k;
        notify('set', 'Set target completed', `${s.label} (${s.festival}) – all ${x.target} deliverables completed`);
        if (!state.milestones[mk]) { state.milestones[mk] = nowISO(); R.push({ kind: 'set100', priority: 5, msg: `You did it, ${name}! All ${x.target} deliverables in this production set are completed!`, detail: `${s.label} · ${s.festival}` }); }
      }
    });
    Object.keys(after.fest).forEach((k) => {
      const b = before.fest[k], x = after.fest[k];
      if (x.done === x.target && b.done < b.target) notify('festival', 'Festival target completed', `${k} – all ${x.target} deliverables completed`);
    });
    // overall milestones – trigger only when actually crossing a threshold, once ever
    const total = state.assets.length;
    [[25, 'milestone25', `Great start, ${name}! You've reached 25% of your target.`], [50, 'milestone50', `Halfway there, ${name}! Keep up the excellent progress.`], [75, 'milestone75', `Almost there, ${name}! I'm cheering for you.`]].forEach(([p, kind, msg]) => {
      const thr = Math.ceil(total * p / 100);
      const mk = 'overall' + p;
      if (before.done < thr && after.done >= thr && !state.milestones[mk]) {
        state.milestones[mk] = nowISO();
        R.push({ kind, priority: 4, msg, detail: `${after.done} / ${total} deliverables completed` });
        notify('achievement', `${p}% milestone reached`, `${after.done} / ${total} deliverables completed`);
      }
    });
    if (before.done < total && after.done === total && !state.milestones.overall100) {
      state.milestones.overall100 = nowISO();
      R.push({ kind: 'grand', priority: 9, msg: `Congratulations, ${name}! You've successfully completed your entire festival production workflow!`, detail: `${total} / ${total} DELIVERABLES COMPLETED` });
    }
    // achievements
    const st = D.achievementStatus(state.assets);
    const unlocked = [];
    D.ACHIEVEMENTS.forEach((a) => {
      if (st[a.key] && !state.achievements[a.key]) {
        state.achievements[a.key] = nowISO();
        notify('achievement', 'Achievement unlocked', `${a.icon} ${a.name}`);
        unlocked.push(a);
      }
    });
    if (unlocked.length === 1) R.push({ kind: 'achievement', priority: 0.5, msg: `Achievement unlocked, ${name}: ${unlocked[0].name}!`, detail: unlocked[0].icon + ' ' + unlocked[0].cond });
    else if (unlocked.length > 1) R.push({ kind: 'achievement', priority: 0.5, msg: `${unlocked.length} achievements unlocked, ${name}!`, detail: unlocked.map((a) => a.icon + ' ' + a.name).join(' · ') });
    // daily target
    checkDailyDone(R);
    R.sort((x, y) => y.priority - x.priority);
    if (R.length && !defer) emit('reactions', R);
    return R;
  }

  // Read the saved browser copy back and confirm it holds what was just changed.
  // check(savedState) → true when the saved data contains the change. Never trusts memory alone.
  function verifySaved(check) {
    flush();
    if (!storageOk) return { ok: false, reason: 'Browser storage is full or blocked' };
    try {
      const raw = localStorage.getItem(keyName());
      if (!raw) return { ok: false, reason: 'Nothing was written to browser storage' };
      const saved = JSON.parse(raw);
      return check(saved) ? { ok: true } : { ok: false, reason: 'The saved copy does not contain the change' };
    } catch (e) { return { ok: false, reason: 'Could not read the saved copy back (' + (e && e.message) + ')' }; }
  }
  function summarizeTypes(list) {
    const c = {}; list.forEach((a) => { c[a.type] = (c[a.type] || 0) + 1; });
    return Object.keys(c).map((k) => `${c[k]} ${k}${c[k] > 1 ? 's' : ''}`).join(', ');
  }

  function checkDailyDone(R) {
    const t = today();
    const m = metrics();
    const planned = m.todayActive.length + m.customToday.length;
    const remaining = m.todayPending.length + (m.customToday.length - m.customTodayDone.length);
    state.alertLog = state.alertLog || {};
    if (planned > 0 && remaining === 0 && state.alertLog['daily:' + t] !== true) {
      state.alertLog['daily:' + t] = true;
      notify('daily', 'Daily target completed', `All ${planned} planned tasks for ${D.fmtDate(t)} are done.`);
      (R || []).push({ kind: 'daily', priority: 3, msg: `Excellent work, ${state.settings.callName || 'Nathan'}! You've completed today's planned tasks.`, detail: `${planned} planned tasks completed today` });
      return true;
    }
    return false;
  }

  // Deadline monitoring – runs on load and every minute while the app is open (not in the background).
  function deadlineScan(force) {
    rollover(true); // the app may stay open across midnight (IST)
    const m = metrics();
    const t = today(); const out = [];
    state.alertLog = state.alertLog || {};
    const name = state.settings.callName || 'Nathan';
    if (m.overdue.length && (force || !state.alertLog['overdue:' + t])) {
      state.alertLog['overdue:' + t] = true;
      const sets = [...new Set(m.overdue.map((a) => D.setByCode(a.set).label))].join(', ');
      notify('overdue', `${m.overdue.length} overdue assignment(s)`, `Sets: ${sets}`);
      out.push({ kind: 'overdue', priority: 6, msg: `${name}, some assignments are overdue. Let's prioritize them.`, detail: `${m.overdue.length} overdue · ${sets}`, action: { label: 'Open overdue list', route: 'production?flag=OVERDUE' } });
    }
    if (m.dueSoon.length && (force || !state.alertLog['due:' + t])) {
      state.alertLog['due:' + t] = true;
      const g = {}; m.dueSoon.forEach((a) => { const k = a.set + '|' + a.brand; g[k] = (g[k] || 0) + 1; });
      const first = m.dueSoon.slice().sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
      const hrs = Math.max(0, Math.round((D.istEndOfDay(first.deadline) - Date.now()) / 3600000));
      const brands = [...new Set(m.dueSoon.map((a) => a.brand))];
      const sets = [...new Set(m.dueSoon.map((a) => D.setByCode(a.set).label))];
      notify('deadline', `${m.dueSoon.length} assignment(s) approaching deadline`, `${sets.join(', ')} · earliest deadline ${D.fmtDate(first.deadline)} · ${hrs}h remaining · ${brands.length} brand(s)`);
      out.push({ kind: 'deadline', priority: 5, msg: `${name}, you have assignments approaching their deadlines.`, detail: `${m.dueSoon.length} tasks · ${brands.slice(0, 3).join(', ')}${brands.length > 3 ? ' +' + (brands.length - 3) + ' more' : ''} · ${sets.join(', ')} · deadline ${D.fmtDate(first.deadline)} · ${hrs}h left`, action: { label: 'Show due tasks', route: 'production?flag=DUE' } });
    }
    const pendingApproval = m.underReview.length;
    if (pendingApproval && (force || !state.alertLog['approval:' + t])) { state.alertLog['approval:' + t] = true; notify('approval', `${pendingApproval} item(s) waiting for approval`, 'Open the workflow board "Under Review" column.'); }
    // publishing reminders: scheduled for today
    const pubToday = state.assets.filter((a) => a.pubStatus === 'Scheduled' && a.pubDate === t);
    if (pubToday.length && (force || !state.alertLog['pub:' + t])) { state.alertLog['pub:' + t] = true; notify('publish', `${pubToday.length} post(s) scheduled for today`, pubToday.slice(0, 5).map((a) => a.id).join(', ')); }
    // custom task reminders
    state.customTasks.forEach((ct) => {
      if (ct.status !== 'Completed' && ct.date === t && ct.reminder && !state.alertLog['rem:' + ct.id + t]) {
        const [h, mi] = ct.reminder.split(':').map(Number); const [nh, nm] = D.istHM(new Date());
        if (nh > h || (nh === h && nm >= mi)) { state.alertLog['rem:' + ct.id + t] = true; notify('reminder', 'Reminder', ct.title); out.push({ kind: 'reminder', priority: 4, msg: `${name}, reminder: ${ct.title}`, detail: ct.notes || '' }); }
      }
    });
    if (out.length) { save(); emit('reactions', out); }
    emit('change', { scan: true });
    return out;
  }

  // ---------------- other mutations ----------------
  function setSettings(patch) { Object.assign(state.settings, patch); changed({ settings: true }); }
  function addCustomTask(t) { const x = Object.assign({ id: uid('T'), title: '', category: 'Production', priority: 'Medium', date: today(), reminder: '', status: 'Pending', linkedId: '', notes: '' }, t); state.customTasks.push(x); changed(); return x; }
  function updateCustomTask(id, patch, opts) {
    const t = state.customTasks.find((x) => x.id === id); if (!t) return [];
    const was = t.status; Object.assign(t, patch);
    let R = [];
    if (was === 'Completed' && t.status !== 'Completed') { t.completedAt = ''; t.completedOn = ''; }
    if (was !== 'Completed' && t.status === 'Completed') { t.completedAt = nowISO(); t.completedOn = today(); R = [{ kind: 'custom', priority: 1, msg: `Nice, ${state.settings.callName}! "${t.title}" is done.`, detail: 'Personal task (not counted in the 616 festival target)' }]; checkDailyDone(R); if (!(opts && opts.defer)) emit('reactions', R); }
    changed();
    return R;
  }
  function deleteCustomTask(id) { state.customTasks = state.customTasks.filter((x) => x.id !== id); changed(); }
  function addNote(n) { const x = Object.assign({ id: uid('N'), date: today(), title: '', category: 'Personal', text: '', linkedId: '', pinned: false }, n); state.notes.unshift(x); changed(); return x; }
  function updateNote(id, patch) { const n = state.notes.find((x) => x.id === id); if (n) { Object.assign(n, patch); changed(); } }
  function deleteNote(id) { state.notes = state.notes.filter((x) => x.id !== id); changed(); }
  function markRead(id) { state.notifications.forEach((n) => { if (!id || n.id === id) n.read = true; }); changed(); }
  function addCampaign(c) { const x = Object.assign({ id: uid('C'), name: '', type: 'New Festival Campaign', festival: '', start: '', end: '', posters: 0, ai: 0, vj: 0, completed: 0, notes: '' }, c); state.campaigns.push(x); changed(); return x; }
  function updateCampaign(id, patch) { const c = state.campaigns.find((x) => x.id === id); if (c) { Object.assign(c, patch); changed(); } }
  function deleteCampaign(id) { state.campaigns = state.campaigns.filter((x) => x.id !== id); changed(); }
  function addPlatformLog(l) { const x = Object.assign({ id: uid('L'), contentId: '', platform: 'Instagram', date: today(), time: '', status: 'Published', url: '', remarks: '' }, l); state.platformLogs.push(x); changed(); return x; }
  function deletePlatformLog(id) { state.platformLogs = state.platformLogs.filter((x) => x.id !== id); changed(); }
  function addFocusSession(s) { state.focusSessions.push(Object.assign({ id: uid('F'), ts: nowISO() }, s)); changed(); }
  function addExtraBrand(b) { state.extraBrands.push(Object.assign({ id: uid('B'), name: '', services: '', notes: '', added: today() }, b)); changed(); }
  function deleteExtraBrand(id) { state.extraBrands = state.extraBrands.filter((x) => x.id !== id); changed(); }

  // Whole-state replacement (backup restore, Excel import, cloud copy). The previous browser copy is kept
  // under "<key>.before-…" whenever it holds work that would otherwise be lost.
  function replaceAll(newState, info) {
    const fromSync = !!(info && info.fromSync);
    const unsynced = (state.localChangedAt || 0) > (state.syncedAt || 0);
    if (!fromSync || unsynced) { flush(); backupRaw(fromSync ? '.before-cloud' : '.before-replace'); }
    if (needsUpgrade(newState)) holdForUpgrade(newState, JSON.stringify(newState));
    state = migrate(newState); if (!fromSync) state.localChangedAt = Date.now(); index(); save(true, info);
    rollover(false);
    emit('change', { replaced: true });
  }
  function resetAll() { flush(); backupRaw('.before-reset'); try { localStorage.removeItem(keyName()); } catch (e) { /* ignore */ } state = D.initialState(); state.alertLog = {}; state.localChangedAt = Date.now(); index(); save(true); emit('change', { replaced: true }); }

  root.MAHI_STORE = {
    on, emit, load, save, flush, rollover, performance, verifySaved, get state() { return state; }, get storageOk() { return storageOk; },
    get lastSavedAt() { return lastSavedAt; }, get pendingUpgrade() { return pendingUpgrade; }, applyUpgrade, restorePlanArchive, planArchiveRaw, get pendingSave() { return !!saveTimer; }, get recovered() { return recovered; }, asset: (id) => byId[id], metrics, currentSet,
    updateAssets, setSettings, addCustomTask, updateCustomTask, deleteCustomTask, addNote, updateNote, deleteNote, markRead, notify,
    addCampaign, updateCampaign, deleteCampaign, addPlatformLog, deletePlatformLog, addFocusSession, addExtraBrand, deleteExtraBrand,
    deadlineScan, checkDailyDone, replaceAll, resetAll, migrate, vjName, uid, today, changed,
  };
})(typeof self !== 'undefined' ? self : this);

/* MAHI – application boot, shell, router and MAHI companion wiring. */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA, S = root.MAHI_STORE, UI = root.MAHI_UI, P = root.MAHI_PAGES, M = root.MAHI_CHAR;
  const esc = UI.esc;
  const NAV = [
    ['home', 'Home Dashboard', '🏠'], ['myday', 'My Day', '☀️'], ['board', 'My Workflow Board', '🗂️'], ['flow', 'Motion Workflow Chart', '🔀'],
    ['campaigns', 'Festival Campaigns', '🎉'], ['sets', 'All Production Sets', '📦'], ['brands', 'Brand Management', '🏷️'], ['posters', 'Poster Production', '🖼️'],
    ['ai', 'AI Video Production', '🤖'], ['vj1', 'VJ 01 Tracker', '🎬'], ['vj2', 'VJ 02 Tracker', '🎬'], ['vj3', 'VJ 03 Tracker', '🎬'],
    ['calendar', 'Publishing Calendar', '📅'], ['annual', 'Annual Workflow', '🗓️'], ['timer', 'My Focus Timer', '⏱️'], ['achievements', 'My Achievements', '🏆'],
    ['notes', 'My Notes', '📝'], ['notifications', 'MAHI Notifications', '🔔'], ['reports', 'Reports and Analytics', '📊'], ['excel', 'Excel Import and Export', '📥'], ['settings', 'Settings', '⚙️'],
  ];
  const app = {};

  function shell() {
    document.getElementById('app').innerHTML = `
    <aside class="sidebar" id="sidebar"><div class="brand"><div class="logo-slot" id="logo-slot"></div><div><div class="b-name">MAHI</div><div class="b-sub">Personal Workflow AI Assistant · VJ.Nathan</div></div></div>
      <nav>${NAV.map(([r, l, i]) => `<a href="#/${r}" data-nav="${r}"><span class="ni">${i}</span><span class="nl" data-label="${r}">${l}</span>${r === 'notifications' ? '<b class="badge" id="nbadge"></b>' : ''}</a>`).join('')}</nav>
      <div class="side-foot">IGO Group of Companies<br>Digital Marketing</div></aside>
    <div class="main"><header class="topbar"><button class="icon-btn" id="menu" aria-label="Toggle menu">☰</button><div class="tb-title"><b>MAHI</b> <span class="muted">· One Vision. One Workflow. One Digital Companion.</span></div>
      <div class="tb-actions"><button class="save-state" id="save-state" title="Saving &amp; sync">● saved</button><button class="icon-btn" id="t-focus" title="Personal focus mode">🎯</button><button class="icon-btn" id="t-theme" title="Light / dark mode">🌓</button><button class="icon-btn" id="t-full" title="Full screen">⛶</button><button class="icon-btn" id="t-mahi" title="Show / hide MAHI">🤖</button><a class="icon-btn" href="#/notifications" title="Notifications">🔔<b class="badge" id="nbadge2"></b></a><button class="icon-btn" id="t-logout" title="Sign out">⎋</button></div></header>
      <main id="page" tabindex="-1"></main></div>
    <div id="scrim"></div><aside id="drawer" aria-label="Asset editor"></aside><div id="toasts" aria-live="polite"></div>
    <div id="mahi-dock" class="mahi-dock"><div class="md-bar"><span class="md-name">MAHI</span><span class="md-status" id="md-status"></span><button class="icon-btn" data-m="pause" title="Pause / resume animations">⏸</button><button class="icon-btn" data-m="sound" title="Sound on / off">🔇</button><button class="icon-btn" data-m="min" title="Minimize">▁</button><button class="icon-btn" data-m="hide" title="Hide MAHI">✕</button></div><div class="md-body" id="mahi"></div></div>`;
  }

  // ---------- render ----------
  let renderTimer = null;
  app.render = () => {
    const r = UI.parseHash(); UI.route = r;
    const pg = P[r.name] ? r.name : 'home';
    const el = document.getElementById('page');
    const ae = document.activeElement; const aid = ae && el.contains(ae) ? ae.id : null; const sel = aid && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null;
    const scroll = el.scrollTop;
    try { P[pg](el, r.params || {}); } catch (e) { console.error(e); el.innerHTML = `<div class="card"><h3>Something went wrong on this page</h3><pre>${esc(e.stack || e.message)}</pre></div>`; }
    if (aid) { const n = document.getElementById(aid); if (n) { n.focus(); if (sel && n.setSelectionRange) try { n.setSelectionRange(sel[0], sel[1]); } catch (e) { /* ignore */ } } }
    if (app._lastPage === pg) el.scrollTop = scroll; else el.scrollTop = 0;
    app._lastPage = pg;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === pg));
    chrome();
  };
  const scheduleRender = () => { clearTimeout(renderTimer); renderTimer = setTimeout(app.render, 60); };

  function chrome() {
    const st = S.state, s = st.settings;
    document.documentElement.dataset.theme = s.theme;
    document.body.classList.toggle('reduced', !!s.reducedMotion);
    document.body.classList.toggle('mahi-paused', !!s.mahiPaused);
    const unread = st.notifications.filter((n) => !n.read).length;
    ['nbadge', 'nbadge2'].forEach((id) => { const b = document.getElementById(id); if (b) { b.textContent = unread > 99 ? '99+' : unread || ''; b.hidden = !unread; } });
    S.state.settings.vjs.forEach((v, i) => { const l = document.querySelector(`[data-label="vj${i + 1}"]`); if (l) l.textContent = v.name === v.id ? `${v.id} Tracker` : `${v.id} · ${v.name}`; });
    document.getElementById('logo-slot').innerHTML = s.logo ? `<img src="${esc(s.logo)}" alt="IGO logo">` : '<div class="logo-leaf">🌿</div>';
    const dock = document.getElementById('mahi-dock');
    dock.classList.toggle('hidden', !s.mahiVisible); dock.classList.toggle('min', !!s.mahiMinimized);
    dock.querySelector('[data-m="sound"]').textContent = s.sound ? '🔊' : '🔇';
    dock.querySelector('[data-m="pause"]').textContent = s.mahiPaused ? '▶' : '⏸';
    // festival mode
    let mode = s.festivalMode;
    if (mode === 'auto') { const c = S.currentSet(); mode = c ? { 'Christmas': 'christmas', 'New Year': 'newyear', 'Pongal': 'pongal' }[c.festival] : 'default'; }
    if (app._fest !== mode) { app._fest = mode; M.setFestival(mode); }
  }

  // ---------- greetings & summaries ----------
  app.summary = () => {
    const m = S.metrics();
    const cur = m.current;
    return `${m.done}/${m.total} done (${UI.pct(m.pct)}) · ${m.todayPending.length} open today${cur ? ` · ${cur.label} due ${UI.fmt(cur.end)}` : ''}${m.overdue.length ? ` · ${m.overdue.length} overdue` : ''}`;
  };
  app.dailySummary = (force) => {
    const m = S.metrics(), name = S.state.settings.callName;
    const planned = m.todayActive.length + m.customToday.length;
    M.react({ kind: 'info', priority: 2, msg: `${name}, here's your day:`, detail: `${planned} planned (${m.todayActive.length} production · ${m.customToday.length} personal), ${m.todayCompleted.length + m.customTodayDone.length} completed, ${m.dueSoon.length} due soon, ${m.overdue.length} overdue.${m.current ? ` Current: ${m.current.label} ${m.current.festival}.` : ''}` });
  };
  function welcome() {
    const st = S.state, name = st.settings.callName;
    if (!st.welcomed) {
      st.welcomed = true; S.save();
      M.react({ kind: 'welcome', priority: 3, msg: `Hello, ${name}! I'm MAHI, your personal workflow companion. Your festival production plan is ready. Let's achieve your goals together!`, detail: `${st.assets.length} deliverables · 15 brands · 7 sets · ${S.metrics().done} completed` });
      return;
    }
    const h = new Date().getHours();
    const msg = h < 12 ? `Good morning, ${name}! Ready for a productive day?` : h < 17 ? `Good afternoon, ${name}! Let's check your production progress.` : `Good evening, ${name}! Let's review what you've accomplished today.`;
    M.react({ kind: 'welcome', priority: 3, msg, detail: app.summary() });
  }

  // ---------- events ----------
  function bind() {
    document.addEventListener('click', (e) => {
      const ed = e.target.closest('[data-edit]');
      if (ed && !e.target.closest('.kcard.dragging')) { e.preventDefault(); UI.openEditor(ed.dataset.edit); return; }
      const r = e.target.closest('[data-route],[data-click]');
      if (r && !e.target.closest('select,input,button:not([data-route])') ) { UI.go(r.dataset.route || r.dataset.click); return; }
      if (e.target.closest('button[data-route]')) UI.go(e.target.closest('button[data-route]').dataset.route);
    });
    document.getElementById('scrim').onclick = UI.closeDrawer;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.closeDrawer(); });
    document.getElementById('menu').onclick = () => document.body.classList.toggle('nav-open');
    document.querySelectorAll('[data-nav]').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('nav-open')));
    document.getElementById('t-theme').onclick = () => S.setSettings({ theme: S.state.settings.theme === 'dark' ? 'light' : 'dark' });
    document.getElementById('t-full').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => UI.toast('Full screen not available here')); };
    document.getElementById('t-focus').onclick = () => { const on = !document.body.classList.contains('focus-mode'); document.body.classList.toggle('focus-mode', on); if (on) { UI.go('myday'); UI.toast('Personal focus mode: sidebar and decorations hidden'); } };
    document.getElementById('t-mahi').onclick = () => S.setSettings({ mahiVisible: !S.state.settings.mahiVisible, mahiMinimized: false });
    document.querySelector('#mahi-dock .md-bar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]'); const s = S.state.settings;
      if (!b) { if (s.mahiMinimized) S.setSettings({ mahiMinimized: false }); return; }
      if (b.dataset.m === 'hide') { S.setSettings({ mahiVisible: false }); UI.toast('MAHI hidden – use 🤖 in the top bar to bring her back'); }
      if (b.dataset.m === 'min') S.setSettings({ mahiMinimized: !s.mahiMinimized });
      if (b.dataset.m === 'pause') S.setSettings({ mahiPaused: !s.mahiPaused });
      if (b.dataset.m === 'sound') { S.setSettings({ sound: !s.sound }); if (!s.sound) UI.sound('chime'); }
    });
    window.addEventListener('hashchange', app.render);
    // inactivity / return detection
    let hiddenAt = 0;
    const ping = () => { const idle = M.activityPing(); if (idle > 10 * 60 * 1000 && !M.isSleeping()) { /* handled by wake */ } };
    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((ev) => document.addEventListener(ev, ping, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 10 * 60 * 1000) { M.react({ kind: 'welcome', priority: 3, msg: `Welcome back, ${S.state.settings.callName}! Shall we continue where we left off?`, detail: app.summary() }); S.deadlineScan(); }
    });
    S.on('change', scheduleRender);
    S.on('reactions', (list) => M.react(list));
    const paintSync = () => {
      const e = document.getElementById('save-state'); if (!e) return;
      const sy = root.MAHI_SYNC || { status: 'local', detail: 'Saved in this browser' };
      const map = { local: ['● saved locally', ''], connecting: ['☁ connecting…', 'busy'], syncing: ['☁ syncing…', 'busy'], synced: ['☁ synced', 'cloud'], error: ['⚠ not synced', 'bad'] };
      const [txt, cls] = map[sy.status] || map.local;
      e.textContent = txt; e.className = 'save-state ' + cls; e.title = sy.detail + (sy.lastSync ? ` · last sync ${new Date(sy.lastSync).toLocaleTimeString()}` : '');
    };
    S.on('saved', paintSync);
    if (root.MAHI_SYNC) root.MAHI_SYNC.onStatus(paintSync);
    document.getElementById('save-state').onclick = () => { const sy = root.MAHI_SYNC; UI.modal('Saving & sync', `<p><b>${esc(sy ? sy.detail : 'Saved in this browser')}</b></p><p class="muted">${sy && sy.status !== 'local' ? 'Your work is saved to your private MAHI cloud account (secured database, readable only by you after sign-in) and appears on every device where you sign in. A copy is also kept in this browser so MAHI opens instantly and keeps working if the connection drops; it syncs again automatically.' : 'Every change is saved automatically in this browser on this device – no login, no account. Use Excel Import and Export → Download backup regularly, and Restore backup to move your work to another device or browser.'}</p>`, sy && sy.status !== 'local' ? [{ label: 'Sync now', value: true }, { label: 'Close', value: null }] : [{ label: 'Close', value: null }]).then((v) => { if (v) sy.pushNow(); }); };
    S.on('storage-error', () => { const e = document.getElementById('save-state'); if (e) { e.textContent = '● not saved'; e.className = 'save-state bad'; } UI.toast('Browser storage is full or blocked – export a backup!', 'bad'); });
  }

  app.boot = (opts) => {
    app.opts = opts || {};
    S.load();
    shell();
    M.mount(document.getElementById('mahi'), {
      reduced: () => !!S.state.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches,
      paused: () => !!S.state.settings.mahiPaused, decor: () => !!S.state.settings.decor,
      name: () => S.state.settings.callName, summary: app.summary, fx: UI.fx, sound: UI.sound,
      onAction: (a) => UI.go(a.route), onBanner: (r) => UI.banner(r.msg, r.detail), onCertificate: () => setTimeout(UI.certificate, 2500),
      onSay: (msg) => { const s = document.getElementById('md-status'); if (s) s.textContent = ''; },
    });
    bind();
    if (!location.hash) location.hash = '#/home';
    app.render();
    if (root.MAHI_SYNC && app.opts.syncAdapter) root.MAHI_SYNC.start(app.opts.syncAdapter);
    const lo = document.getElementById('t-logout');
    if (lo) { if (app.opts.onLogout) { lo.title = 'Sign out' + (app.opts.userEmail ? ' (' + app.opts.userEmail + ')' : ''); lo.onclick = async () => { if (await UI.confirm('Sign out', 'Sign out of MAHI on this device? Your work stays saved in your account.', 'Sign out')) { if (root.MAHI_SYNC && root.MAHI_SYNC.pushNow) { try { await root.MAHI_SYNC.pushNow(); } catch (e) { /* ignore */ } } app.opts.onLogout(); } }; } else lo.remove(); }
    setTimeout(welcome, 1500);
    setTimeout(() => S.deadlineScan(), 7000);
    setInterval(() => S.deadlineScan(), 60 * 1000);
  };

  root.MAHI_APP = app;
  // Booted by the React shell after sign-in (src/components/MahiApp.jsx).
})(window);

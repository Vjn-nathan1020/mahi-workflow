/* MAHI – application boot, shell, router and MAHI companion wiring. */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA, S = root.MAHI_STORE, UI = root.MAHI_UI, P = root.MAHI_PAGES, M = root.MAHI_CHAR;
  const esc = UI.esc;
  const NAV_GROUPS = [["Workspace",[["home","Overview"],["myday","My Day"],["calendar","Calendar"],["board","Kanban"],["flow","Workflow chart"],["annual","Annual plan"]]],["Production",[["sets","Production sets"],["posters","Posters"],["ai","AI videos"],["vj1","VJ 01 Tracker"],["vj2","VJ 02 Tracker"],["vj3","VJ 03 Tracker"]]],["Marketing",[["campaigns","Campaigns"],["brands","Brands"]]],["Intelligence",[["reports","Reports"],["achievements","Achievements"],["notifications","Notifications"]]],["System",[["notes","Notes"],["timer","Focus timer"],["excel","Import and export"],["settings","Settings"]]]];
  const NAV_ICON = {"home":"M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z","myday":"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4","board":"M4 4h5v16H4zM10.5 4h5v11h-5zM17 4h3v7h-3z","flow":"M5 5h5v5H5zM14 14h5v5h-5zM7.5 10v4a3 3 0 0 0 3 3h3.5","calendar":"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4","annual":"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2","sets":"M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10","campaigns":"M5 21V4h12l-2.5 4L17 12H5","brands":"M3 12V4h8l9 9-8 8zM7.5 7.5h.01","posters":"M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 8.5h.01","ai":"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.7 1.8L20.5 18.5l-1.8.7L18 21l-.7-1.8-1.8-.7 1.8-.7z","vj":"M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5","timer":"M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2.5M9 2h6","achievements":"M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4v4h-4z","notes":"M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7","notifications":"M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4","reports":"M4 20V11M10 20V5M16 20v-8M3 20h18","excel":"M12 3v12M7 10l5 5 5-5M4 21h16","settings":"M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4"};
  const icon = (r) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${NAV_ICON[r] || NAV_ICON[r.replace(/\d$/, '')] || ''}"/></svg>`;
  const NAV = NAV_GROUPS.flatMap(([, items]) => items.map(([r, l]) => [r, l]));
  const app = {};

  function shell() {
    document.getElementById('app').innerHTML = `
    <aside class="sidebar" id="sidebar"><div class="brand"><div class="logo-slot" id="logo-slot"></div><div><div class="b-name">MAHI</div><div class="b-sub">Personal Workflow AI Assistant · VJ.Nathan</div></div></div>
      <nav aria-label="Main">${NAV_GROUPS.map(([g, items]) => `<div class="nav-group">${g}</div>` + items.map(([r, l]) => `<a href="#/${r}" data-nav="${r}"><span class="ni">${icon(r)}</span><span class="nl" data-label="${r}">${l}</span>${r === 'notifications' ? '<b class="badge" id="nbadge"></b>' : ''}</a>`).join('')).join('')}</nav>
      <div class="side-foot">IGO Group of Companies<br>Digital Marketing</div></aside>
    <div class="main"><header class="topbar"><button class="icon-btn" id="menu" aria-label="Toggle menu">☰</button><div class="tb-title"><b id="tb-page">Overview</b><span class="season-mark" id="season-mark" title=""><svg viewBox="0 0 24 24"><path d="M12 3l3 5h-2l3 5h-2l3 5H7l3-5H8l3-5H9zM12 18v3"/></svg></span><span class="tb-date" id="tb-date"></span></div>
      <div class="tb-actions"><button class="save-state" id="save-state" title="Saving &amp; sync">● saved</button><button class="icon-btn" id="t-focus" title="Personal focus mode" aria-label="Focus mode"><svg class="tb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01"/></svg></button><button class="icon-btn" id="t-theme" title="Light / dark mode" aria-label="Light or dark mode"><svg class="tb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg></button><button class="icon-btn" id="t-full" title="Full screen" aria-label="Full screen"><svg class="tb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg></button><button class="icon-btn" id="t-mahi" title="Show / hide MAHI" aria-label="Show or hide MAHI"><svg class="tb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a7 6.5 0 1 0 0 13 7 6.5 0 0 0 0-13zM9 10.5h.01M15 10.5h.01M8 20h8"/></svg></button><a class="icon-btn" href="#/notifications" title="Notifications" aria-label="Notifications"><svg class="tb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/></svg><b class="badge" id="nbadge2"></b></a><button class="icon-btn" id="t-logout" title="Sign out" aria-label="Sign out"><svg class="tb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg></button></div></header>
      <main id="page" tabindex="-1"></main></div>
    <div id="scrim"></div><aside id="drawer" aria-label="Asset editor"></aside><div id="toasts" aria-live="polite"></div>
    <div id="mahi-dock" class="mahi-dock"><div class="md-bar"><span class="md-name">MAHI</span><span class="md-status" id="md-status"></span><button class="icon-btn" data-m="pause" title="Pause / resume animations">⏸</button><button class="icon-btn" data-m="chat" title="Chat with MAHI" aria-label="Chat with MAHI">💬</button><button class="icon-btn" data-m="voice" title="Voice replies on / off" aria-label="Voice replies on or off">🗣</button><button class="icon-btn" data-m="sound" title="Sound on / off">🔇</button><button class="icon-btn" data-m="min" title="Minimize">▁</button><button class="icon-btn" data-m="hide" title="Hide MAHI">✕</button></div><div class="md-body" id="mahi"></div>
      <section class="md-chat" id="md-chat" hidden aria-label="Chat with MAHI"><div class="mc-log" id="mc-log" role="log" aria-live="polite"></div>
        <div class="mc-chips"><button type="button" data-ask="How am I doing?">Progress</button><button type="button" data-ask="What should I do next?">Next</button><button type="button" data-ask="Today report">Today</button><button type="button" data-ask="Weekly report">Week</button><button type="button" data-ask="What is overdue?">Overdue</button></div>
        <form class="mc-form" id="mc-form" autocomplete="off"><input id="mc-input" aria-label="Message MAHI" placeholder='Ask, or say "I completed 5 posters"' maxlength="500"><button class="btn small">Send</button></form></section></div>`;
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
    // Light / dark / system + the festival theme. Visual only: records, dates and targets are never touched.
    const dark = s.theme === 'dark' || (s.theme === 'system' && root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
    const season = D.seasonFor(s, D.localISO());
    document.documentElement.dataset.theme = dark ? 'dark' : (season || 'light');
    if (season) document.documentElement.dataset.season = season; else delete document.documentElement.dataset.season;
    document.body.classList.toggle('no-decor', s.decor === false);
    const sm = document.getElementById('season-mark'); if (sm) sm.title = season ? D.SEASON_NAMES[season] + ' theme' : '';
    const nl = document.querySelector('.sidebar nav a.on .nl'); const tp = document.getElementById('tb-page'); if (tp) tp.textContent = nl ? nl.textContent : 'Overview';
    const td = document.getElementById('tb-date'); if (td) td.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) + ' · IST';
    document.body.classList.toggle('reduced', !!s.reducedMotion);
    document.body.classList.toggle('mahi-paused', !!s.mahiPaused);
    const unread = st.notifications.filter((n) => !n.read).length;
    ['nbadge', 'nbadge2'].forEach((id) => { const b = document.getElementById(id); if (b) { b.textContent = unread > 99 ? '99+' : unread || ''; b.hidden = !unread; } });
    S.state.settings.vjs.forEach((v, i) => { const l = document.querySelector(`[data-label="vj${i + 1}"]`); if (l) l.textContent = v.name === v.id ? `${v.id} Tracker` : `${v.id} · ${v.name}`; });
    document.getElementById('logo-slot').innerHTML = s.logo ? `<img src="${esc(s.logo)}" alt="IGO logo">` : '<div class="logo-leaf" aria-hidden="true"></div>';
    const dock = document.getElementById('mahi-dock');
    dock.classList.toggle('hidden', !s.mahiVisible); dock.classList.toggle('min', !!s.mahiMinimized);
    dock.querySelector('[data-m="sound"]').textContent = s.sound ? '🔊' : '🔇';
    dock.querySelector('[data-m="voice"]').classList.toggle('on', !!s.voice); dock.querySelector('[data-m="voice"]').setAttribute('aria-pressed', String(!!s.voice));
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
    const p = S.performance();
    const carried = m.customToday.filter((x) => x.carriedFrom && x.status !== 'Completed').length;
    M.react({ kind: 'info', priority: 2, msg: `${name}, here's your day:`, detail: `${planned} planned (${m.todayActive.length} production · ${m.customToday.length} personal${carried ? `, ${carried} carried forward` : ''}), ${p.day.total} completed today, ${p.week.total} this week, ${p.all.total} in total · ${m.dueSoon.length} due soon, ${m.overdue.length} overdue.${m.current ? ` Current: ${m.current.label} ${m.current.festival}.` : ''}` });
  };
  function welcome() {
    const st = S.state, name = st.settings.callName;
    if (!st.welcomed) {
      st.welcomed = true; S.save();
      M.react({ kind: 'welcome', priority: 3, msg: `Hello, ${name}! I'm MAHI, your personal workflow companion. Your festival production plan is ready. Let's achieve your goals together!`, detail: `${st.assets.length} deliverables · ${D.BRANDS.length} brands · ${D.SETS.length} sets · ${S.metrics().done} completed` });
      return;
    }
    const t = S.today(), last = st.lastVisit || '';
    st.lastVisit = t; S.save();
    const p = S.performance();
    const carried = st.customTasks.filter((x) => x.status !== 'Completed' && x.carriedFrom && x.date === t);
    const unlocked = D.ACHIEVEMENTS.filter((a) => st.achievements[a.key]);
    if (last && last < t) {
      // First visit of a new IST day: welcome back, show what is kept and what is waiting.
      M.react({ kind: 'welcomeBack', priority: 3, msg: `Welcome back, ${name}! Everything you did is saved.`,
        detail: `${last === D.addDays(t, -1) ? 'Yesterday' : 'Last visit'}: ${S.performance(last).day.total} completed · this week ${p.week.total} · all time ${p.all.total} · ${unlocked.length} achievement(s)${carried.length ? ` · ${carried.length} unfinished task(s) carried to today` : ''}. Today so far: ${p.day.total}.` });
      if (carried.length) M.react({ kind: 'clipboard', priority: 2, msg: `${name}, these were not finished yet:`, detail: carried.slice(0, 4).map((x) => x.title).join(' · '), action: { label: 'Open My Day', route: 'myday' } });
      return;
    }
    const h = D.istHM()[0];
    const msg = h < 12 ? `Good morning, ${name}! Ready for a productive day?` : h < 17 ? `Good afternoon, ${name}! Let's check your production progress.` : `Good evening, ${name}! Let's review what you've accomplished today.`;
    M.react({ kind: 'welcome', priority: 3, msg, detail: app.summary() });
  }

  // ---------- Report results: celebrate only after the save is verified ----------
  app.reportResult = async (res, chatLine) => {
    const name = S.state.settings.callName, R = root.MAHI_REPORT;
    const n = res.rec.deliverables.length + res.rec.tasks.length;
    if (!res.ok) {
      const retry = () => { const v = R.retry(res.rec); app.reportResult(Object.assign({}, res, v), chatLine); };
      M.react({ kind: 'saveFailed', priority: 9, immediate: true, force: true, msg: `${name}, I couldn't confirm your work was saved.`, detail: `${res.reason}. Your changes are still on screen – nothing is lost yet.`, action: { label: 'Retry save', run: retry } });
      UI.toast('Not saved yet: ' + res.reason, 'bad');
      if (chatLine) chatLine({ emotion: 'concerned', text: `I couldn't confirm the save: ${res.reason}.`, retry });
      return false;
    }
    const cloud = await R.cloudConfirm();
    const p = S.performance();
    const where = cloud === 'synced' ? 'Saved to your cloud account and this browser' : cloud === 'pending' ? 'Saved in this browser – the cloud copy will sync when the connection returns' : 'Saved in this browser';
    const types = {}; res.rec.deliverables.forEach((id) => { const a = S.asset(id); types[a.type] = (types[a.type] || 0) + 1; });
    const noun = { Poster: 'poster', 'AI Video': 'AI video', 'VJ Video': 'VJ video' };
    const what = Object.keys(types).map((k) => `${types[k]} ${noun[k] || k}${types[k] > 1 ? 's' : ''}`).concat(res.rec.tasks.length ? [`${res.rec.tasks.length} other task(s)`] : []).join(', ');
    M.react({ kind: n >= 5 ? 'celebrating' : 'saved', priority: 9, immediate: true, force: true, confetti: n >= 5 ? 70 : 30,
      msg: `Wonderful work, ${name}! ${what} completed.`, detail: `${where} ✓ · today ${p.day.total} · this week ${p.week.total} · all time ${p.all.total}` });
    M.react(res.reactions.filter((r) => ['achievement', 'brand', 'set100', 'grand', 'milestone25', 'milestone50', 'milestone75', 'daily'].includes(r.kind)));
    UI.toast(`${where}: ${what}`, 'ok');
    if (chatLine) chatLine({ emotion: 'celebrating', text: `Saved ✓ ${what} marked completed today.`, lines: [where, `Today ${p.day.total} · this week ${p.week.total} · all time ${p.all.total}`] });
    return true;
  };

  // ---------- Chat panel in the MAHI dock ----------
  const chat = { open: false, pending: null };
  function chatLine(reply, who) {
    const log = document.getElementById('mc-log'); if (!log) return;
    const div = document.createElement('div');
    div.className = 'mc-msg ' + (who === 'me' ? 'me' : 'mahi');
    if (who === 'me') div.textContent = reply;
    else {
      div.innerHTML = `<div>${esc(reply.text)}</div>${reply.detail ? `<div class="muted small">${esc(reply.detail)}</div>` : ''}${reply.lines && reply.lines.length ? `<ul class="small">${reply.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`;
      if (reply.confirm) {
        const pl = reply.confirm;
        div.insertAdjacentHTML('beforeend', `${pl.warnings.map((w) => `<div class="alert warn small">${esc(w)}</div>`).join('')}<div class="mc-confirm">${pl.items.map((it) => `<div class="small"><b>${esc(it.label)}</b>${it.picked.map((id) => { const a = S.asset(id); return `<label class="mr-item"><input type="checkbox" data-mc-id="${id}" checked> ${esc(id)} <span class="muted">· due ${UI.fmt(a.deadline)}</span></label>`; }).join('')}</div>`).join('')}${pl.tasks.length ? `<div class="small"><b>Other work (${pl.tasks.length})</b>${pl.tasks.map((x) => `<div class="mr-item">✔ ${esc(x.title)}</div>`).join('')}</div>` : ''}
          <div class="row-gap"><button type="button" class="btn small" data-mc-save>Save as completed</button><button type="button" class="btn ghost small" data-mc-cancel>Cancel</button></div></div>`);
        div.querySelector('[data-mc-save]').onclick = () => {
          const chosen = [...div.querySelectorAll('[data-mc-id]')].filter((c) => c.checked).map((c) => c.dataset.mcId);
          div.querySelectorAll('button,input').forEach((b) => { b.disabled = true; });
          M.hold('working');
          setTimeout(() => app.reportResult(root.MAHI_REPORT.apply(pl, chosen), (r) => chatLine(r)), 350);
        };
        div.querySelector('[data-mc-cancel]').onclick = () => { div.querySelectorAll('button,input').forEach((b) => { b.disabled = true; }); chatLine({ text: 'Cancelled – nothing was changed.' }); M.rest(); };
      }
      if (reply.retry) { div.insertAdjacentHTML('beforeend', '<button type="button" class="btn small" data-mc-retry>Retry save</button>'); div.querySelector('[data-mc-retry]').onclick = reply.retry; }
    }
    log.appendChild(div); log.scrollTop = log.scrollHeight;
  }
  function ask(text) {
    if (!text) return;
    chatLine(text, 'me');
    M.hold('thinking');
    setTimeout(() => {
      const r = root.MAHI_CHAT.answer(text);
      chatLine(r);
      if (!r.confirm) M.react({ kind: r.emotion, priority: 8, immediate: true, force: true, quiet: true, msg: r.text, duration: 3500 });
      else M.react({ kind: 'clipboard', priority: 8, immediate: true, force: true, quiet: true, msg: r.text, duration: 6000 });
      if (S.state.settings.voice) M.speak(r.text);
    }, 450);
  }
  app.toggleChat = (force) => {
    const dock = document.getElementById('mahi-dock'), panel = document.getElementById('md-chat');
    chat.open = force != null ? force : !chat.open;
    if (chat.open && S.state.settings.mahiMinimized) S.setSettings({ mahiMinimized: false });
    panel.hidden = !chat.open; dock.classList.toggle('chat-open', chat.open);
    if (chat.open) {
      if (!document.getElementById('mc-log').children.length) chatLine({ text: `Hi ${S.state.settings.callName}! Tell me what you finished, or ask about your progress.`, lines: root.MAHI_CHAT.suggestions(2) });
      setTimeout(() => document.getElementById('mc-input').focus(), 50);
    }
  };
  function bindChat() {
    document.getElementById('mc-form').onsubmit = (e) => { e.preventDefault(); const i = document.getElementById('mc-input'); const v = i.value.trim(); i.value = ''; ask(v); };
    document.querySelector('.mc-chips').onclick = (e) => { const b = e.target.closest('[data-ask]'); if (b) ask(b.dataset.ask); };
    document.getElementById('md-chat').addEventListener('keydown', (e) => { if (e.key === 'Escape') app.toggleChat(false); });
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
    document.getElementById('t-theme').onclick = () => { const dark = document.documentElement.dataset.theme === 'dark'; S.setSettings({ theme: dark ? 'light' : 'dark' }); };
    if (root.matchMedia) root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.state.settings.theme === 'system') chrome(); });
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
      if (b.dataset.m === 'chat') app.toggleChat();
      if (b.dataset.m === 'voice') { S.setSettings({ voice: !s.voice }); UI.toast(s.voice ? 'MAHI voice replies off' : 'MAHI voice replies on'); if (s.voice && root.speechSynthesis) root.speechSynthesis.cancel(); }
    });
    window.addEventListener('hashchange', () => { UI.closeDrawer(); app.render(); });
    bindChat();
    // Save battery: pause every MAHI animation while the tab is in the background.
    document.addEventListener('visibilitychange', () => document.body.classList.toggle('page-hidden', document.hidden));
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
      const map = { local: ['● saved locally', ''], connecting: ['☁ connecting…', 'busy'], syncing: ['☁ synchronising…', 'busy'], synced: ['☁ cloud synced', 'cloud'], error: ['⚠ sync failed – retrying', 'bad'],
        waiting: ['● saved on this device · waiting for cloud', 'busy'], offline: ['⚠ offline – saved on this device', 'bad'], conflict: ['⚠ conflict – choose a version', 'bad'], auth: ['⚠ sign in again to sync', 'bad'] };
      let [txt, cls] = map[sy.status] || map.local;
      if (sy.status === 'synced' && sy.lastSync) txt = '☁ cloud synced ' + new Date(sy.lastSync).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      const at = S.lastSavedAt ? new Date(S.lastSavedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';
      if (sy.status === 'local' && at) txt = '● saved ' + at;
      if (!S.storageOk) { txt = '● not saved'; cls = 'bad'; }
      e.textContent = txt; e.className = 'save-state ' + cls;
      e.title = (S.storageOk ? sy.detail : 'Browser storage is full or blocked') + (at ? ` · saved in this browser at ${at} IST` : '') + (sy.lastSync ? ` · last cloud sync ${new Date(sy.lastSync).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST` : '');
    };
    S.on('saved', paintSync);
    S.on('saving', () => { const e = document.getElementById('save-state'); if (e && S.storageOk) { e.textContent = '● saving…'; e.className = 'save-state busy'; } });
    if (root.MAHI_SYNC) root.MAHI_SYNC.onStatus(paintSync);
    document.getElementById('save-state').onclick = () => { const sy = root.MAHI_SYNC;
      if (sy && sy.status === 'conflict' && sy.conflicts) return app.resolveConflicts(); UI.modal('Saving & sync', `<p><b>${esc(sy ? sy.detail : 'Saved in this browser')}</b></p><p class="muted">${sy && sy.status !== 'local' ? 'Your work is saved to your private MAHI cloud account (secured database, readable only by you after sign-in) and appears on every device where you sign in. A copy is also kept in this browser so MAHI opens instantly and keeps working if the connection drops; it syncs again automatically.' : 'Every change is saved automatically in this browser on this device – no login, no account. Use Excel Import and Export → Download backup regularly, and Restore backup to move your work to another device or browser.'}</p>`, sy && sy.status !== 'local' ? [{ label: 'Sync now', value: true }, { label: 'Close', value: null }] : [{ label: 'Close', value: null }]).then((v) => { if (v) sy.pushNow(); }); };
    S.on('storage-error', () => { const e = document.getElementById('save-state'); if (e) { e.textContent = '● not saved'; e.className = 'save-state bad'; } UI.toast('Browser storage is full or blocked – export a backup!', 'bad'); });
  }

  // ---- cloud conflicts: a record changed on two devices – the user chooses, nothing is overwritten silently ----
  app.resolveConflicts = async () => {
    const sy = root.MAHI_SYNC; const list = (sy && sy.conflicts) ? sy.conflicts() : [];
    for (const c of list) {
      const r = c.server_row || {};
      const label = c.table === 'deliverables' ? c.id : c.table === 'tasks' ? 'Task: ' + (r.title || c.id) : c.table === 'notes' ? 'Note: ' + (r.title || c.id) : c.table + ' ' + c.id;
      const when = r.updated_at ? new Date(r.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : 'unknown time';
      const v = await UI.modal('Changed on two devices', `<p><b>${esc(label)}</b> was changed on this device and on another device (${esc(r.updated_by || 'unknown device')}, ${esc(when)}).</p><p class="small">Other device's status: <b>${esc(r.status || r.title || '—')}</b></p><p class="muted small">Choose which version to keep. The other version stays in the cloud history.</p>`,
        [{ label: 'Keep this device’s version', value: 'mine' }, { label: 'Use the other device’s version', value: 'theirs' }, { label: 'Decide later', value: null }]);
      if (!v) break;
      sy.resolve(c.key, v);
    }
    app.render();
  };

  // ---- 5-set plan update: preview, archive download, confirm ----
  let upgradeOpen = false;
  app.planUpgrade = async () => {
    const p = S.pendingUpgrade; if (!p || upgradeOpen) return; upgradeOpen = true;
    const r = p.report;
    const row = (k, v, note) => `<tr><td>${k}</td><td style="text-align:right"><b>${v}</b></td><td class="muted small">${note || ''}</td></tr>`;
    const body = `<p>Your saved work is from the <b>7-set plan</b>. The plan now has <b>${D.SETS.length} sets</b> (Christmas Set 03 and Set 04 removed, later sets renumbered). Nothing has been changed or saved yet.</p>
      <table class="tbl" style="margin:8px 0"><tbody>
      ${row('Original records', r.original, r.originalWithWork + ' with work')}
      ${row('Moved into the new plan', r.migrated, r.migratedWithWork + ' with work')}
      ${row('Completed work kept', r.completedRetained, 'Approved or Completed')}
      ${row('In-progress work kept', r.inProgressRetained)}
      ${row('Active deliverables after update', r.activeAfter, r.newEmpty ? r.newEmpty + ' new, not started' : '')}
      ${row('Archived (removed sets) with work', r.archivedWithWork, r.archivedCompleted + ' completed; kept in the archive list')}
      ${row('Removed-set records with no work', r.archivedEmpty, 'not carried over')}
      ${row('Duplicates', r.duplicates)}
      ${row('Quarantined', r.quarantined, 'kept for review')}
      ${row('Unresolved', r.unresolved)}
      </tbody></table>
      <p class="small">${r.archiveFailed ? '<b style="color:var(--bad)">The archive copy could not be written to this browser. Download the old data before applying.</b>' : 'A full copy of your old data is archived in this browser. You can restore it later from Settings.'}</p>`;
    const v = await UI.modal('Plan update: preview', body, [{ label: 'Apply update', value: 'apply' }, { label: 'Download old data', value: 'dl' }, { label: 'Not now', value: null }], { wide: true });
    upgradeOpen = false;
    if (v === 'dl') { const raw = S.planArchiveRaw(p.archiveKey) || JSON.stringify(S.state); await UI.download(new Blob([raw], { type: 'application/json' }), 'MAHI_backup_before_5_set_update.json'); return app.planUpgrade(); }
    if (v === 'apply') {
      const res = S.applyUpgrade();
      if (res.ok) { UI.toast('Plan updated and saved (checked)'); const e = document.getElementById('save-state'); if (e) e.onclick = null; if (root.MAHI_SYNC && app.opts.syncAdapter) root.MAHI_SYNC.start(app.opts.syncAdapter); app.render(); }
      else UI.modal('Update not saved', `<p>The update could not be saved: ${esc(res.reason || 'unknown error')}. Your old data is unchanged.</p>`);
      return;
    }
    UI.toast('Plan update postponed. Changes are not saved until you apply it.', 'bad');
  };

  // ---- Dock manners: MAHI folds to a compact bar when quiet so she never sits on top of content for long;
  // she opens again for every reaction, when pointed at, or when her chat is open. Not saved: a visual state only.
  let dockTimer = 0;
  function dockWake() {
    const dk = document.getElementById('mahi-dock'); if (!dk) return;
    dk.classList.remove('compact'); clearTimeout(dockTimer);
    dockTimer = setTimeout(() => { if (!dk.matches(':hover') && !dk.classList.contains('chat-open')) dk.classList.add('compact'); }, 20000);
  }
  app.dockWake = dockWake;

  app.boot = (opts) => {
    app.opts = opts || {};
    S.load();
    // Phones: MAHI starts minimised on every visit so she never covers cards or forms (one tap expands her).
    if (root.innerWidth < 720) S.state.settings.mahiMinimized = true;
    shell();
    M.mount(document.getElementById('mahi'), {
      reduced: () => !!S.state.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches,
      paused: () => !!S.state.settings.mahiPaused, decor: () => !!S.state.settings.decor,
      name: () => S.state.settings.callName, summary: app.summary, fx: UI.fx, sound: UI.sound,
      onAction: (a) => (a.run ? a.run() : UI.go(a.route)), onClick: () => app.toggleChat(), voice: () => !!S.state.settings.voice, onBanner: (r) => UI.banner(r.msg, r.detail), onCertificate: () => setTimeout(UI.certificate, 2500),
      onSay: (msg) => { const s = document.getElementById('md-status'); if (s) s.textContent = ''; dockWake(); },
    });
    bind();
    { const dk = document.getElementById('mahi-dock'); if (dk) { dk.addEventListener('mouseenter', dockWake); dk.addEventListener('focusin', dockWake); dk.addEventListener('mouseleave', () => { clearTimeout(dockTimer); dockTimer = setTimeout(() => { if (!dk.classList.contains('chat-open')) dk.classList.add('compact'); }, 6000); }); dockWake(); } }
    if (!location.hash) location.hash = '#/home';
    app.render();
    if (root.MAHI_SYNC && app.opts.syncAdapter && !S.pendingUpgrade) root.MAHI_SYNC.start(app.opts.syncAdapter);
    S.on('upgrade-pending', () => setTimeout(app.planUpgrade, 50));
    S.on('save-blocked', () => { const e = document.getElementById('save-state'); if (e) { e.textContent = '● plan update waiting – not saved'; e.className = 'save-state bad'; e.onclick = app.planUpgrade; } });
    if (S.pendingUpgrade) setTimeout(app.planUpgrade, 300);
    const lo = document.getElementById('t-logout');
    if (lo) { if (app.opts.onLogout) { lo.title = 'Sign out' + (app.opts.userEmail ? ' (' + app.opts.userEmail + ')' : ''); lo.onclick = async () => { if (await UI.confirm('Sign out', 'Sign out of MAHI on this device? Your work stays saved in your account.', 'Sign out')) { if (root.MAHI_SYNC && root.MAHI_SYNC.pushNow) { try { await root.MAHI_SYNC.pushNow(); } catch (e) { /* ignore */ } } app.opts.onLogout(); } }; } else lo.remove(); }
    setTimeout(welcome, 1500);
    setTimeout(() => S.deadlineScan(), 7000);
    setInterval(() => S.deadlineScan(), 60 * 1000);
  };

  root.MAHI_APP = app;
  // Booted by the React shell after sign-in (src/components/MahiApp.jsx).
})(window);

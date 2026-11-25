/* MAHI pages (part 2): Publishing Calendar, Annual Workflow, Focus Timer, Achievements, Notes, Notifications, Reports & Analytics, Excel, Settings. */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA, S = root.MAHI_STORE, CH = root.MAHI_CHARTS, UI = root.MAHI_UI, P = root.MAHI_PAGES;
  const esc = UI.esc, { card, kpi } = P.helpers;
  const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const mondayOf = (iso) => { const d = new Date(iso.replace(/-/g, '/')); return D.addDays(iso, -((d.getDay() + 6) % 7)); };

  // ================= PUBLISHING CALENDAR =================
  const cal = { view: 'month', date: null, set: 'S01' };
  P.calendar = (el) => {
    const st = S.state, t = S.today();
    cal.date = cal.date || (t < '2026-12-01' ? '2026-12-04' : t);
    const W = st.settings.pubWindows;
    const items = st.assets.filter((a) => a.pubDate);
    const byDay = {}; items.forEach((a) => { (byDay[a.pubDate] = byDay[a.pubDate] || []).push(a); });
    const windowsOn = (d) => D.SETS.filter((s) => W[s.code].start <= d && W[s.code].end >= d);
    const chip = (a) => `<span class="cal-chip" data-pubedit="${a.id}" style="--c:${UI.typeColor(a.type)}" title="${esc(a.id)} · ${esc(a.pubStatus)}${a.platform ? ' · ' + esc(a.platform) : ''}">${a.pubStatus === 'Published' ? '✔ ' : a.pubStatus === 'Scheduled' ? '⏱ ' : ''}${esc(a.id.replace(/^S\d\d-/, ''))}</span>`;
    let body = '';
    const nav = (lbl) => `<div class="row-gap"><button class="btn ghost small" data-nav="-1">◀</button><b>${lbl}</b><button class="btn ghost small" data-nav="1">▶</button><input type="date" id="cal-d" value="${cal.date}"></div>`;
    if (cal.view === 'month') {
      const [y, m] = cal.date.split('-').map(Number); const first = `${y}-${String(m).padStart(2, '0')}-01`; const start = mondayOf(first);
      body = nav(`${MN[m - 1]} ${y}`) + `<div class="cal-grid"><div class="cal-dow">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>${Array.from({ length: 42 }, (_, i) => { const d = D.addDays(start, i); const list = byDay[d] || []; const ws = windowsOn(d); return `<div class="cal-cell ${d.slice(5, 7) !== first.slice(5, 7) ? 'dim' : ''} ${d === t ? 'today' : ''}" data-day="${d}"><div class="cal-dn">${Number(d.slice(8))}${ws.map((s) => `<i class="win" style="--c:${UI.festColor(s.festival)}" title="${s.label} publishing window">${s.label.replace('Set ', 'S')}</i>`).join('')}</div>${list.slice(0, 4).map(chip).join('')}${list.length > 4 ? `<span class="more" data-dayview="${d}">+${list.length - 4} more</span>` : ''}</div>`; }).join('')}</div>`;
    } else if (cal.view === 'week') {
      const s0 = mondayOf(cal.date);
      body = nav(`Week of ${UI.fmt(s0)}`) + `<div class="cal-week">${Array.from({ length: 7 }, (_, i) => { const d = D.addDays(s0, i); const list = (byDay[d] || []).sort((a, b) => (a.pubTime || '').localeCompare(b.pubTime || '')); return `<div class="cw-col ${d === t ? 'today' : ''}"><div class="cw-h">${DOW[i]} ${UI.fmt(d).slice(0, 5)}<span>${windowsOn(d).map((s) => s.label).join(', ')}</span></div>${list.map((a) => `<div class="cw-item" data-pubedit="${a.id}" style="--c:${UI.typeColor(a.type)}"><b>${esc(a.pubTime || '--:--')}</b> ${esc(a.id)}<div class="small">${esc(a.platform || 'no platform')} · ${esc(a.pubStatus)}</div></div>`).join('') || '<p class="muted small">—</p>'}</div>`; }).join('')}</div>`;
    } else if (cal.view === 'day') {
      const list = (byDay[cal.date] || []).sort((a, b) => (a.pubTime || '').localeCompare(b.pubTime || ''));
      body = nav(new Date(cal.date.replace(/-/g, '/')).toDateString()) + `<p class="muted">Publishing windows today: ${windowsOn(cal.date).map((s) => s.label + ' ' + s.festival).join(', ') || 'none'}</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Content ID</th><th>Type</th><th>Brand</th><th>Platform</th><th>Caption</th><th>Hashtags</th><th>Production</th><th>Publishing</th></tr></thead><tbody>${list.map((a) => `<tr><td>${esc(a.pubTime || '—')}</td><td><span class="link" data-pubedit="${a.id}">${a.id}</span></td><td>${UI.typeChip(a.type)}</td><td>${esc(a.brand)}</td><td>${esc(a.platform || '—')}</td><td>${esc(a.captionStatus)}</td><td>${esc(a.hashtagStatus)}</td><td>${UI.statusChip(a.status)}</td><td>${UI.statusChip(a.pubStatus)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">Nothing scheduled on this day.</td></tr>'}</tbody></table></div>`;
    } else if (cal.view === 'festival') {
      body = D.FESTIVALS.map((f) => `<section class="card"><h3 style="color:${f.colors[0]}">${f.name} · ${f.dateLabel}</h3><div class="fest-wins">${D.SETS.filter((s) => s.festival === f.name).map((s) => { const g = st.assets.filter((a) => a.set === s.code); const sc = g.filter((a) => a.pubStatus === 'Scheduled').length, pb = g.filter((a) => a.pubStatus === 'Published').length, dated = g.filter((a) => a.pubDate).length; return `<div class="fw-card"><b>${s.label}</b><div class="small">Window ${UI.fmt(W[s.code].start)} → ${UI.fmt(W[s.code].end)}</div><div class="small">${dated}/88 dated · ${sc} scheduled · ${pb} published</div>${CH.progress(pb / g.length, '#0B5D2A', 'published')}<button class="btn small ghost" data-set="${s.code}">Plan this set</button></div>`; }).join('')}</div></section>`).join('');
    } else {
      // annual heat-map
      const months = []; let [y, m] = D.WORKFLOW_START.split('-').map(Number);
      for (let i = 0; i < 12; i++) { months.push([y, m]); m++; if (m > 12) { m = 1; y++; } }
      body = `<div class="annual-cal">${months.map(([yy, mm]) => { const first = `${yy}-${String(mm).padStart(2, '0')}-01`; const start = mondayOf(first); return `<div class="am"><div class="am-h">${MN[mm - 1].slice(0, 3)} ${yy}</div><div class="am-g">${Array.from({ length: 42 }, (_, i) => { const d = D.addDays(start, i); const n = (byDay[d] || []).length; const inM = d.slice(5, 7) === first.slice(5, 7); const win = windowsOn(d).length; return `<span class="${inM ? '' : 'out'} ${win ? 'win' : ''}" style="--n:${Math.min(1, n / 15)}" title="${UI.fmt(d)}: ${n} post(s)" data-dayview="${inM ? d : ''}"></span>`; }).join('')}</div></div>`; }).join('')}</div><p class="muted small">Darker = more posts scheduled that day. Outlined days fall inside a set publishing window. Annual planning beyond the festival phase lives in Annual Workflow.</p>`;
    }
    // unscheduled planner
    const ps = D.setByCode(cal.set);
    const un = st.assets.filter((a) => a.set === cal.set && !a.pubDate);
    el.innerHTML = `<div class="page-h"><div><h2>Social Media Publishing Calendar</h2><div class="muted">${st.assets.length} publishing records (one per asset) · ${items.length} dated · ${st.assets.filter((a) => a.pubStatus === 'Scheduled').length} scheduled · ${st.assets.filter((a) => a.pubStatus === 'Published').length} published · ${st.platformLogs.length} extra platform logs</div></div>
      <div class="seg">${['day', 'week', 'month', 'festival', 'annual'].map((v) => `<button data-view="${v}" class="${cal.view === v ? 'on' : ''}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div></div>
      <div class="grid g-cal"><section class="card">${body}</section>
      <section class="card"><div class="card-h"><h3>Publishing planner</h3></div><label class="f"><span>Production set</span><select id="ps">${UI.options(D.SETS.map((s) => ({ v: s.code, l: s.label + ' · ' + s.festival })), cal.set)}</select></label>
      <p class="small">Window <b>${UI.fmt(st.settings.pubWindows[cal.set].start)} → ${UI.fmt(st.settings.pubWindows[cal.set].end)}</b> (edit on the Sets page)</p>
      <p><b>${un.length}</b> of ${st.assets.filter((a) => a.set === cal.set).length} assets have no publishing date.</p>
      <button class="btn" id="dist" ${un.length ? '' : 'disabled'}>Spread undated assets across the 7-day window</button>
      <p class="muted small">Only fills empty publishing dates (status stays “Not Scheduled” until you schedule it). Production deadlines are never changed.</p>
      <div class="un-list">${un.slice(0, 30).map((a) => `<div class="arow"><span class="link" data-pubedit="${a.id}">${a.id}</span>${UI.typeChip(a.type)}</div>`).join('')}${un.length > 30 ? `<p class="muted small">+${un.length - 30} more</p>` : ''}</div></section></div>`;
    el.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { cal.view = b.dataset.view; P.calendar(el); });
    el.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => {
      const k = Number(b.dataset.nav);
      if (cal.view === 'month') { const [y, m] = cal.date.split('-').map(Number); const nm = m + k; const d = new Date(Date.UTC(y, nm - 1, 1)); cal.date = d.toISOString().slice(0, 10); }
      else cal.date = D.addDays(cal.date, cal.view === 'week' ? 7 * k : k);
      P.calendar(el);
    });
    const cd = el.querySelector('#cal-d'); if (cd) cd.onchange = () => { if (cd.value) { cal.date = cd.value; P.calendar(el); } };
    el.querySelector('#ps').onchange = (e) => { cal.set = e.target.value; P.calendar(el); };
    el.querySelectorAll('[data-set]').forEach((b) => b.onclick = () => { cal.set = b.dataset.set; P.calendar(el); });
    el.querySelectorAll('[data-dayview]').forEach((x) => x.onclick = () => { if (x.dataset.dayview) { cal.view = 'day'; cal.date = x.dataset.dayview; P.calendar(el); } });
    el.querySelectorAll('[data-pubedit]').forEach((x) => x.onclick = (e) => { e.stopPropagation(); UI.openEditor(x.dataset.pubedit, 'pub'); });
    el.querySelector('#dist').onclick = async () => {
      const w = st.settings.pubWindows[cal.set]; const days = D.daysBetween(w.start, w.end) + 1;
      if (!(await UI.confirm('Spread publishing dates', `Give the ${un.length} undated asset(s) of ${ps.label} publishing dates spread evenly across ${UI.fmt(w.start)} → ${UI.fmt(w.end)} (${days} days)?`, 'Spread dates'))) return;
      un.forEach((a, i) => { S.updateAssets([a.id], { pubDate: D.addDays(w.start, Math.floor((i * days) / un.length)) }, { silent: true }); });
      UI.toast(`${un.length} publishing dates planned`, 'ok');
    };
  };

  // ================= ANNUAL WORKFLOW =================
  P.annual = (el) => {
    const st = S.state, m = S.metrics();
    const items = D.SETS.map((s) => ({ label: `${s.label} · ${s.festival}`, start: s.start, end: s.end, color: UI.festColor(s.festival), pct: m.bySet[s.code].pct, sub: `${m.bySet[s.code].done}/${m.bySet[s.code].target}`, click: 'sets?set=' + s.code }))
      .concat(st.campaigns.filter((c) => c.start).map((c) => ({ label: `★ ${c.name}`, start: c.start, end: c.end || c.start, color: '#1E6FD9', pct: (c.posters + c.ai + c.vj) ? Math.min(1, c.completed / (c.posters + c.ai + c.vj)) : 0, sub: c.type })));
    const newT = st.campaigns.reduce((s, c) => s + Number(c.posters || 0) + Number(c.ai || 0) + Number(c.vj || 0), 0);
    const newD = st.campaigns.reduce((s, c) => s + Number(c.completed || 0), 0);
    el.innerHTML = `<div class="page-h"><div><h2>Annual Workflow</h2><div class="muted">27 November 2026 → 11 November 2027 · the confirmed festival phase is the locked baseline</div></div></div>
      <div class="kpi-grid sm">${kpi('Confirmed baseline', m.total, `${m.done} done · ${UI.pct(m.pct)}`, 'reports', 'good')}${kpi('New campaign targets', newT, `${newD} done (tracked separately)`)}${kpi('Campaigns added', st.campaigns.length)}${kpi('Extra brands', st.extraBrands.length, '', 'brands')}${kpi('Days left in plan', Math.max(0, D.daysBetween(S.today(), D.WORKFLOW_END)))}</div>
      ${card('Production Gantt timeline', CH.gantt(items, { from: '2026-11-23', to: D.WORKFLOW_END, today: S.today() }))}
      ${card('Add campaign / set / brand campaign / service / custom target', `<form id="cf" class="camp-form"><input name="name" placeholder="Name (e.g. Republic Day)" required><select name="type">${UI.options(['New Festival Campaign', 'New Production Set', 'New Brand Campaign', 'New Service', 'New Content Type', 'Additional VJ Member', 'Custom Target', 'Annual Deadline'])}</select><input name="festival" placeholder="Festival / brand"><label>Start <input type="date" name="start" required></label><label>End <input type="date" name="end"></label><input type="number" min="0" name="posters" placeholder="Posters"><input type="number" min="0" name="ai" placeholder="AI videos"><input type="number" min="0" name="vj" placeholder="VJ videos"><input name="notes" placeholder="Notes"><button class="btn">Add</button></form><p class="muted small">New targets are stored separately and never change the confirmed ${m.total}-deliverable festival baseline.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Type</th><th>Festival / brand</th><th>Start</th><th>End</th><th>Posters</th><th>AI</th><th>VJ</th><th>Total</th><th>Completed</th><th>Notes</th><th></th></tr></thead><tbody>${st.campaigns.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.type)}</td><td>${esc(c.festival)}</td><td>${UI.fmt(c.start)}</td><td>${UI.fmt(c.end)}</td><td>${c.posters}</td><td>${c.ai}</td><td>${c.vj}</td><td>${Number(c.posters) + Number(c.ai) + Number(c.vj)}</td><td><input type="number" min="0" value="${c.completed}" data-cdone="${c.id}" style="width:70px"></td><td>${esc(c.notes)}</td><td><button class="icon-btn" data-cdel="${c.id}" aria-label="Delete">🗑</button></td></tr>`).join('') || '<tr><td colspan="12" class="muted">No additional campaigns yet.</td></tr>'}</tbody></table></div>`)}
      ${card('Month by month', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th><th>Confirmed sets ending</th><th>Baseline due</th><th>Baseline done</th><th>New campaign targets starting</th></tr></thead><tbody>${Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(2026, 10 + i, 1)); const ym = d.toISOString().slice(0, 7); const due = st.assets.filter((a) => a.deadline.slice(0, 7) === ym); const sets = D.SETS.filter((s) => s.end.slice(0, 7) === ym); const nt = st.campaigns.filter((c) => (c.start || '').slice(0, 7) === ym).reduce((s, c) => s + Number(c.posters) + Number(c.ai) + Number(c.vj), 0); return `<tr><td>${MN[d.getUTCMonth()]} ${d.getUTCFullYear()}</td><td>${sets.map((s) => s.label + ' ' + s.festival).join(', ') || '—'}</td><td>${due.length}</td><td>${due.filter(D.isDone).length}</td><td>${nt}</td></tr>`; }).join('')}</tbody></table></div>`)}`;
    el.querySelector('#cf').onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); ['posters', 'ai', 'vj'].forEach((k) => { f[k] = Number(f[k] || 0); }); S.addCampaign(f); UI.toast('Added to annual workflow', 'ok'); };
    el.querySelectorAll('[data-cdone]').forEach((i) => i.onchange = () => S.updateCampaign(i.dataset.cdone, { completed: Number(i.value || 0) }));
    el.querySelectorAll('[data-cdel]').forEach((b) => b.onclick = async () => { if (await UI.confirm('Delete campaign', 'Delete this planned campaign/target?', 'Delete', true)) S.deleteCampaign(b.dataset.cdel); });
  };

  // ================= FOCUS TIMER =================
  const T = { mode: 'focus', total: 25 * 60, left: 25 * 60, running: false, timer: null, label: '25-minute focus', kind: 'focus' };
  function tick() {
    if (!T.running) return;
    T.left = Math.max(0, Math.round((T.endAt - Date.now()) / 1000));
    const n = document.getElementById('tm-left'); if (n) n.textContent = fmtT(T.left);
    const r = document.getElementById('tm-ring'); if (r) r.style.setProperty('--p', 1 - T.left / T.total);
    document.title = (T.running ? fmtT(T.left) + ' · ' : '') + 'MAHI';
    if (T.left <= 0) finish();
  }
  const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  function finish() {
    clearInterval(T.timer); T.running = false; document.title = 'MAHI Control Center';
    if (T.kind === 'focus') {
      S.addFocusSession({ minutes: Math.round(T.total / 60), label: T.label });
      root.MAHI_CHAR.setFocus(false);
      root.MAHI_CHAR.react({ kind: 'focusEnd', priority: 3, msg: `Focus session done, ${S.state.settings.callName}! Time for a short break.`, detail: `${Math.round(T.total / 60)} minutes of focused work (not counted as a deliverable).` });
      S.notify('focus', 'Focus session completed', `${Math.round(T.total / 60)} minutes`);
    } else root.MAHI_CHAR.react({ kind: 'welcome', priority: 3, msg: `Break's over, ${S.state.settings.callName}. Ready for the next focus block?` });
    T.left = T.total; if (UI.route.name === 'timer') root.MAHI_APP.render();
  }
  P.timer = (el) => {
    const sessions = S.state.focusSessions; const t = S.today();
    const todayS = sessions.filter((s) => s.ts.slice(0, 10) === t || D.localISO(new Date(s.ts)) === t);
    const presets = [['focus', 25, '25-minute focus'], ['focus', 50, '50-minute deep work'], ['break', 5, 'Short break'], ['break', 15, 'Long break']];
    el.innerHTML = `<div class="page-h"><div><h2>My Focus Timer</h2><div class="muted">Focus sessions are tracked separately and never counted as production deliverables.</div></div></div>
      <div class="grid g-2"><section class="card timer-card"><div class="seg wrap">${presets.map(([k, mi, l]) => `<button data-preset="${k}|${mi}|${l}" class="${T.label === l ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="custom-t"><label>Custom minutes <input type="number" id="tm-c" min="1" max="240" value="30"></label><button class="btn ghost small" id="tm-cs">Set custom focus</button></div>
      <div class="tm-ring" id="tm-ring" style="--p:${1 - T.left / T.total}"><div><div class="muted small">${esc(T.label)}</div><div class="tm-left" id="tm-left">${fmtT(T.left)}</div></div></div>
      <div class="row-gap center"><button class="btn" id="tm-go">${T.running ? 'Pause' : 'Start'}</button><button class="btn ghost" id="tm-reset">Reset</button></div></section>
      ${card('Focus log', `<div class="kpi-grid sm">${kpi('Sessions today', todayS.length)}${kpi('Minutes today', todayS.reduce((s, x) => s + (x.minutes || 0), 0))}${kpi('All sessions', sessions.length)}${kpi('All minutes', sessions.reduce((s, x) => s + (x.minutes || 0), 0))}</div><div class="tlist">${sessions.slice(-12).reverse().map((s) => `<div class="trow"><span>✔ ${esc(s.label || 'Focus')}</span><span class="muted small">${new Date(s.ts).toLocaleString()}</span><b>${s.minutes} min</b></div>`).join('') || '<p class="muted">No focus sessions yet.</p>'}</div>`)}</div>`;
    el.querySelectorAll('[data-preset]').forEach((b) => b.onclick = () => { if (T.running) return UI.toast('Pause or reset the timer first'); const [k, mi, l] = b.dataset.preset.split('|'); Object.assign(T, { kind: k, total: mi * 60, left: mi * 60, label: l }); P.timer(el); });
    el.querySelector('#tm-cs').onclick = () => { if (T.running) return UI.toast('Pause or reset the timer first'); const mi = Math.max(1, Math.min(240, Number(el.querySelector('#tm-c').value) || 30)); Object.assign(T, { kind: 'focus', total: mi * 60, left: mi * 60, label: `${mi}-minute custom focus` }); P.timer(el); };
    el.querySelector('#tm-go').onclick = () => {
      if (T.running) { T.running = false; clearInterval(T.timer); root.MAHI_CHAR.setFocus(false); }
      else { T.running = true; T.endAt = Date.now() + T.left * 1000; T.timer = setInterval(tick, 500); if (T.kind === 'focus') root.MAHI_CHAR.setFocus(true); }
      P.timer(el);
    };
    el.querySelector('#tm-reset').onclick = () => { T.running = false; clearInterval(T.timer); T.left = T.total; root.MAHI_CHAR.setFocus(false); document.title = 'MAHI Control Center'; P.timer(el); };
  };

  // ================= ACHIEVEMENTS =================
  P.achievements = (el) => {
    const st = S.state, cur = D.achievementStatus(st.assets);
    const unlocked = D.ACHIEVEMENTS.filter((a) => st.achievements[a.key]).length;
    const ms = Object.keys(st.milestones).sort((a, b) => String(st.milestones[a]).localeCompare(String(st.milestones[b])));
    const msLabel = (k) => k.startsWith('overall') ? `${k.replace('overall', '')}% overall milestone` : k.startsWith('set100:') ? `${D.setByCode(k.split(':')[1]).label} completed (100%)` : k;
    el.innerHTML = `<div class="page-h"><div><h2>My Achievements</h2><div class="muted">${unlocked} of ${D.ACHIEVEMENTS.length} unlocked · calculated only from real completed records</div></div></div>
      <div class="ach-grid">${D.ACHIEVEMENTS.map((a) => { const u = st.achievements[a.key]; return `<div class="ach ${u ? 'on' : ''}"><div class="ach-i">${u ? a.icon : '🔒'}</div><div><b>${esc(a.name)}</b><div class="small muted">${esc(a.cond)}</div><div class="small">${u ? `Unlocked ${UI.fmt(String(u).slice(0, 10))}` : cur[a.key] ? 'Condition met' : 'Locked'}</div></div></div>`; }).join('')}</div>
      ${card('Milestone history', ms.length ? `<div class="tlist">${ms.map((k) => `<div class="trow"><span>🏅 ${esc(msLabel(k))}</span><span class="muted small">${new Date(st.milestones[k]).toLocaleString()}</span></div>`).join('')}</div>` : '<p class="muted">No milestones reached yet. 25%, 50%, 75% and 100% celebrations trigger once, when progress actually crosses the threshold.</p>')}`;
  };

  // ================= NOTES =================
  const noteF = { q: '', cat: '' };
  P.notes = (el) => {
    const st = S.state;
    const cats = ['Personal', 'Production', 'Ideas', 'Meeting', 'Sticky', 'Follow-up', 'Other'];
    const list = st.notes.filter((n) => (!noteF.cat || n.category === noteF.cat) && (!noteF.q || (n.title + ' ' + n.text + ' ' + n.linkedId).toLowerCase().includes(noteF.q.toLowerCase()))).sort((a, b) => (b.pinned - a.pinned) || String(b.date).localeCompare(String(a.date)));
    el.innerHTML = `<div class="page-h"><div><h2>My Notes</h2><div class="muted">${st.notes.length} personal notes · pinned notes appear on the corkboard</div></div></div>
      ${card('New note', `<form id="nf" class="note-form"><input name="title" placeholder="Title"><select name="category">${UI.options(cats, 'Personal')}</select><input name="linkedId" placeholder="Linked Content ID (optional)"><label class="small"><input type="checkbox" name="pinned"> Pin</label><textarea name="text" rows="3" placeholder="Write your note…" required></textarea><button class="btn">Save note</button></form>`)}
      <div class="filters"><input id="nq" type="search" placeholder="Search notes…" value="${esc(noteF.q)}"><select id="nc">${UI.options(cats, noteF.cat, 'All categories')}</select></div>
      <div class="notes-grid">${list.map((n) => `<div class="note ${n.pinned ? 'pinned-n' : ''}"><div class="note-h"><b>${esc(n.title || 'Untitled')}</b><span class="muted small">${UI.fmt(n.date)} · ${esc(n.category)}</span></div><div class="pre">${esc(n.text)}</div>${n.linkedId ? `<span class="link small" data-edit="${esc(n.linkedId)}">${esc(n.linkedId)}</span>` : ''}<div class="note-a"><button class="icon-btn" data-pin="${n.id}" title="${n.pinned ? 'Unpin' : 'Pin'}">${n.pinned ? '📌' : '📍'}</button><button class="icon-btn" data-nedit="${n.id}" title="Edit">✎</button><button class="icon-btn" data-ndel="${n.id}" title="Delete">🗑</button></div></div>`).join('') || '<p class="muted">No notes found.</p>'}</div>`;
    el.querySelector('#nf').onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); f.pinned = !!f.pinned; S.addNote(f); UI.toast('Note saved', 'ok'); };
    el.querySelector('#nq').oninput = (e) => { noteF.q = e.target.value; P.notes(el); const q = el.querySelector('#nq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); };
    el.querySelector('#nc').onchange = (e) => { noteF.cat = e.target.value; P.notes(el); };
    el.querySelectorAll('[data-pin]').forEach((b) => b.onclick = () => { const n = st.notes.find((x) => x.id === b.dataset.pin); S.updateNote(n.id, { pinned: !n.pinned }); });
    el.querySelectorAll('[data-ndel]').forEach((b) => b.onclick = async () => { if (await UI.confirm('Delete note', 'Delete this note permanently?', 'Delete', true)) S.deleteNote(b.dataset.ndel); });
    el.querySelectorAll('[data-nedit]').forEach((b) => b.onclick = async () => {
      const n = st.notes.find((x) => x.id === b.dataset.nedit);
      const v = await UI.modal('Edit note', `<label class="f"><span>Title</span><input id="e-t" value="${esc(n.title)}"></label><label class="f"><span>Note</span><textarea id="e-x" rows="6">${esc(n.text)}</textarea></label>`, [{ label: 'Save', value: (w) => ({ title: w.querySelector('#e-t').value, text: w.querySelector('#e-x').value }) }, { label: 'Cancel', value: null }]);
      if (v) S.updateNote(n.id, v);
    });
  };

  // ================= NOTIFICATIONS =================
  const nf = { type: '', unread: false };
  P.notifications = (el) => {
    const st = S.state;
    const types = [...new Set(st.notifications.map((n) => n.type))];
    const list = st.notifications.filter((n) => (!nf.type || n.type === nf.type) && (!nf.unread || !n.read));
    const icon = { poster: '🖼️', ai: '🤖', vj: '🎬', task: '✅', brand: '🏷️', set: '📦', festival: '🎉', deadline: '⏰', overdue: '⚠️', approval: '🔍', publish: '📣', daily: '🌟', achievement: '🏆', correction: '✏️', reminder: '🔔', focus: '🎧', import: '📥' };
    el.innerHTML = `<div class="page-h"><div><h2>MAHI Notifications</h2><div class="muted">${st.notifications.filter((n) => !n.read).length} unread · every notification comes from your real task data or actions</div></div><div class="row-gap"><button class="btn ghost" id="mr">Mark all read</button><button class="btn ghost" id="scan">Check deadlines now</button></div></div>
      <div class="filters"><select id="nt">${UI.options(types, nf.type, 'All types')}</select><label class="small"><input type="checkbox" id="nu" ${nf.unread ? 'checked' : ''}> Unread only</label></div>
      <div class="notif-list">${list.slice(0, 300).map((n) => `<div class="notif ${n.read ? '' : 'unread'}"><span class="ni">${icon[n.type] || '•'}</span><div class="nb"><b>${esc(n.title)}</b><div class="small">${esc(n.body)}</div><div class="muted small">${new Date(n.ts).toLocaleString()}</div></div>${n.ref ? `<button class="btn small ghost" data-edit="${esc(n.ref)}">Open</button>` : ''}${n.read ? '' : `<button class="icon-btn" data-read="${n.id}" title="Mark read">✓</button>`}</div>`).join('') || '<p class="muted">No notifications.</p>'}</div>`;
    el.querySelector('#mr').onclick = () => S.markRead();
    el.querySelector('#scan').onclick = () => { const r = S.deadlineScan(true); if (!r.length) UI.toast('No approaching or overdue deadlines right now.'); };
    el.querySelector('#nt').onchange = (e) => { nf.type = e.target.value; P.notifications(el); };
    el.querySelector('#nu').onchange = (e) => { nf.unread = e.target.checked; P.notifications(el); };
    el.querySelectorAll('[data-read]').forEach((b) => b.onclick = () => S.markRead(b.dataset.read));
  };

  // ================= REPORTS & ANALYTICS =================
  const rep = { type: 'overall', from: D.WORKFLOW_START, to: '2027-01-19', fest: '' };
  const REPORTS = { daily: 'Daily Work Report', weekly: 'Weekly Production Report', festival: 'Festival Production Report', brand: 'Brand-Wise Report', poster: 'Poster Production Report', ai: 'AI Video Production Report', vj: 'VJ Performance Report', pending: 'Pending Work Report', overdue: 'Overdue Work Report', publishing: 'Publishing Report', overall: 'Overall Project Completion Report' };
  function buildReport(type, from, to) {
    const st = S.state, A = st.assets; S.metrics();
    const inR = (d) => d && d >= from && d <= to;
    const tables = [];
    const grp = (title, keys, keyFn, labelFn) => {
      const rows = keys.map((k) => { const g = A.filter((a) => keyFn(a) === k); const d = g.filter(D.isDone).length; return [labelFn ? labelFn(k) : k, g.length, d, g.length - d, UI.pct(g.length ? d / g.length : 0), g.filter((a) => D.isDone(a) && inR(a.completionDate)).length, g.filter((a) => a.__flag === 'OVERDUE').length, g.filter((a) => a.pubStatus === 'Published').length]; });
      tables.push({ title, head: ['Group', 'Target', 'Completed', 'Pending', 'Completion %', 'Done in period', 'Overdue', 'Published'], rows });
    };
    const listT = (title, list) => tables.push({ title: `${title} (${list.length})`, head: ['Content ID', 'Type', 'Brand', 'Set', 'Festival', 'Status', 'Deadline', 'Flag', 'Completed on'], rows: list.map((a) => [a.id, a.type, a.brand, UI.setLabel(a.set), a.festival, a.status, UI.fmt(a.deadline), a.__flag, UI.fmt(a.completionDate)]) });
    const summary = () => { const d = A.filter(D.isDone).length; tables.push({ title: 'Summary', head: ['Measure', 'Value'], rows: [['Total deliverables', A.length], ['Completed', d], ['Pending', A.length - d], ['Completion', UI.pct(d / A.length)], ['Completed in period', A.filter((a) => D.isDone(a) && inR(a.completionDate)).length], ['Overdue now', A.filter((a) => a.__flag === 'OVERDUE').length], ['Published', A.filter((a) => a.pubStatus === 'Published').length], ['Scheduled', A.filter((a) => a.pubStatus === 'Scheduled').length]] }); };
    switch (type) {
      case 'daily': {
        const d = from; const act = A.filter((a) => a.prodStart <= d && a.deadline >= d);
        tables.push({ title: `Day summary · ${UI.fmt(d)}`, head: ['Measure', 'Value'], rows: [['Active production assignments', act.length], ['Completed that day', A.filter((a) => a.completionDate === d && D.isDone(a)).length], ['Still open in active sets', act.filter((a) => !D.isDone(a)).length], ['Overdue at that date', A.filter((a) => a.deadline < d && !D.isDone(a)).length], ['Personal tasks planned', st.customTasks.filter((x) => x.date === d).length], ['Personal tasks completed', st.customTasks.filter((x) => x.date === d && x.status === 'Completed').length], ['Published that day', A.filter((a) => a.pubStatus === 'Published' && a.pubDate === d).length]] });
        listT('Completed that day', A.filter((a) => a.completionDate === d && D.isDone(a)));
        tables.push({ title: 'Personal tasks', head: ['Task', 'Priority', 'Status', 'Linked ID'], rows: st.customTasks.filter((x) => x.date === d).map((x) => [x.title, x.priority, x.status, x.linkedId]) });
        break;
      }
      case 'weekly': {
        const days = Math.min(62, D.daysBetween(from, to) + 1);
        tables.push({ title: 'Day by day', head: ['Date', 'Completed', 'Posters', 'AI Videos', 'VJ Videos', 'Published', 'Deadlines'], rows: Array.from({ length: days }, (_, i) => { const d = D.addDays(from, i); const c = A.filter((a) => D.isDone(a) && a.completionDate === d); return [UI.fmt(d), c.length, c.filter((a) => a.type === 'Poster').length, c.filter((a) => a.type === 'AI Video').length, c.filter((a) => a.type === 'VJ Video').length, A.filter((a) => a.pubStatus === 'Published' && a.pubDate === d).length, A.filter((a) => a.deadline === d).length]; }) });
        grp('By content type', D.CONTENT_TYPES, (a) => a.type);
        break;
      }
      case 'festival': grp('Festival progress', D.FESTIVALS.map((f) => f.name), (a) => a.festival); grp('Set progress', D.SETS.map((s) => s.code), (a) => a.set, (k) => `${D.setByCode(k).label} · ${D.setByCode(k).festival}`); break;
      case 'brand': grp('Brand-wise progress', D.BRANDS.map((b) => b.name), (a) => a.brand); break;
      case 'poster': case 'ai': {
        const tp = type === 'poster' ? 'Poster' : 'AI Video'; const g = A.filter((a) => a.type === tp);
        tables.push({ title: `${tp} by set`, head: ['Set', 'Target', 'Completed', 'Pending', 'Completion %', 'Overdue'], rows: D.SETS.map((s) => { const x = g.filter((a) => a.set === s.code); const d = x.filter(D.isDone).length; return [s.label + ' · ' + s.festival, x.length, d, x.length - d, UI.pct(x.length ? d / x.length : 0), x.filter((a) => a.__flag === 'OVERDUE').length]; }) });
        tables.push({ title: `${tp} workflow stages`, head: ['Stage', 'Assets'], rows: D.BRANCH_STAGES[tp].map((s) => [s, g.filter((a) => a.__stage === s).length]) });
        listT(`${tp}s completed in period`, g.filter((a) => D.isDone(a) && inR(a.completionDate)));
        break;
      }
      case 'vj': {
        tables.push({ title: 'VJ performance', head: ['VJ', 'Assigned', 'Scripts done', 'Shoots done', 'Edits done', 'Approved', 'Published', 'Completed', 'Pending', 'Overdue', 'Completion %', 'Done in period'], rows: st.settings.vjs.map((v) => { const g = A.filter((a) => a.vj === v.id); const d = g.filter(D.isDone).length; return [`${v.name} (${v.id})`, g.length, g.filter((a) => a.scriptStatus === 'Completed').length, g.filter((a) => a.shootStatus === 'Completed').length, g.filter((a) => a.editStatus === 'Completed').length, g.filter((a) => a.finalApproval === 'Approved' || D.isDone(a)).length, g.filter((a) => a.pubStatus === 'Published').length, d, g.length - d, g.filter((a) => a.__flag === 'OVERDUE').length, UI.pct(g.length ? d / g.length : 0), g.filter((a) => D.isDone(a) && inR(a.completionDate)).length]; }) });
        break;
      }
      case 'pending': listT('Pending work with deadlines in period', A.filter((a) => !D.isDone(a) && inR(a.deadline))); break;
      case 'overdue': listT('Overdue work', A.filter((a) => a.__flag === 'OVERDUE')); break;
      case 'publishing': {
        tables.push({ title: 'Publishing status', head: ['Status', 'Assets'], rows: D.PUB_STATUSES.map((p) => [p, A.filter((a) => a.pubStatus === p).length]) });
        tables.push({ title: 'Published in period', head: ['Content ID', 'Type', 'Brand', 'Date', 'Time', 'Platform', 'URL', 'Production status'], rows: A.filter((a) => a.pubStatus === 'Published' && inR(a.pubDate)).map((a) => [a.id, a.type, a.brand, UI.fmt(a.pubDate), a.pubTime, a.platform, a.pubLink, a.status]) });
        tables.push({ title: 'Extra platform logs in period', head: ['Content ID', 'Platform', 'Date', 'Status', 'URL'], rows: st.platformLogs.filter((l) => inR(l.date)).map((l) => [l.contentId, l.platform, UI.fmt(l.date), l.status, l.url]) });
        break;
      }
      default: summary(); grp('By content type', D.CONTENT_TYPES, (a) => a.type); grp('By festival', D.FESTIVALS.map((f) => f.name), (a) => a.festival); grp('By set', D.SETS.map((s) => s.code), (a) => a.set, (k) => D.setByCode(k).label);
    }
    if (type !== 'overall' && type !== 'daily') summary();
    return tables;
  }
  function reportText(title, tables) {
    const s = S.state.settings;
    let t = `IGO GROUP OF COMPANIES\nDIGITAL MARKETING PRODUCTION REPORT\n${title}\nPrepared and Managed by ${s.owner}\nPeriod: ${UI.fmt(rep.from)} – ${UI.fmt(rep.to)} · Generated ${new Date().toLocaleString()}\n\n`;
    tables.forEach((tb) => { t += `${tb.title}\n${tb.head.join('\t')}\n${tb.rows.map((r) => r.join('\t')).join('\n')}\n\n`; });
    return t;
  }
  P.reports = (el) => {
    const st = S.state, m = S.metrics();
    if (rep.type === 'daily' && rep.from === D.WORKFLOW_START) rep.from = S.today();
    const tables = buildReport(rep.type, rep.from, rep.to);
    const title = REPORTS[rep.type];
    const scope = rep.fest ? st.assets.filter((a) => a.festival === rep.fest) : st.assets;
    const g = (fn) => { const r = {}; scope.forEach((a) => { const k = fn(a); r[k] = r[k] || { t: 0, d: 0, o: 0, p: 0 }; r[k].t++; if (D.isDone(a)) r[k].d++; if (a.__flag === 'OVERDUE') r[k].o++; if (a.__flag && a.__flag.startsWith('DUE')) r[k].p++; }); return r; };
    const bySet = g((a) => a.set), byBrand = g((a) => a.brand), byVJ = g((a) => a.vj || '-'), byType = g((a) => a.type);
    const sDone = scope.filter(D.isDone).length;
    const days = []; for (let d = D.WORKFLOW_START; d <= '2027-01-19'; d = D.addDays(d, 1)) days.push(d);
    const weeks = Array.from({ length: 9 }, (_, i) => D.addDays('2026-11-23', i * 7));
    const fs = rep.fest ? `&festival=${encodeURIComponent(rep.fest)}` : '';
    const typeProg = (tp, color) => CH.vbars(D.SETS.map((s) => { const x = scope.filter((a) => a.set === s.code && a.type === tp); return { label: s.label.replace('Set ', 'S'), value: x.length ? x.filter(D.isDone).length / x.length : 0, color, click: `production?type=${tp}&set=${s.code}` }; }).filter((r, i) => !rep.fest || D.SETS[i].festival === rep.fest), { pct: true, max: 1, height: 140 });
    const charts = [
      ['1 · Overall Production Progress', CH.donut([{ label: 'Completed', value: sDone, color: '#2E9E4F', click: 'production?done=1' + fs }, { label: 'Pending', value: scope.length - sDone, color: '#C9CFD6', click: 'production?done=0' + fs }], { center: UI.pct(scope.length ? sDone / scope.length : 0), sub: `${sDone}/${scope.length}` })],
      ['2 · Completed vs Pending', CH.hbars(D.CONTENT_TYPES.map((t) => ({ label: t, values: [(byType[t] || { d: 0 }).d, (byType[t] || { t: 0 }).t - (byType[t] || { d: 0 }).d], click: 'production?type=' + t + fs })), [{ name: 'Completed', color: '#2E9E4F' }, { name: 'Pending', color: '#C9CFD6' }])],
      ['3 · Poster Production Progress', typeProg('Poster', '#2E9E4F')], ['4 · AI Video Production Progress', typeProg('AI Video', '#1E6FD9')], ['5 · VJ Video Production Progress', typeProg('VJ Video', '#7E57C2')],
      ...D.FESTIVALS.map((f, i) => [`${6 + i} · ${f.name} Campaign Progress`, CH.donut([{ label: 'Completed', value: m.byFestival[f.name].done, color: f.colors[0] }, { label: 'Pending', value: m.byFestival[f.name].pending, color: '#C9CFD6' }], { center: UI.pct(m.byFestival[f.name].pct), sub: `${m.byFestival[f.name].done}/${m.byFestival[f.name].target}`, size: 150 })]),
      ['9 · Seven-Set Completion', CH.vbars(D.SETS.filter((s) => !rep.fest || s.festival === rep.fest).map((s) => ({ label: s.label.replace('Set ', 'S'), value: bySet[s.code] ? bySet[s.code].d / bySet[s.code].t : 0, color: UI.festColor(s.festival), click: 'sets?set=' + s.code })), { pct: true, max: 1 })],
      ['10 · Brand-Wise Production Comparison', CH.hbars(D.BRANDS.map((b) => ({ label: b.name, values: [byBrand[b.name].d, byBrand[b.name].t - byBrand[b.name].d], click: 'production?brand=' + encodeURIComponent(b.name) + fs })), [{ name: 'Completed', color: '#2E9E4F' }, { name: 'Pending', color: '#C9CFD6' }])],
      ['11 · Three-VJ Performance Comparison', CH.hbars(st.settings.vjs.map((v, i) => ({ label: v.name, values: [(byVJ[v.id] || { d: 0 }).d, (byVJ[v.id] || { t: 0 }).t - (byVJ[v.id] || { d: 0 }).d], click: 'vj' + (i + 1) })), [{ name: 'Completed', color: '#7E57C2' }, { name: 'Pending', color: '#C9CFD6' }])],
      ['12 · Daily Productivity Trend', CH.line([{ name: 'Completed', color: '#2E9E4F', points: days.map((d) => scope.filter((a) => D.isDone(a) && a.completionDate === d).length) }, { name: 'Published', color: '#1E6FD9', points: days.map((d) => scope.filter((a) => a.pubStatus === 'Published' && a.pubDate === d).length) }], days.map((d) => UI.fmt(d).slice(0, 5)))],
      ['13 · Weekly Productivity Trend', CH.vbars(weeks.map((w) => ({ label: UI.fmt(w).slice(0, 5), value: scope.filter((a) => D.isDone(a) && a.completionDate >= w && a.completionDate <= D.addDays(w, 6)).length, color: '#2E9E4F', title: `Week of ${UI.fmt(w)}` })))],
      ['14 · Upcoming Deadline Chart', CH.vbars(D.SETS.filter((s) => !rep.fest || s.festival === rep.fest).map((s) => ({ label: s.label.replace('Set ', 'S'), value: scope.filter((a) => a.set === s.code && !D.isDone(a)).length, color: (bySet[s.code] || {}).p ? '#EF7D00' : '#9E9E9E', title: `${s.label}: pending until ${UI.fmt(s.end)} (${(bySet[s.code] || { p: 0 }).p} due soon)`, click: `production?set=${s.code}&done=0` })))],
      ['15 · Overdue Assignment Chart', CH.vbars(D.SETS.filter((s) => !rep.fest || s.festival === rep.fest).map((s) => ({ label: s.label.replace('Set ', 'S'), value: (bySet[s.code] || { o: 0 }).o, color: '#D32F2F', click: `production?set=${s.code}&flag=OVERDUE` })))],
      ['16 · Publishing Completion', CH.donut(D.PUB_STATUSES.map((p, i) => ({ label: p, value: scope.filter((a) => a.pubStatus === p).length, color: ['#C9CFD6', '#1E6FD9', '#0B5D2A', '#78909C'][i], click: 'production?pubStatus=' + encodeURIComponent(p) + fs })), { center: UI.pct(scope.length ? scope.filter((a) => a.pubStatus === 'Published').length / scope.length : 0), sub: 'published' })],
      ['17 · Production Gantt Timeline', CH.gantt(D.SETS.filter((s) => !rep.fest || s.festival === rep.fest).map((s) => ({ label: s.label + ' ' + s.festival, start: s.start, end: s.end, color: UI.festColor(s.festival), pct: bySet[s.code] ? bySet[s.code].d / bySet[s.code].t : 0, click: 'sets?set=' + s.code })), { from: '2026-11-23', to: '2027-01-20', today: S.today() })],
      ['18 · Workflow Stage Distribution', CH.hbars(Object.keys(D.BRANCH_STAGES).flatMap((t) => D.BRANCH_STAGES[t].map((s) => ({ label: `${t === 'Poster' ? 'P' : t === 'AI Video' ? 'AI' : 'VJ'} · ${s}`, values: [scope.filter((a) => a.type === t && a.__stage === s).length], click: `production?type=${t}&stage=${s}` }))), [{ name: 'Tasks', color: '#1B5E20' }])],
    ];
    el.innerHTML = `<div class="page-h no-print"><div><h2>Reports & Analytics</h2><div class="muted">Automatic reports from your real production records</div></div></div>
      <section class="card no-print"><div class="filters"><select id="rt">${UI.options(Object.keys(REPORTS).map((k) => ({ v: k, l: REPORTS[k] })), rep.type)}</select><label>From <input type="date" id="rf" value="${rep.from}"></label><label>To <input type="date" id="rto" value="${rep.to}"></label><button class="btn" id="rcopy">Copy report</button><button class="btn ghost" id="rprint">Print</button><button class="btn ghost" id="rxl">Export to Excel</button>${root.MAHI_CLOUD ? '<button class="btn ghost" id="rsave">Save report to cloud</button>' : ''}</div></section>
      <section class="card report" id="report"><div class="rep-h"><div class="rep-org">IGO GROUP OF COMPANIES</div><div class="rep-t">DIGITAL MARKETING PRODUCTION REPORT</div><div class="rep-s">${esc(title)}</div><div class="rep-m">Prepared and Managed by ${esc(st.settings.owner)} · Period ${UI.fmt(rep.from)} – ${UI.fmt(rep.to)} · Generated ${new Date().toLocaleString()}</div></div>
      ${tables.map((tb) => `<h4>${esc(tb.title)}</h4><div class="tbl-wrap"><table class="tbl"><thead><tr>${tb.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${tb.rows.slice(0, 700).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${tb.head.length}" class="muted">No records.</td></tr>`}</tbody></table></div>`).join('')}</section>
      ${root.MAHI_CLOUD ? '<section class="card no-print" id="saved-reports"><div class="card-h"><h3>Saved reports</h3></div><p class="muted small">Loading…</p></section>' : ''}
      <div class="page-h no-print"><h3>Analytics (18 live charts)</h3><div class="filters"><select id="af">${UI.options(D.FESTIVALS.map((f) => f.name), rep.fest, 'All festivals')}</select><span class="muted small">Click bars / segments to open the matching records.</span></div></div>
      <div class="chart-grid no-print">${charts.map(([t, c]) => `<section class="card"><div class="card-h"><h3>${esc(t)}</h3></div>${c}</section>`).join('')}</div>`;
    el.querySelector('#rt').onchange = (e) => { rep.type = e.target.value; P.reports(el); };
    el.querySelector('#rf').onchange = (e) => { rep.from = e.target.value; P.reports(el); };
    el.querySelector('#rto').onchange = (e) => { rep.to = e.target.value; P.reports(el); };
    el.querySelector('#af').onchange = (e) => { rep.fest = e.target.value; P.reports(el); };
    el.querySelector('#rprint').onclick = () => window.print();
    el.querySelector('#rcopy').onclick = async () => { const txt = reportText(title, tables); try { await navigator.clipboard.writeText(txt); UI.toast('Report copied to clipboard', 'ok'); } catch (e) { UI.modal('Copy report', `<textarea rows="16" style="width:100%">${esc(txt)}</textarea>`); } };
    if (root.MAHI_CLOUD) {
      const box = el.querySelector('#saved-reports');
      const paint = async () => {
        let list = [];
        try { list = await root.MAHI_CLOUD.listReports(); } catch (e) { box.innerHTML = `<div class="card-h"><h3>Saved reports</h3></div><p class="bad-t small">Could not load saved reports: ${esc(e.message || e)}</p>`; return; }
        box.innerHTML = `<div class="card-h"><h3>Saved reports (${list.length})</h3><span class="muted small">Stored permanently in your cloud account</span></div>` + (list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Saved</th><th>Report</th><th>Period</th><th></th></tr></thead><tbody>${list.map((r) => `<tr><td>${esc(new Date(r.created_at).toLocaleString())}</td><td>${esc(r.title)}</td><td>${UI.fmt(r.period_from)} – ${UI.fmt(r.period_to)}</td><td><button class="btn small ghost" data-ropen="${esc(r.id)}">Open</button> <button class="icon-btn" data-rdel="${esc(r.id)}" aria-label="Delete saved report">🗑</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">No saved reports yet. Generate a report above and press "Save report to cloud".</p>');
        box.querySelectorAll('[data-ropen]').forEach((b) => b.onclick = () => {
          const r = list.find((x) => x.id === b.dataset.ropen); const c = r.content || {};
          UI.modal(r.title, `<div class="report"><div class="rep-h"><div class="rep-org">IGO GROUP OF COMPANIES</div><div class="rep-t">DIGITAL MARKETING PRODUCTION REPORT</div><div class="rep-s">${esc(r.title)}</div><div class="rep-m">Prepared and Managed by ${esc(c.owner || st.settings.owner)} · Period ${UI.fmt(r.period_from)} – ${UI.fmt(r.period_to)} · Saved ${esc(new Date(r.created_at).toLocaleString())}</div></div>${(c.tables || []).map((tb) => `<h4>${esc(tb.title)}</h4><div class="tbl-wrap"><table class="tbl"><thead><tr>${tb.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${tb.rows.map((row) => `<tr>${row.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')}</div>`, [{ label: 'Close', value: null }], { wide: true });
        });
        box.querySelectorAll('[data-rdel]').forEach((b) => b.onclick = async () => { if (await UI.confirm('Delete saved report', 'Delete this saved report permanently? This cannot be undone.', 'Delete', true)) { try { await root.MAHI_CLOUD.deleteReport(b.dataset.rdel); UI.toast('Report deleted'); } catch (e) { UI.toast('Delete failed: ' + (e.message || e), 'bad'); } paint(); } });
      };
      paint();
      el.querySelector('#rsave').onclick = async () => {
        try { await root.MAHI_CLOUD.saveReport({ title, report_type: rep.type, period_from: rep.from, period_to: rep.to, content: { owner: st.settings.owner, generatedAt: new Date().toISOString(), tables } }); UI.toast('Report saved to your cloud account', 'ok'); paint(); }
        catch (e) { UI.toast('Could not save report: ' + (e.message || e), 'bad'); }
      };
    }
    el.querySelector('#rxl').onclick = async () => {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Report');
      [['IGO GROUP OF COMPANIES'], ['DIGITAL MARKETING PRODUCTION REPORT'], [title], [`Prepared and Managed by ${st.settings.owner}`], [`Period ${UI.fmt(rep.from)} – ${UI.fmt(rep.to)}`], []].forEach((r, i) => { ws.addRow(r); ws.getRow(i + 1).font = { bold: i < 3, size: i === 0 ? 16 : 11 }; });
      tables.forEach((tb) => { ws.addRow([tb.title]).font = { bold: true, color: { argb: 'FF1B5E20' } }; const h = ws.addRow(tb.head); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } }; }); tb.rows.forEach((r) => ws.addRow(r)); ws.addRow([]); });
      ws.columns.forEach((c) => { c.width = 20; });
      UI.download(new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `MAHI_${rep.type}_report_${S.today()}.xlsx`);
    };
  };

  // ================= EXCEL IMPORT & EXPORT =================
  P.excel = (el) => {
    el.innerHTML = `<div class="page-h"><div><h2>Excel Import & Export</h2><div class="muted">The web app is your active editing interface. The workbook works fully on its own as well.</div></div></div>
      <div class="grid g-2">${card('Export workbook', `<p>Downloads a complete workbook (all 25 worksheets + Platform Publishing Log, Instructions) with every content ID, assignment, status, date, note and publishing record, plus live formulas, dropdowns and conditional formatting.</p><button class="btn" id="xexp">Export to Excel (.xlsx)</button><p class="muted small">Native Excel chart objects are included in the master workbook shipped with MAHI. In-app exports keep every formula-driven dashboard, bar and report – open the master workbook if you want the native chart objects.</p>`)}
      ${card('Import workbook', `<p>Import a MAHI workbook (the master file or a previous export). It is validated first, you see a preview, and nothing is replaced until you confirm.</p><input type="file" id="ximp" accept=".xlsx"><p class="muted small"><b>Important:</b> editing an exported Excel file does <b>not</b> sync automatically. Import the updated workbook here to bring those changes into the app.</p>`)}</div>
      <div class="grid g-2">${card('Backup & restore', `<p>Full JSON backup of everything stored in this browser (records, notes, tasks, achievements, notifications, settings, focus sessions).</p><div class="row-gap"><button class="btn" id="bk">Download backup</button><label class="btn ghost">Restore backup<input type="file" id="rs" accept=".json" hidden></label></div>`)}
      ${card('Storage', `${root.MAHI_SYNC && root.MAHI_SYNC.status !== 'local' ? `<p>Your work is saved to your private MAHI cloud account and synced across your devices (status: <b>${esc(root.MAHI_SYNC.detail)}</b>). A copy is cached in this browser${S.storageOk ? ' ✔' : ' – ⚠ browser cache unavailable'} for instant start and offline use.</p>` : `<p>Your work is <b>saved automatically in this browser</b> on this device${S.storageOk ? ' ✔' : ' – ⚠ browser storage is blocked, export now!'}. No login or account is used and nothing is uploaded.</p><p class="small"><b>Keep it safe:</b> clearing browser data, using private/incognito windows or another browser/device starts empty. Download a backup regularly (last backup: ${(() => { try { const t = Number(localStorage.getItem('mahi.lastBackup')); return t ? new Date(t).toLocaleString() : 'never'; } catch (e) { return 'unknown'; } })()}). To move to another device: Download backup here → Restore backup there.</p>`}<p class="muted small">Last change: ${S.state.history.length ? new Date(S.state.history[S.state.history.length - 1].ts).toLocaleString() : '—'}</p><button class="btn danger ghost" id="reset">Reset all data…</button>`)}</div>`;
    el.querySelector('#xexp').onclick = async () => {
      const b = el.querySelector('#xexp'); b.disabled = true; b.textContent = 'Building workbook…';
      try { const buf = await root.MAHI_WB.toBuffer(ExcelJS, S.state); UI.download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `VJ_Nathan_MAHI_Personal_Workflow_${S.today()}.xlsx`); UI.toast('Workbook exported', 'ok'); }
      catch (e) { console.error(e); UI.toast('Export failed: ' + e.message, 'bad'); }
      b.disabled = false; b.textContent = 'Export to Excel (.xlsx)';
    };
    el.querySelector('#ximp').onchange = async (e) => { const f = e.target.files[0]; if (f) await P.importWorkbook(f); e.target.value = ''; };
    el.querySelector('#bk').onclick = () => UI.download(new Blob([JSON.stringify(S.state)], { type: 'application/json' }), `MAHI_backup_${S.today()}.json`);
    el.querySelector('#rs').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return; e.target.value = '';
      try {
        const data = JSON.parse(await UI.readFile(f, 'text'));
        const v = D.validateAssets(data.assets || []);
        if (v.errors.length) return UI.modal('Backup not valid', `<p>${v.errors.length} problem(s):</p><ul>${v.errors.slice(0, 15).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
        const done = data.assets.filter(D.isDone).length;
        if (await UI.confirm('Restore backup?', `This backup has <b>${data.assets.length}</b> records (${done} completed), ${(data.notes || []).length} notes and ${(data.customTasks || []).length} personal tasks. It will <b>replace</b> all current app data.`, 'Replace with backup', true)) { S.replaceAll(data); UI.toast('Backup restored', 'ok'); }
      } catch (err) { UI.toast('Could not read backup: ' + err.message, 'bad'); }
    };
    el.querySelector('#reset').onclick = async () => {
      const v = await UI.modal('Reset all data', `<p>This permanently deletes all progress, notes, tasks, achievements and settings${root.MAHI_SYNC && root.MAHI_SYNC.status !== 'local' ? ' – in this browser <b>and in your cloud account</b> –' : ' saved in this browser'} and restores the initial plan (616 Not Started). <b>It cannot be undone.</b> Download a backup first if unsure.</p><label class="f"><span>Type RESET to confirm</span><input id="rz"></label>`, [{ label: 'Reset everything', cls: 'danger', value: (w) => w.querySelector('#rz').value }, { label: 'Cancel', value: null }]);
      if (v === 'RESET') { S.resetAll(); UI.toast('All data reset'); } else if (v != null) UI.toast('Reset cancelled – confirmation text did not match');
    };
  };
  P.importWorkbook = async (file) => {
    let res;
    try { res = await root.MAHI_WB.parse(ExcelJS, await UI.readFile(file)); } catch (e) { return UI.modal('Import failed', `<p>Could not read this file as an Excel workbook: ${esc(e.message)}</p>`); }
    const st = S.state;
    if (!res.assets) return UI.modal('Import failed', `<ul>${res.errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
    const cur = {}; st.assets.forEach((a) => { cur[a.id] = a; });
    const changed = res.assets.filter((a) => cur[a.id] && (cur[a.id].status !== a.status || cur[a.id].pubStatus !== a.pubStatus || cur[a.id].completionDate !== a.completionDate || cur[a.id].topic !== a.topic || cur[a.id].remarks !== a.remarks)).length;
    const cnt = (t) => res.assets.filter((a) => a.type === t).length;
    const body = `<div class="kpi-grid sm">${kpi('Records', res.assets.length)}${kpi('Posters', cnt('Poster'))}${kpi('AI videos', cnt('AI Video'))}${kpi('VJ videos', cnt('VJ Video'))}${kpi('Completed in file', res.assets.filter(D.isDone).length)}${kpi('Completed in app', st.assets.filter(D.isDone).length)}${kpi('Records that differ', changed)}${kpi('Notes / tasks', `${res.notes.length} / ${res.customTasks.length}`)}</div>
      ${res.errors.length ? `<div class="alert bad"><b>${res.errors.length} validation error(s) – import blocked:</b><ul>${res.errors.slice(0, 20).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<div class="alert ok">✔ Structure, content IDs, required fields, status values and duplicates all validated.</div>'}
      ${res.warnings.length ? `<div class="alert warn"><b>${res.warnings.length} warning(s):</b><ul>${res.warnings.slice(0, 10).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <p>Importing <b>replaces</b> the app's production records, publishing data, notes, personal tasks, campaigns and platform logs with the workbook's contents.</p>`;
    const ok = await UI.modal('Import preview', body, res.errors.length ? [{ label: 'Close', value: false }] : [{ label: 'Replace app data with this workbook', value: true, cls: 'danger' }, { label: 'Cancel', value: false }], { wide: true });
    if (!ok) return;
    const app = res.appState || {};
    const next = Object.assign({}, st, {
      assets: res.assets, notes: res.notes, customTasks: res.customTasks, platformLogs: res.platformLogs, campaigns: res.campaigns,
      settings: Object.assign({}, st.settings, app.settings || {}, res.settings, { ownerPic: res.settings.ownerPic || st.settings.ownerPic, logo: st.settings.logo, vjs: (res.settings.vjs || st.settings.vjs).map((v, i) => Object.assign({}, v, { pic: v.pic || (st.settings.vjs[i] || {}).pic || '' })) }),
      achievements: Object.assign({}, app.achievements || st.achievements, res.achievements),
      milestones: app.milestones || st.milestones, notifications: app.notifications || st.notifications, history: app.history || st.history,
      focusSessions: app.focusSessions || st.focusSessions, extraBrands: app.extraBrands || st.extraBrands, welcomed: true,
    });
    S.replaceAll(next);
    S.notify('import', 'Workbook imported', `${file.name} · ${res.assets.length} records`);
    UI.toast('Workbook imported', 'ok');
  };

  // ================= SETTINGS =================
  P.settings = (el) => {
    const s = S.state.settings;
    el.innerHTML = `<div class="page-h"><div><h2>Settings</h2><div class="muted">Changes apply immediately and are saved locally.</div></div></div>
      <div class="grid g-2">${card('Owner profile', `<div class="row-gap">${UI.avatar(s.ownerPic, s.owner, 'lg')}<label class="btn ghost small">Upload picture<input type="file" accept="image/*" id="op" hidden></label>${s.ownerPic ? '<button class="btn ghost small" id="opx">Remove</button>' : ''}</div>
        <label class="f"><span>Owner name</span><input data-s="owner" value="${esc(s.owner)}"></label><label class="f"><span>MAHI calls me</span><input data-s="callName" value="${esc(s.callName)}"></label><label class="f"><span>Organization</span><input data-s="organization" value="${esc(s.organization)}"></label><label class="f"><span>Department</span><input data-s="department" value="${esc(s.department)}"></label>
        <div class="row-gap"><span>Company logo</span>${s.logo ? `<img src="${esc(s.logo)}" alt="logo" style="height:34px">` : '<span class="muted small">none (original IGO logo can be uploaded – it is shown unmodified)</span>'}<label class="btn ghost small">Upload logo<input type="file" accept="image/*" id="lg" hidden></label>${s.logo ? '<button class="btn ghost small" id="lgx">Remove</button>' : ''}</div>`)}
      ${card('VJ members', s.vjs.map((v, i) => `<div class="vj-set">${UI.avatar(v.pic, v.name)}<label class="f"><span>${v.id} display name</span><input data-vj="${i}" value="${esc(v.name)}"></label><label class="btn ghost small">Photo<input type="file" accept="image/*" data-vjp="${i}" hidden></label><span class="muted small">${D.BRANDS.filter((b) => b.vjMember === v.id).map((b) => b.name).join(', ')}</span></div>`).join('') + '<p class="muted small">Renaming updates every tracker, board card, report and chart instantly.</p>')}</div>
      <div class="grid g-2">${card('Deadline alerts', `<p class="small">Alert thresholds (hours before the production deadline)</p><div class="row-gap">${s.thresholds.map((h, i) => `<input type="number" min="1" max="720" data-th="${i}" value="${h}" style="width:90px">`).join('')}<span class="muted small">h</span></div>`)}
      ${card('Appearance & MAHI', `<label class="f"><span>Theme</span><select data-s="theme">${UI.options([{ v: 'light', l: 'Light' }, { v: 'dark', l: 'Dark' }], s.theme)}</select></label>
        <label class="f"><span>Festival mode</span><select data-s="festivalMode">${UI.options([{ v: 'auto', l: 'Auto (follows current set)' }, { v: 'default', l: 'Default' }, { v: 'christmas', l: 'Christmas' }, { v: 'newyear', l: 'New Year' }, { v: 'pongal', l: 'Pongal' }], s.festivalMode)}</select></label>
        ${[['decor', 'Decorative MAHI activities (important notifications always stay on)'], ['reducedMotion', 'Reduced motion'], ['sound', 'Sound effects (off by default)'], ['mahiVisible', 'Show MAHI'], ['mahiPaused', 'Pause MAHI idle animations']].map(([k, l]) => `<label class="tog"><input type="checkbox" data-b="${k}" ${s[k] ? 'checked' : ''}> ${l}</label>`).join('')}`)}</div>`;
    el.querySelectorAll('[data-s]').forEach((i) => i.onchange = () => { S.setSettings({ [i.dataset.s]: i.value.trim() || s[i.dataset.s] }); UI.toast('Saved'); });
    el.querySelectorAll('[data-b]').forEach((i) => i.onchange = () => S.setSettings({ [i.dataset.b]: i.checked }));
    el.querySelectorAll('[data-vj]').forEach((i) => i.onchange = () => { const vjs = s.vjs.map((v, k) => (k === Number(i.dataset.vj) ? Object.assign({}, v, { name: i.value.trim() || v.id }) : v)); S.setSettings({ vjs }); UI.toast('VJ renamed everywhere'); });
    el.querySelectorAll('[data-th]').forEach((i) => i.onchange = () => { const th = s.thresholds.slice(); th[Number(i.dataset.th)] = Math.max(1, Number(i.value) || 24); S.setSettings({ thresholds: th }); });
    const img = async (input, cb) => { const f = input.files[0]; if (!f) return; cb(await UI.resizeImage(await UI.readFile(f, 'url'), 240)); };
    el.querySelector('#op').onchange = (e) => img(e.target, (u) => S.setSettings({ ownerPic: u }));
    el.querySelector('#lg').onchange = (e) => { const f = e.target.files[0]; if (f) UI.readFile(f, 'url').then((u) => S.setSettings({ logo: u })); };
    const opx = el.querySelector('#opx'); if (opx) opx.onclick = () => S.setSettings({ ownerPic: '' });
    const lgx = el.querySelector('#lgx'); if (lgx) lgx.onclick = () => S.setSettings({ logo: '' });
    el.querySelectorAll('[data-vjp]').forEach((i) => i.onchange = () => img(i, (u) => { const vjs = s.vjs.map((v, k) => (k === Number(i.dataset.vjp) ? Object.assign({}, v, { pic: u }) : v)); S.setSettings({ vjs }); }));
  };
})(window);

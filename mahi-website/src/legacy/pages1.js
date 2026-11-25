/* MAHI pages (part 1): Home, My Day, Workflow Board, Motion Workflow Chart, Campaigns, Sets, Brands, Production tables, VJ trackers. */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA, S = root.MAHI_STORE, CH = root.MAHI_CHARTS, UI = root.MAHI_UI;
  const esc = UI.esc, P = {};
  const card = (title, body, extra) => `<section class="card ${extra && extra.cls ? extra.cls : ''}"${extra && extra.route ? ` data-route="${extra.route}"` : ''}>${title ? `<div class="card-h"><h3>${title}</h3>${extra && extra.right ? extra.right : ''}</div>` : ''}${body}</section>`;
  const kpi = (label, value, sub, route, tone) => `<button class="kpi ${tone || ''}"${route ? ` data-route="${route}"` : ''}><span class="kpi-l">${esc(label)}</span><span class="kpi-v">${value}</span>${sub ? `<span class="kpi-s">${sub}</span>` : ''}</button>`;
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  const festModeOf = (m) => { const c = m.current; return c ? c.festival : null; };
  P.helpers = { card, kpi, greeting };

  // ================= HOME =================
  P.home = (el) => {
    const st = S.state, s = st.settings, m = S.metrics();
    const cur = m.current, cs = m.currentStats;
    const mode = s.boardMode || 'corporate';
    const festNext = D.FESTIVALS.find((f) => (f.dateEnd || f.date) >= m.today);
    const daysTo = festNext ? D.daysBetween(m.today, festNext.date) : null;
    const head = `<div class="hero">
      <div class="hero-id">${UI.avatar(s.ownerPic, s.owner, 'lg')}<div><div class="muted small">${greeting()}, ${esc(s.callName)} · ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div><h2>${esc(s.owner)}'s Command Center</h2>
      <div class="hero-chips">${cur ? `<span class="chip big" style="--c:${UI.festColor(cur.festival)}">Current: ${cur.label} · ${cur.festival}</span>` : '<span class="chip big">Festival phase complete</span>'}${cur && cur.compressed ? '<span class="chip big warn">⚠ Compressed schedule</span>' : ''}${festNext ? `<span class="chip big ghost">${esc(festNext.name)} in ${daysTo} day${daysTo === 1 ? '' : 's'}</span>` : ''}</div></div></div>
      <div class="seg" role="group" aria-label="View mode"><button data-mode="corporate" class="${mode === 'corporate' ? 'on' : ''}">Corporate Dashboard</button><button data-mode="cork" class="${mode === 'cork' ? 'on' : ''}">Digital Corkboard</button></div></div>`;
    el.innerHTML = head + (mode === 'cork' ? cork(m) : corporate(m));
    el.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => S.setSettings({ boardMode: b.dataset.mode }));
    const addSticky = el.querySelector('[data-addsticky]');
    if (addSticky) addSticky.onclick = async () => {
      const v = await UI.modal('New sticky note', '<label class="f"><span>Title</span><input id="sn-t"></label><label class="f"><span>Note</span><textarea id="sn-x" rows="3"></textarea></label>', [{ label: 'Pin it', value: (w) => ({ t: w.querySelector('#sn-t').value, x: w.querySelector('#sn-x').value }) }, { label: 'Cancel', value: null }]);
      if (v && (v.t || v.x)) S.addNote({ title: v.t || 'Sticky', text: v.x, pinned: true, category: 'Sticky' });
    };
  };

  function corporate(m) {
    const st = S.state, cur = m.current, cs = m.currentStats;
    const T = m.byType;
    const kpis = [
      kpi('Total Brands', D.BRANDS.length, 'confirmed', 'brands'), kpi('Total Sets', D.SETS.length, '27 Nov → 12 Jan', 'sets'), kpi('Overall Target', m.total, 'deliverables', 'production'),
      kpi('Completed Tasks', m.done, UI.pct(m.pct), 'production?done=1', 'good'), kpi('Pending Tasks', m.pending, 'remaining', 'production?done=0'), kpi('Overall Completion', UI.pct(m.pct), `${m.done}/${m.total}`, 'reports', 'good'),
      kpi('Poster Target', T['Poster'].target, `${T['Poster'].done} done`, 'posters'), kpi('AI Video Target', T['AI Video'].target, `${T['AI Video'].done} done`, 'ai'), kpi('VJ Video Target', T['VJ Video'].target, `${T['VJ Video'].done} done`, 'vj1'),
      kpi('Current Set Progress', cs ? UI.pct(cs.pct) : '—', cur ? `${cur.label} · ${cs.done}/${cs.target}` : '', cur ? 'sets?set=' + cur.code : 'sets'),
      kpi("Today's Tasks", m.todayActive.length + m.customToday.length, `${m.todayActive.length} production · ${m.customToday.length} personal`, 'myday'),
      kpi("Today's Completed", m.todayCompleted.length + m.customTodayDone.length, 'completed today', 'myday', 'good'),
      kpi("Today's Pending", m.todayPending.length + (m.customToday.length - m.customTodayDone.length), 'still open today', 'myday'),
      kpi('Upcoming Deadlines', m.dueSoon.length, `within ${Math.max(...st.settings.thresholds)}h`, 'production?flag=DUE', m.dueSoon.length ? 'warn' : ''),
      kpi('Overdue Assignments', m.overdue.length, m.overdue.length ? 'needs attention' : 'none', 'production?flag=OVERDUE', m.overdue.length ? 'bad' : ''),
      kpi('Waiting for Approval', m.underReview.length, 'Under Review', 'board?status=Under Review', m.underReview.length ? 'info' : ''),
      kpi('Scheduled Content', m.scheduled.length, 'publishing', 'calendar'), kpi('Published Content', m.published.length, 'live', 'calendar', 'good'),
    ].join('');
    const fests = D.FESTIVALS.map((f) => {
      const x = m.byFestival[f.name];
      const types = D.CONTENT_TYPES.map((t) => { const g = S.state.assets.filter((a) => a.festival === f.name && a.type === t); const d = g.filter(D.isDone).length; return `<div class="mini"><span>${t}s</span><b>${d}/${g.length}</b></div>`; }).join('');
      return `<button class="fest-card" data-route="campaigns?f=${encodeURIComponent(f.name)}" style="--c1:${f.colors[0]};--c2:${f.colors[1]}">${CH.ring(x.pct, f.colors[0], 74)}<div class="fc-b"><div class="fc-t">${f.name}</div><div class="muted small">${f.dateLabel} · ${f.sets} set${f.sets > 1 ? 's' : ''}</div><div class="fc-n"><b>${x.done}</b> / ${x.target} completed · ${x.pending} pending</div><div class="minis">${types}</div></div></button>`;
    }).join('');
    const vjs = st.settings.vjs.map((v, i) => {
      const x = m.byVJ[v.id] || { target: 0, done: 0, pending: 0, overdue: 0, pct: 0 };
      return `<button class="vj-card" data-route="vj${i + 1}">${UI.avatar(v.pic, v.name)}<div class="vj-b"><div class="vj-t">${esc(v.name)} <span class="muted small">${v.id}</span></div><div class="muted small">${D.BRANDS.filter((b) => b.vjMember === v.id).map((b) => b.name).join(' · ')}</div>${CH.progress(x.pct, '#7E57C2')}<div class="vj-n"><span>${x.done}/${x.target} done</span><span>${x.pending} pending</span><span class="${x.overdue ? 'bad-t' : ''}">${x.overdue} overdue</span></div></div></button>`;
    }).join('');
    const setBars = CH.vbars(D.SETS.map((s) => ({ label: s.label.replace('Set ', 'S'), value: m.bySet[s.code].pct, color: UI.festColor(s.festival), click: 'sets?set=' + s.code, title: `${s.label} ${s.festival}: ${m.bySet[s.code].done}/${m.bySet[s.code].target}` })), { pct: true, max: 1 });
    // brands needing attention (current set)
    let attention = '';
    if (cur) {
      const rows = D.BRANDS.map((b) => ({ b, x: m.byBrandSet[cur.code + '|' + b.name] })).sort((a, b) => (b.x.overdue - a.x.overdue) || (a.x.pct - b.x.pct)).slice(0, 6);
      attention = rows.map(({ b, x }) => `<div class="att-row" data-route="production?set=${cur.code}&brand=${encodeURIComponent(b.name)}"><span>${esc(b.name)}</span>${CH.progress(x.pct, x.overdue ? '#D32F2F' : '#2E9E4F')}<span class="small ${x.overdue ? 'bad-t' : 'muted'}">${x.done}/${x.target}${x.overdue ? ` · ${x.overdue} overdue` : ''}</span></div>`).join('');
    }
    const upcoming = S.state.assets.filter((a) => !D.isDone(a) && a.deadline >= m.today).reduce((acc, a) => { const k = a.set; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const upList = Object.keys(upcoming).slice(0, 4).map((k) => { const s = D.setByCode(k); const d = D.daysBetween(m.today, s.end); return `<div class="dl-row" data-route="sets?set=${k}"><b>${s.label}</b><span>${s.festival}</span><span>${upcoming[k]} pending</span><span class="chip ${d <= 1 ? 'flag over' : d <= 3 ? 'flag due' : ''}">${UI.fmt(s.end)} · ${d < 0 ? 'passed' : d + 'd left'}</span></div>`; }).join('') || '<p class="muted">No upcoming production deadlines.</p>';
    const csCard = cur ? `<div class="cur-set"><div class="cs-top"><div><div class="muted small">${cur.festival} campaign</div><div class="cs-t">${cur.label}</div><div class="small">Production ${UI.fmt(cur.start)} → ${UI.fmt(cur.end)}${cur.compressed ? ' · <b class="bad-t">COMPRESSED</b>' : ''}</div></div>${CH.ring(cs.pct, UI.festColor(cur.festival), 80)}</div>${D.CONTENT_TYPES.map((t) => { const g = S.state.assets.filter((a) => a.set === cur.code && a.type === t); const d = g.filter(D.isDone).length; return `<div class="typerow"><span>${t}s</span>${CH.progress(g.length ? d / g.length : 0, UI.typeColor(t))}<b>${d}/${g.length}</b></div>`; }).join('')}<div class="small muted">Publishing window ${UI.fmt(S.state.settings.pubWindows[cur.code].start)} → ${UI.fmt(S.state.settings.pubWindows[cur.code].end)}</div></div>` : '<p>All confirmed sets have ended. Add new campaigns in Annual Workflow.</p>';
    return `<div class="kpi-grid">${kpis}</div>
    <div class="grid g-3-2">${card('Festival Campaign Progress', `<div class="fest-row">${fests}</div>`)}${card('Overall Production Progress', CH.donut([{ label: 'Completed', value: m.done, color: '#2E9E4F', click: 'production?done=1' }, { label: 'Pending', value: m.pending, color: '#C9CFD6', click: 'production?done=0' }], { center: UI.pct(m.pct), sub: `${m.done} / ${m.total}` }))}</div>
    <div class="grid g-2">${card('Current Production Set', csCard, { route: cur ? 'sets?set=' + cur.code : 'sets' })}${card('VJ Monitoring', `<div class="vj-col">${vjs}</div>`)}</div>
    <div class="grid g-3">${card('Seven-Set Completion', setBars)}${card(cur ? `Brands needing attention · ${cur.label}` : 'Brands', attention || '<p class="muted">—</p>')}${card('Upcoming Deadlines', upList)}</div>`;
  }

  function cork(m) {
    const st = S.state;
    const pin = (inner, cls, route, rot) => `<div class="pinned ${cls || ''}"${route ? ` data-route="${route}"` : ''} style="--r:${rot || 0}deg"><i class="pin"></i>${inner}</div>`;
    const festCards = D.FESTIVALS.map((f, i) => { const x = m.byFestival[f.name]; return pin(`<div class="pc-t" style="color:${f.colors[0]}">${f.name} Campaign</div><div class="small">${f.dateLabel}</div><div class="small">Production ${UI.fmt(f.prodStart)} → ${UI.fmt(f.prodEnd)}</div><div class="pc-big">${x.done}/${x.target}</div>${CH.progress(x.pct, f.colors[0])}`, 'paper', `campaigns?f=${encodeURIComponent(f.name)}`, [-2, 1.5, -1][i]); }).join('');
    const timelines = D.FESTIVALS.map((f) => `<div class="tl-strip"><b style="color:${f.colors[0]}">${f.name}</b>${D.SETS.filter((s) => s.festival === f.name).map((s) => { const x = m.bySet[s.code]; return `<span class="tl-card ${s.compressed ? 'comp' : ''}" data-route="sets?set=${s.code}" title="${s.label}: ${UI.fmt(s.start)} → ${UI.fmt(s.end)}">${s.label}<small>${UI.fmt(s.start).slice(0, 5)}–${UI.fmt(s.end).slice(0, 5)}</small><em>${UI.pct(x.pct)}</em></span>`; }).join('<i class="tl-arrow">→</i>')}</div>`).join('');
    const sets = D.SETS.map((s, i) => { const x = m.bySet[s.code]; return pin(`<div class="pc-t">${s.label}</div><div class="small">${s.festival}${s.compressed ? ' · ⚠ compressed' : ''}</div><div class="small">${UI.fmt(s.start)} → ${UI.fmt(s.end)}</div><div class="pc-big">${x.done}/${x.target}</div>${CH.progress(x.pct, '#1B5E20')}${x.overdue ? `<div class="bad-t small">${x.overdue} overdue</div>` : ''}`, 'sticky s' + (i % 4), 'sets?set=' + s.code, ((i * 37) % 7) - 3); }).join('');
    const brandTbl = `<table class="mini-t"><thead><tr><th>Brand</th><th>P</th><th>AI</th><th>VJ</th><th>Done</th></tr></thead><tbody>${D.BRANDS.map((b) => { const x = m.byBrand[b.name]; return `<tr data-route="production?brand=${encodeURIComponent(b.name)}"><td>${esc(b.name)}</td><td>${b.posters}</td><td>${b.ai}</td><td>${b.vj}</td><td>${x.done}/${x.target}</td></tr>`; }).join('')}</tbody></table>`;
    const totals = pin(`<div class="pc-t">Festival Totals</div><div class="tot"><span style="color:#2E9E4F">Posters <b>${m.byType['Poster'].done}/434</b></span><span style="color:#1E6FD9">AI Videos <b>${m.byType['AI Video'].done}/98</b></span><span style="color:#7E57C2">VJ Videos <b>${m.byType['VJ Video'].done}/84</b></span><span>All <b>${m.done}/${m.total}</b></span></div>`, 'paper', 'reports', 1.5);
    const vjs = st.settings.vjs.map((v, i) => { const x = m.byVJ[v.id]; return pin(`<div class="pc-t">${UI.avatar(v.pic, v.name, 'sm')} ${esc(v.name)}</div><div class="small">${D.BRANDS.filter((b) => b.vjMember === v.id).map((b) => b.name).join(', ')}</div><div class="pc-big">${x.done}/${x.target}</div>${CH.progress(x.pct, '#7E57C2')}`, 'index', 'vj' + (i + 1), [2, -1.5, 1][i]); }).join('');
    const dl = pin(`<div class="pc-t">⏰ Deadline reminders</div>${m.overdue.length ? `<div class="bad-t"><b>${m.overdue.length}</b> overdue</div>` : '<div>No overdue work</div>'}<div><b>${m.dueSoon.length}</b> due soon</div>${m.current ? `<div class="small">${m.current.label} deadline ${UI.fmt(m.current.end)}</div>` : ''}`, 'sticky s3', 'production?flag=OVERDUE', -2.5);
    const weekStart = D.addDays(m.today, -((new Date().getDay() + 6) % 7));
    const weekDone = st.assets.filter((a) => D.isDone(a) && a.completionDate >= weekStart && a.completionDate <= m.today).length;
    const weekPub = st.assets.filter((a) => a.pubStatus === 'Published' && a.pubDate >= weekStart && a.pubDate <= m.today).length;
    const weekAch = Object.values(st.achievements).filter((d) => String(d).slice(0, 10) >= weekStart).length;
    const ach = pin(`<div class="pc-t">🏅 This week</div><div>Completed <b>${weekDone}</b></div><div>Published <b>${weekPub}</b></div><div>Achievements unlocked <b>${weekAch}</b></div>`, 'paper gold', 'achievements', 2);
    const stickies = st.notes.filter((n) => n.pinned).slice(0, 6).map((n, i) => pin(`<div class="pc-t">${esc(n.title || 'Note')}</div><div class="small pre">${esc(n.text)}</div>`, 'sticky s' + ((i + 1) % 4), 'notes', ((i * 53) % 7) - 3)).join('');
    return `<div class="corkboard"><div class="cork-title">FESTIVAL MASTER WORKFLOW BOARD <span>IGO Digital Marketing · ${esc(st.settings.owner)}</span></div>
      <div class="cork-row">${festCards}${totals}</div>
      <div class="cork-row timelines">${timelines}</div>
      <div class="cork-row">${sets}</div>
      <div class="cork-row">${pin(`<div class="pc-t">Brand Production Table (per set)</div>${brandTbl}`, 'paper wide', 'brands', -0.5)}<div class="cork-col">${vjs}</div><div class="cork-col">${dl}${ach}</div></div>
      <div class="cork-row">${stickies}<button class="pinned sticky s1 add" data-addsticky style="--r:2deg"><i class="pin"></i>+ Add sticky note</button></div></div>`;
  }

  // ================= MY DAY =================
  const myDayState = { date: null };
  P.myday = (el) => {
    const st = S.state, t = myDayState.date || S.today();
    const m = S.metrics();
    const isToday = t === S.today();
    const active = st.assets.filter((a) => a.prodStart <= t && a.deadline >= t);
    const activeOpen = active.filter((a) => !D.isDone(a));
    const prevPending = st.assets.filter((a) => a.deadline < t && !D.isDone(a));
    const upcoming = st.assets.filter((a) => !D.isDone(a) && a.deadline > t && D.daysBetween(t, a.deadline) <= 3);
    const high = st.assets.filter((a) => !D.isDone(a) && a.priority === 'High');
    const doneToday = st.assets.filter((a) => D.isDone(a) && a.completionDate === t);
    const tasks = st.customTasks.filter((x) => x.date === t).sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]));
    const tasksDone = tasks.filter((x) => x.status === 'Completed');
    const planned = active.length + tasks.length, completed = active.filter(D.isDone).length + tasksDone.length;
    const pct = planned ? completed / planned : 0;
    const list = (arr, empty, max) => arr.length ? `<div class="alist">${arr.slice(0, max || 12).map((a) => `<div class="arow"><button class="chk" data-done="${a.id}" title="Mark Completed" aria-label="Mark ${a.id} completed">${D.isDone(a) ? '✔' : ''}</button><span class="arow-id" data-edit="${a.id}">${esc(a.id)}</span>${UI.typeChip(a.type)}<span class="muted small">${esc(a.brand)}</span>${UI.statusChip(a.status)}${UI.flagChip(a.__flag || D.deadlineFlag(a, new Date(), st.settings.thresholds))}</div>`).join('')}${arr.length > (max || 12) ? `<button class="link" data-route="production?active=${t}">+ ${arr.length - (max || 12)} more…</button>` : ''}</div>` : `<p class="muted">${empty}</p>`;
    const byType = (tp) => activeOpen.filter((a) => a.type === tp);
    const notes = st.notes.slice(0, 4);
    el.innerHTML = `<div class="page-h"><div><h2>MY DAY</h2><div class="muted">${new Date(t.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${isToday ? ' · today' : ''}</div></div>
      <div class="row-gap"><button class="btn ghost" data-shift="-1">◀</button><input type="date" id="md-date" value="${t}"><button class="btn ghost" data-shift="1">▶</button><button class="btn ghost" data-today>Today</button><button class="btn" data-summary>MAHI summary</button></div></div>
      <div class="kpi-grid sm">${kpi('Planned today', planned, `${active.length} production · ${tasks.length} personal`)}${kpi('Completed', completed, '', null, 'good')}${kpi('Remaining', planned - completed)}${kpi('Daily completion', UI.pct(pct), '', null, 'good')}${kpi('Previous pending', prevPending.length, 'overdue', 'production?flag=OVERDUE', prevPending.length ? 'bad' : '')}${kpi('Due in 3 days', upcoming.length, '', 'production?flag=DUE')}</div>
      ${CH.progress(pct, '#2E9E4F', `${completed}/${planned} done`)}
      <div class="grid g-3">${card(`<span style="color:#2E9E4F">●</span> Poster assignments (${byType('Poster').length})`, list(byType('Poster'), 'No open poster work in production today.'))}${card(`<span style="color:#1E6FD9">●</span> AI video assignments (${byType('AI Video').length})`, list(byType('AI Video'), 'No open AI video work in production today.'))}${card(`<span style="color:#7E57C2">●</span> VJ video assignments (${byType('VJ Video').length})`, list(byType('VJ Video'), 'No open VJ video work in production today.'))}</div>
      <div class="grid g-2">${card('My personal tasks', `<form class="task-add" id="task-add"><input name="title" placeholder="Add a personal task…" required><select name="priority">${UI.options(D.PRIORITIES, 'Medium')}</select><input name="reminder" type="time" title="Reminder time"><input name="linkedId" placeholder="Link Content ID (optional)" list="ids-dl"><button class="btn">Add</button></form>
        <p class="muted small">Personal tasks are tracked separately and never change the ${st.assets.length}-deliverable festival target.</p>
        <div class="tlist">${tasks.map((x) => `<div class="trow ${x.status === 'Completed' ? 'done' : ''}"><button class="chk" data-tdone="${x.id}" aria-label="Toggle task">${x.status === 'Completed' ? '✔' : ''}</button><span class="pri ${x.priority}">${x.priority}</span><span class="tt">${esc(x.title)}${x.linkedId ? ` <span class="link" data-edit="${esc(x.linkedId)}">${esc(x.linkedId)}</span>` : ''}${x.reminder ? ` <span class="muted small">⏰ ${esc(x.reminder)}</span>` : ''}</span><input type="date" value="${x.date}" data-tmove="${x.id}" title="Move to another day"><button class="icon-btn" data-tmovenext="${x.id}" title="Move to next day">⏭</button><button class="icon-btn" data-tdel="${x.id}" title="Delete" aria-label="Delete task">🗑</button></div>`).join('') || '<p class="muted">No personal tasks for this day.</p>'}</div>`)}
      ${card('Upcoming deadlines & priorities', `<h4>Previous days' pending (${prevPending.length})</h4>${list(prevPending, 'Nothing pending from earlier days. 🎉', 6)}<h4>High priority (${high.length})</h4>${list(high, 'No high-priority items. Set priority in the asset editor.', 6)}<h4>Due within 3 days (${upcoming.length})</h4>${list(upcoming, 'No deadlines in the next 3 days.', 6)}`)}</div>
      <div class="grid g-2">${card(`Completed on this day (${doneToday.length})`, list(doneToday, 'Nothing completed yet on this day.', 10))}${card('Personal notes', `<form id="note-quick" class="task-add"><input name="text" placeholder="Quick note…" required><button class="btn">Save</button></form>${notes.map((n) => `<div class="note-mini"><b>${esc(n.title || UI.fmt(n.date))}</b> ${esc(n.text).slice(0, 140)}</div>`).join('') || '<p class="muted">No notes yet.</p>'}<button class="link" data-route="notes">Open all notes →</button>`)}</div>
      <datalist id="ids-dl">${st.assets.filter((a) => !D.isDone(a)).slice(0, 400).map((a) => `<option value="${a.id}">`).join('')}</datalist>`;
    const setDate = (d) => { myDayState.date = d; P.myday(el); };
    el.querySelector('#md-date').onchange = (e) => setDate(e.target.value || S.today());
    el.querySelectorAll('[data-shift]').forEach((b) => b.onclick = () => setDate(D.addDays(t, Number(b.dataset.shift))));
    el.querySelector('[data-today]').onclick = () => setDate(S.today());
    el.querySelector('[data-summary]').onclick = () => root.MAHI_APP.dailySummary(true);
    el.querySelector('#task-add').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); S.addCustomTask({ title: f.get('title'), priority: f.get('priority'), reminder: f.get('reminder'), linkedId: f.get('linkedId'), date: t }); };
    el.querySelector('#note-quick').onsubmit = (e) => { e.preventDefault(); S.addNote({ text: new FormData(e.target).get('text'), title: 'Quick note' }); UI.toast('Note saved'); };
    el.onclick = (e) => {
      const x = e.target;
      if (x.dataset.done) { const a = S.asset(x.dataset.done); UI.changeAssets([a.id], { status: D.isDone(a) ? 'In Progress' : 'Completed' }); }
      if (x.dataset.tdone) { const tk = st.customTasks.find((k) => k.id === x.dataset.tdone); S.updateCustomTask(tk.id, { status: tk.status === 'Completed' ? 'Pending' : 'Completed' }); }
      if (x.dataset.tmovenext) { const tk = st.customTasks.find((k) => k.id === x.dataset.tmovenext); S.updateCustomTask(tk.id, { date: D.addDays(tk.date, 1), status: tk.status === 'Completed' ? 'Completed' : 'Pending' }); UI.toast('Moved to next day'); }
      if (x.dataset.tdel) UI.confirm('Delete task', 'Delete this personal task?', 'Delete', true).then((ok) => ok && S.deleteCustomTask(x.dataset.tdel));
    };
    el.querySelectorAll('[data-tmove]').forEach((i) => i.onchange = () => { S.updateCustomTask(i.dataset.tmove, { date: i.value }); UI.toast('Task moved to ' + UI.fmt(i.value)); });
  };

  // ================= FILTER BAR (shared) =================
  function filterBar(f, keys, onChange, id) {
    const st = S.state;
    const ctl = {
      festival: () => `<select data-f="festival" aria-label="Festival">${UI.options(D.FESTIVALS.map((x) => x.name), f.festival, 'All festivals')}</select>`,
      set: () => `<select data-f="set" aria-label="Set">${UI.options(D.SETS.map((s) => ({ v: s.code, l: s.label + ' · ' + s.festival })), f.set, 'All sets')}</select>`,
      brand: () => `<select data-f="brand" aria-label="Brand">${UI.options(D.BRANDS.map((b) => b.name), f.brand, 'All brands')}</select>`,
      type: () => `<select data-f="type" aria-label="Content type">${UI.options(D.CONTENT_TYPES, f.type, 'All types')}</select>`,
      vj: () => `<select data-f="vj" aria-label="VJ">${UI.options(st.settings.vjs.map((v) => ({ v: v.id, l: v.name })), f.vj, 'All VJs')}</select>`,
      priority: () => `<select data-f="priority" aria-label="Priority">${UI.options(D.PRIORITIES, f.priority, 'All priorities')}</select>`,
      flag: () => `<select data-f="flag" aria-label="Deadline">${UI.options([{ v: 'OVERDUE', l: 'Overdue' }, { v: 'DUE', l: 'Due soon' }, { v: 'On Track', l: 'On track' }, { v: 'Done', l: 'Done' }], f.flag, 'Any deadline')}</select>`,
      status: () => `<select data-f="status" aria-label="Status">${UI.options(D.PROD_STATUSES, f.status, 'All statuses')}</select>`,
      pubStatus: () => `<select data-f="pubStatus" aria-label="Publishing status">${UI.options(D.PUB_STATUSES, f.pubStatus, 'Any publishing')}</select>`,
      q: () => `<input data-f="q" id="${id}-q" type="search" placeholder="Search ID, brand, topic…" value="${esc(f.q || '')}">`,
    };
    return `<div class="filters" data-fbar="${id}">${keys.map((k) => ctl[k]()).join('')}<button class="btn ghost small" data-freset>Reset</button></div>`;
  }
  function bindFilters(el, f, rerender, id) {
    const bar = el.querySelector(`[data-fbar="${id}"]`); if (!bar) return;
    bar.querySelectorAll('[data-f]').forEach((c) => { c.addEventListener(c.tagName === 'INPUT' ? 'input' : 'change', () => { f[c.dataset.f] = c.value; f.page = 0; rerender(); }); });
    bar.querySelector('[data-freset]').onclick = () => { Object.keys(f).forEach((k) => { if (!k.startsWith('_')) delete f[k]; }); rerender(); };
  }
  function applyFilters(list, f) {
    const q = (f.q || '').toLowerCase();
    return list.filter((a) => (!f.festival || a.festival === f.festival) && (!f.set || a.set === f.set) && (!f.brand || a.brand === f.brand) && (!f.type || a.type === f.type)
      && (!f.vj || a.vj === f.vj) && (!f.priority || a.priority === f.priority) && (!f.status || a.status === f.status) && (!f.pubStatus || a.pubStatus === f.pubStatus)
      && (!f.flag || (f.flag === 'DUE' ? (a.__flag || '').startsWith('DUE') : a.__flag === f.flag))
      && (f.done == null || f.done === '' || (f.done === '1') === D.isDone(a))
      && (!f.stage || a.__stage === f.stage)
      && (!f.active || (a.prodStart <= f.active && a.deadline >= f.active))
      && (!q || (a.id + ' ' + a.brand + ' ' + a.topic + ' ' + a.concept + ' ' + a.remarks).toLowerCase().includes(q)));
  }
  P.applyFilters = applyFilters; P.filterBar = filterBar; P.bindFilters = bindFilters;

  // ================= WORKFLOW BOARD (Kanban) =================
  const boardF = {};
  P.board = (el, params) => {
    if (params.status && !boardF._init) { boardF.status = params.status; boardF._init = 1; }
    S.metrics();
    const items = applyFilters(S.state.assets, boardF);
    const cols = {}; D.KANBAN_COLUMNS.forEach((c) => { cols[c] = []; });
    items.forEach((a) => cols[D.kanbanColumn(a)].push(a));
    boardF._show = boardF._show || {};
    el.innerHTML = `<div class="page-h"><div><h2>My Workflow Board</h2><div class="muted">${items.length} of ${S.state.assets.length} assets · drag a card to update its real production record</div></div></div>
      ${filterBar(boardF, ['q', 'festival', 'set', 'brand', 'type', 'vj', 'priority', 'flag', 'status'], null, 'board')}
      <div class="kanban">${D.KANBAN_COLUMNS.map((c) => { const list = cols[c]; const lim = boardF._show[c] || 40; return `<div class="kcol" data-col="${c}"><div class="kcol-h" style="--c:${D.STATUS_COLORS[c === 'In Production' ? 'In Progress' : c === 'Content Ready' ? 'Content Ready' : c] || '#9E9E9E'}"><span>${c}</span><b>${list.length}</b></div><div class="kcol-b">${list.slice(0, lim).map(kcard).join('')}${list.length > lim ? `<button class="link" data-more="${c}">Show ${Math.min(40, list.length - lim)} more…</button>` : ''}</div></div>`; }).join('')}</div>`;
    bindFilters(el, boardF, () => P.board(el, {}), 'board');
    el.querySelectorAll('[data-more]').forEach((b) => b.onclick = () => { boardF._show[b.dataset.more] = (boardF._show[b.dataset.more] || 40) + 40; P.board(el, {}); });
    el.querySelectorAll('.kcard').forEach((c) => { c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('dragging'); }); c.addEventListener('dragend', () => c.classList.remove('dragging')); });
    el.querySelectorAll('.kcol').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', async (e) => {
        e.preventDefault(); col.classList.remove('over');
        const id = e.dataTransfer.getData('text/plain'); const a = S.asset(id); if (!a) return;
        const target = col.dataset.col; if (D.kanbanColumn(a) === target) return;
        const patch = Object.assign({}, D.KANBAN_DROP[target]);
        if (!patch.pubStatus && a.pubStatus !== 'Not Scheduled') {
          if (a.pubStatus === 'Published' && !(await UI.confirm('Move published content?', `${esc(id)} is already Published. Moving it back to "${esc(target)}" resets its publishing status to Not Scheduled. Continue?`, 'Move'))) return;
          patch.pubStatus = 'Not Scheduled';
        }
        if (await UI.changeAssets([id], patch)) UI.toast(`${id} → ${target}`);
      });
    });
  };
  function kcard(a) {
    const pri = a.priority || 'Medium';
    return `<div class="kcard" draggable="true" data-id="${a.id}" data-edit="${a.id}" style="--tc:${UI.typeColor(a.type)}"><div class="kc-top"><b>${esc(a.id)}</b><span class="pri ${pri}">${pri}</span></div><div class="kc-b">${esc(a.brand)}</div><div class="kc-m"><span style="color:${UI.festColor(a.festival)}">${esc(a.festival)}</span> · ${UI.setLabel(a.set)} · ${UI.typeChip(a.type)}</div><div class="kc-m">${a.vj ? '🎬 ' + esc(UI.vjName(a.vj)) : '👤 ' + esc(S.state.settings.owner)} · due ${UI.fmt(a.deadline)}</div><div class="kc-f">${UI.statusChip(a.status)} ${a.__flag === 'OVERDUE' || (a.__flag || '').startsWith('DUE') ? UI.flagChip(a.__flag) : ''}</div></div>`;
  }

  // ================= MOTION WORKFLOW CHART =================
  P.flow = (el) => {
    const m = S.metrics(); const A = S.state.assets;
    const cnt = (type, stage) => m.byStage[type + '|' + stage] || 0;
    const over = (type, stage) => A.filter((a) => a.type === type && a.__stage === stage && a.__flag === 'OVERDUE').length;
    const typeTotal = (t) => A.filter((a) => a.type === t).length;
    const W = 1000;
    const nodes = [], edges = [];
    const node = (id, label, x, y, count, state, filter, w) => { nodes.push({ id, label, x, y, count, state, filter, w: w || 210 }); return id; };
    const stateOf = (count, overdue, beyondAll) => overdue > 0 ? 'overdue' : count > 0 ? 'active' : beyondAll ? 'done' : 'pending';
    const firstStages = ['Poster Topic', 'Video Concept', 'VJ Assignment'];
    const prep = ['Content Writing', 'Script Writing', 'Script Preparation'];
    const appr = ['Script Approval', 'AI Prompt Creation'];
    const sumStages = (list) => list.reduce((s, st) => s + D.CONTENT_TYPES.reduce((x, t) => x + cnt(t, st), 0), 0);
    const overStages = (list) => A.filter((a) => list.includes(a.__stage) && a.__flag === 'OVERDUE').length;
    const done = m.done, total = m.total;
    const y0 = 40;
    node('fp', 'FESTIVAL PLANNING', 500, y0, total, done === total ? 'done' : 'active', '', 260);
    const bcpC = sumStages(firstStages), cspC = sumStages(prep), caC = sumStages(appr);
    const beyondPrepAll = A.every((a) => ![...firstStages].includes(a.__stage));
    node('bcp', 'BRAND CONTENT PLANNING', 500, y0 + 75, bcpC, stateOf(bcpC, overStages(firstStages), beyondPrepAll), 'stage=' + firstStages.join(','), 260);
    node('csp', 'CONTENT AND SCRIPT PREPARATION', 500, y0 + 150, cspC, stateOf(cspC, overStages(prep), A.every((a) => ![...firstStages, ...prep].includes(a.__stage))), 'stage=' + prep.join(','), 300);
    node('ca', 'CONCEPT APPROVAL', 500, y0 + 225, caC, stateOf(caC, overStages(appr), A.every((a) => ![...firstStages, ...prep, ...appr].includes(a.__stage))), 'stage=' + appr.join(','), 260);
    edges.push(['fp', 'bcp'], ['bcp', 'csp'], ['csp', 'ca']);
    const bx = { 'Poster': 170, 'AI Video': 500, 'VJ Video': 830 };
    const by = y0 + 330, gap = 72;
    const lastOf = {};
    Object.keys(D.BRANCH_STAGES).forEach((t) => {
      const stages = D.BRANCH_STAGES[t];
      const tot = typeTotal(t);
      let prev = 'ca';
      stages.forEach((stg, i) => {
        const c = cnt(t, stg), o = stg === 'Final Approval' ? 0 : over(t, stg);
        const beyond = i === stages.length - 1 ? c === tot : stages.slice(0, i + 1).every((x) => cnt(t, x) === 0);
        const id = t + i;
        const yy = t === 'Poster' ? by + i * gap * (7 / 4) : by + i * gap;
        node(id, stg, bx[t], yy, c, stateOf(c, o, beyond), `type=${t}&stage=${stg}`, 200);
        edges.push([prev, id]); prev = id;
      });
      lastOf[t] = prev;
    });
    const my = by + 7 * gap + 80;
    node('merge', 'ALL THREE BRANCHES MERGE', 500, my, done, done === total ? 'done' : done > 0 ? 'active' : 'pending', 'done=1', 280);
    Object.values(lastOf).forEach((l) => edges.push([l, 'merge']));
    const handover = A.filter((a) => D.isDone(a) && a.pubStatus === 'Not Scheduled').length;
    const weekStart = D.addDays(m.today, -((new Date().getDay() + 6) % 7));
    const weekly = A.filter((a) => a.pubStatus === 'Published' && a.pubDate >= weekStart && a.pubDate <= D.addDays(weekStart, 6)).length;
    const pubN = m.published.length;
    const post = [['handover', 'FINAL CONTENT HANDOVER', handover, 'done=1&pubStatus=Not Scheduled'], ['sched', 'SOCIAL MEDIA SCHEDULING', m.scheduled.length, 'pubStatus=Scheduled'], ['pub', 'PUBLISHING', pubN, 'pubStatus=Published'], ['perf', 'PERFORMANCE MONITORING', pubN, 'pubStatus=Published'], ['week', 'WEEKLY REPORT', weekly, 'pubStatus=Published']];
    let prev = 'merge';
    post.forEach(([id, l, c, f], i) => { node(id, l, 500, my + 75 * (i + 1), c, c > 0 ? (i >= 2 && pubN === total ? 'done' : 'active') : 'pending', f, 260); edges.push([prev, id]); prev = id; });
    const H = my + 75 * post.length + 60;
    const byId = {}; nodes.forEach((n) => { byId[n.id] = n; });
    const edgeSvg = edges.map(([a, b], i) => {
      const A1 = byId[a], B1 = byId[b];
      const x1 = A1.x, y1 = A1.y + 22, x2 = B1.x, y2 = B1.y - 22;
      const my2 = (y1 + y2) / 2;
      const d = x1 === x2 ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} C${x1} ${my2} ${x2} ${my2} ${x2} ${y2}`;
      const live = B1.count > 0 && B1.state !== 'done';
      return `<path id="e${i}" class="edge ${live ? 'live' : ''} ${B1.state}" d="${d}"/>${live ? `<circle r="4" class="particle"><animateMotion dur="${2 + (i % 3) * 0.4}s" repeatCount="indefinite" begin="${(i % 5) * 0.3}s"><mpath href="#e${i}"/></animateMotion></circle>` : ''}`;
    }).join('');
    const nodeSvg = nodes.map((n) => `<g class="fnode ${n.state}" data-node="${esc(n.filter)}" data-label="${esc(n.label)}" tabindex="0" role="button" aria-label="${esc(n.label)}: ${n.count} tasks, ${n.state}"><rect x="${n.x - n.w / 2}" y="${n.y - 22}" width="${n.w}" height="44" rx="12"/><text x="${n.x - n.w / 2 + 14}" y="${n.y + 5}" class="fn-l">${esc(n.label)}</text><g class="fn-badge"><rect x="${n.x + n.w / 2 - 50}" y="${n.y - 13}" width="40" height="26" rx="13"/><text x="${n.x + n.w / 2 - 30}" y="${n.y + 5}" text-anchor="middle">${n.count}</text></g></g>`).join('');
    const branchHeads = Object.keys(bx).map((t) => `<text x="${bx[t]}" y="${by - 40}" text-anchor="middle" class="branch-h" fill="${UI.typeColor(t)}">${t === 'Poster' ? 'BRANCH 01 · POSTER' : t === 'AI Video' ? 'BRANCH 02 · AI VIDEO' : 'BRANCH 03 · VJ VIDEO'} (${typeTotal(t)})</text>`).join('');
    // bottlenecks
    const mids = []; Object.keys(D.BRANCH_STAGES).forEach((t) => D.BRANCH_STAGES[t].slice(1, -1).forEach((s) => mids.push({ t, s, c: cnt(t, s), o: over(t, s) })));
    const worst = mids.slice().sort((a, b) => (b.o - a.o) || (b.c - a.c))[0];
    el.innerHTML = `<div class="page-h"><div><h2>Motion Workflow Chart</h2><div class="muted">Live counts from all ${total} production records · click any stage to open its tasks</div></div><div class="row-gap"><div class="legend"><span><i style="background:#2E9E4F"></i>Completed</span><span><i style="background:#F4C430"></i>Active</span><span><i style="background:#C9CFD6"></i>Pending</span><span><i style="background:#D32F2F"></i>Overdue</span></div><button class="btn" data-bneck>Ask MAHI about bottlenecks</button></div></div>
      <div class="card flow-card"><svg class="flow" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin meet">${branchHeads}${edgeSvg}${nodeSvg}</svg></div>`;
    el.querySelectorAll('.fnode').forEach((g) => { const open = () => P.stageModal(g.dataset.label, g.dataset.node); g.onclick = open; g.onkeydown = (e) => { if (e.key === 'Enter') open(); }; });
    el.querySelector('[data-bneck]').onclick = () => {
      const name = S.state.settings.callName;
      if (!worst || (worst.c === 0 && worst.o === 0)) root.MAHI_CHAR.react({ kind: 'info', msg: `${name}, no bottlenecks right now.`, detail: done === total ? 'Everything is completed!' : `${bcpC} assets are still in planning – nothing is stuck mid-production.` });
      else root.MAHI_CHAR.react({ kind: 'bottleneck', msg: `${name}, the biggest bottleneck is "${worst.s}" in ${worst.t} production.`, detail: `${worst.c} task(s) waiting there${worst.o ? `, ${worst.o} overdue` : ''}.`, action: { label: 'Open those tasks', route: `production?type=${worst.t}&stage=${worst.s}` } });
    };
  };
  P.stageModal = (label, filter) => {
    const f = {}; filter.split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); f[k] = v; });
    let list = S.state.assets;
    if (f.stage && f.stage.includes(',')) { const ss = f.stage.split(','); list = list.filter((a) => ss.includes(a.__stage)); delete f.stage; }
    list = applyFilters(list, f);
    const rows = list.slice(0, 200).map((a) => `<tr><td><span class="link" data-edit="${a.id}">${a.id}</span></td><td>${UI.typeChip(a.type)}</td><td>${esc(a.brand)}</td><td>${UI.setLabel(a.set)}</td><td>${UI.statusChip(a.status)}</td><td>${UI.flagChip(a.__flag)}</td></tr>`).join('');
    UI.modal(`${label} · ${list.length} task(s)`, list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Type</th><th>Brand</th><th>Set</th><th>Status</th><th>Deadline</th></tr></thead><tbody>${rows}</tbody></table></div>${list.length > 200 ? '<p class="muted">Showing first 200.</p>' : ''}` : '<p class="muted">No tasks in this stage.</p>', [{ label: 'Close', value: null }], { wide: true, onOpen: (w, close) => w.addEventListener('click', (e) => { const id = e.target.dataset && e.target.dataset.edit; if (id) { close(null); UI.openEditor(id); } }) });
  };

  // ================= CAMPAIGNS =================
  P.campaigns = (el, params) => {
    const m = S.metrics(), t = m.today;
    el.innerHTML = `<div class="page-h"><div><h2>Festival Campaigns</h2><div class="muted">Confirmed festival production phase · 27 Nov 2026 → 12 Jan 2027</div></div><div class="row-gap"><label class="small">MAHI festival mode <select id="fmode">${UI.options([{ v: 'auto', l: 'Auto (by current set)' }, { v: 'default', l: 'Default' }, { v: 'christmas', l: 'Christmas' }, { v: 'newyear', l: 'New Year' }, { v: 'pongal', l: 'Pongal' }], S.state.settings.festivalMode)}</select></label></div></div>
      ${D.FESTIVALS.map((f) => {
        const x = m.byFestival[f.name], sets = D.SETS.filter((s) => s.festival === f.name), d = D.daysBetween(t, f.date);
        const types = D.CONTENT_TYPES.map((tp) => { const g = S.state.assets.filter((a) => a.festival === f.name && a.type === tp); const dn = g.filter(D.isDone).length; return `<div class="typerow"><span>${tp}s</span>${CH.progress(g.length ? dn / g.length : 0, UI.typeColor(tp))}<b>${dn}/${g.length}</b></div>`; }).join('');
        return `<section class="card camp ${params.f === f.name ? 'focus' : ''}" style="--c1:${f.colors[0]};--c2:${f.colors[1]}"><div class="camp-h"><div><h3>${f.name} Campaign</h3><div class="muted">Festival ${f.dateLabel} · Production ${UI.fmt(f.prodStart)} → ${UI.fmt(f.prodEnd)} · ${f.sets} set(s)</div></div><div class="camp-count">${d > 0 ? `<b>${d}</b> days to go` : d === 0 ? '<b>Today!</b>' : 'Festival passed'}</div>${CH.ring(x.pct, f.colors[0], 86)}</div>
        <div class="grid g-2"><div>${types}<div class="small muted">${x.done} completed · ${x.pending} pending · ${x.overdue} overdue · ${x.published} published</div></div>
        <div class="set-mini">${sets.map((s) => { const y = m.bySet[s.code]; return `<button class="set-chip ${s.compressed ? 'comp' : ''}" data-route="sets?set=${s.code}"><b>${s.label}</b><span>${UI.fmt(s.start)} → ${UI.fmt(s.end)}</span>${CH.progress(y.pct, f.colors[0])}<span>${y.done}/${y.target}${s.compressed ? ' · ⚠ compressed' : ''}</span></button>`; }).join('')}</div></div></section>`;
      }).join('')}`;
    el.querySelector('#fmode').onchange = (e) => S.setSettings({ festivalMode: e.target.value });
  };

  // ================= SETS =================
  P.sets = (el, params) => {
    const m = S.metrics(); const cur = m.current;
    const sel = params.set || (cur ? cur.code : 'S01');
    const s = D.setByCode(sel) || D.SETS[0];
    const w = S.state.settings.pubWindows[s.code];
    const rows = D.BRANDS.map((b, i) => {
      const g = S.state.assets.filter((a) => a.set === s.code && a.brand === b.name);
      const c = (t) => g.filter((a) => a.type === t), dn = (l) => l.filter(D.isDone).length;
      const P1 = c('Poster'), A1 = c('AI Video'), V1 = c('VJ Video');
      const tot = g.length, done = dn(g), pubd = g.filter((a) => a.pubStatus === 'Published').length;
      const over = g.some((a) => a.__flag === 'OVERDUE');
      const status = done === tot ? 'Completed' : over ? 'Overdue' : done > 0 ? 'In Progress' : 'Not Started';
      return `<tr data-route="production?set=${s.code}&brand=${encodeURIComponent(b.name)}"><td>${i + 1}</td><td><b>${esc(b.name)}</b></td><td>${s.festival}</td><td>${P1.length}</td><td>${dn(P1)}</td><td>${P1.length - dn(P1)}</td><td>${A1.length}</td><td>${dn(A1)}</td><td>${A1.length - dn(A1)}</td><td>${V1.length}</td><td>${V1.length ? esc(UI.vjName(b.vjMember)) : '—'}</td><td>${dn(V1)}</td><td>${V1.length - dn(V1)}</td><td>${tot}</td><td>${done}</td><td>${tot - done}</td><td>${CH.progress(tot ? done / tot : 0, '#2E9E4F', UI.pct(tot ? done / tot : 0))}</td><td>${UI.fmt(s.start)}</td><td>${UI.fmt(s.end)}</td><td>${pubd}/${tot} published</td><td>${status === 'Overdue' ? UI.flagChip('OVERDUE') : UI.statusChip(status)}</td></tr>`;
    }).join('');
    const x = m.bySet[s.code];
    el.innerHTML = `<div class="page-h"><div><h2>All Production Sets</h2><div class="muted">One set = one complete week of social media publishing · production and publishing dates are separate</div></div></div>
      <div class="set-grid">${D.SETS.map((z) => { const y = m.bySet[z.code]; return `<button class="set-card ${z.code === s.code ? 'on' : ''} ${z.compressed ? 'comp' : ''}" data-route="sets?set=${z.code}" style="--c:${UI.festColor(z.festival)}"><b>${z.label}</b><span>${z.festival}</span><span class="small">${UI.fmt(z.start)} → ${UI.fmt(z.end)}</span>${CH.progress(y.pct, UI.festColor(z.festival))}<span class="small">${y.done}/${y.target}${z.compressed ? ' · ⚠ compressed' : ''}${y.overdue ? ` · <b class="bad-t">${y.overdue} overdue</b>` : ''}</span></button>`; }).join('')}</div>
      <section class="card"><div class="card-h"><h3>${s.label} – ${s.festival} ${s.compressed ? '<span class="chip warn">⚠ COMPRESSED SCHEDULE – prepare in advance</span>' : ''}</h3><div class="row-gap small"><span>Production <b>${UI.fmt(s.start)} → ${UI.fmt(s.end)}</b> (fixed)</span><span>Publishing window <input type="date" id="pw-s" value="${w.start}"> → <input type="date" id="pw-e" value="${w.end}"></span><button class="btn small" data-route="board?set=${s.code}">Open in board</button><button class="btn small ghost" id="bulk-set">Bulk update…</button></div></div>
      <div class="kpi-grid sm">${kpi('Target', x.target)}${kpi('Completed', x.done, UI.pct(x.pct), null, 'good')}${kpi('Pending', x.pending)}${kpi('Overdue', x.overdue, '', `production?set=${s.code}&flag=OVERDUE`, x.overdue ? 'bad' : '')}${kpi('Published', x.published)}</div>
      <div class="tbl-wrap"><table class="tbl set-tbl"><thead><tr><th>S.No</th><th>Brand</th><th>Festival</th><th>Poster Target</th><th>Poster Done</th><th>Poster Pending</th><th>AI Target</th><th>AI Done</th><th>AI Pending</th><th>VJ Target</th><th>Assigned VJ</th><th>VJ Done</th><th>VJ Pending</th><th>Total Target</th><th>Total Done</th><th>Total Pending</th><th>Completion</th><th>Production Start</th><th>Deadline</th><th>Publishing Status</th><th>Overall Status</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td></td><td>TOTAL</td><td></td><td>62</td><td colspan="9"></td><td>${x.target}</td><td>${x.done}</td><td>${x.pending}</td><td>${UI.pct(x.pct)}</td><td colspan="4"></td></tr></tfoot></table></div></section>`;
    const saveW = () => { const a = el.querySelector('#pw-s').value, b = el.querySelector('#pw-e').value; if (a && b && a <= b) { const pw = Object.assign({}, S.state.settings.pubWindows, { [s.code]: { start: a, end: b } }); S.setSettings({ pubWindows: pw }); UI.toast('Publishing window updated'); } else UI.toast('Start must be on or before end', 'bad'); };
    el.querySelector('#pw-s').onchange = saveW; el.querySelector('#pw-e').onchange = saveW;
    el.querySelector('#bulk-set').onclick = () => P.bulkDialog(S.state.assets.filter((a) => a.set === s.code), `${s.label}`);
  };
  P.bulkDialog = async (list, label) => {
    const v = await UI.modal(`Bulk update · ${label}`, `<p>Apply to assets in <b>${esc(label)}</b>:</p><label class="f"><span>Only these types</span><select id="bk-t">${UI.options(D.CONTENT_TYPES, '', 'All types')}</select></label><label class="f"><span>Only this brand</span><select id="bk-b">${UI.options(D.BRANDS.map((b) => b.name), '', 'All brands')}</select></label><label class="f"><span>Set production status to</span><select id="bk-s">${UI.options(D.PROD_STATUSES, '', '— no change —')}</select></label><label class="f"><span>Set priority to</span><select id="bk-p">${UI.options(D.PRIORITIES, '', '— no change —')}</select></label>`, [{ label: 'Apply', value: (w) => ({ t: w.querySelector('#bk-t').value, b: w.querySelector('#bk-b').value, s: w.querySelector('#bk-s').value, p: w.querySelector('#bk-p').value }) }, { label: 'Cancel', value: null }]);
    if (!v || (!v.s && !v.p)) return;
    const ids = list.filter((a) => (!v.t || a.type === v.t) && (!v.b || a.brand === v.b)).map((a) => a.id);
    const patch = {}; if (v.s) patch.status = v.s; if (v.p) patch.priority = v.p;
    if (await UI.confirm('Confirm bulk update', `Update <b>${ids.length}</b> asset(s)?`, 'Update')) { S.updateAssets(ids, patch); UI.toast(`${ids.length} assets updated`, 'ok'); }
  };

  // ================= BRANDS =================
  P.brands = (el) => {
    const m = S.metrics();
    const rows = D.BRANDS.map((b, i) => { const x = m.byBrand[b.name]; return `<tr><td>${i + 1}</td><td><b>${esc(b.name)}</b></td><td>${b.posters}</td><td>${b.ai}</td><td>${b.vj}</td><td>${b.posters + b.ai + b.vj}</td><td>${b.vjMember ? esc(UI.vjName(b.vjMember)) : '—'}</td>${D.SETS.map((s) => { const y = m.byBrandSet[s.code + '|' + b.name]; return `<td class="heat" style="--p:${y.pct}" data-route="production?set=${s.code}&brand=${encodeURIComponent(b.name)}" title="${s.label}: ${y.done}/${y.target}">${y.done}/${y.target}</td>`; }).join('')}<td>${x.done}/${x.target}</td><td>${CH.progress(x.pct, '#2E9E4F', UI.pct(x.pct))}</td></tr>`; }).join('');
    el.innerHTML = `<div class="page-h"><div><h2>Brand Management</h2><div class="muted">Confirmed baseline: 15 brands × 7 sets = 105 brand-set records · 88 deliverables per set</div></div></div>
      <section class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Brand</th><th>Posters/set</th><th>AI/set</th><th>VJ/set</th><th>Total/set</th><th>Assigned VJ</th>${D.SETS.map((s) => `<th>${s.label}</th>`).join('')}<th>All sets</th><th>Progress</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td></td><td>TOTAL</td><td>62</td><td>14</td><td>12</td><td>88</td><td></td>${D.SETS.map((s) => `<td>${m.bySet[s.code].done}/${m.bySet[s.code].target}</td>`).join('')}<td>${m.done}/${m.total}</td><td></td></tr></tfoot></table></div></section>
      ${card('Brand-wise production comparison', CH.hbars(D.BRANDS.map((b) => ({ label: b.name, values: [m.byBrand[b.name].done, m.byBrand[b.name].pending], click: 'production?brand=' + encodeURIComponent(b.name) })), [{ name: 'Completed', color: '#2E9E4F' }, { name: 'Pending', color: '#C9CFD6' }]))}
      ${card('New brands (expansion – separate from the confirmed 616 baseline)', `<form id="nb" class="task-add"><input name="name" placeholder="Brand name" required><input name="services" placeholder="Services / content types"><input name="notes" placeholder="Notes"><button class="btn">Add brand</button></form><div class="tlist">${S.state.extraBrands.map((b) => `<div class="trow"><b>${esc(b.name)}</b><span class="muted small">${esc(b.services)} ${esc(b.notes)}</span><span class="muted small">added ${UI.fmt(b.added)}</span><button class="icon-btn" data-delb="${b.id}" aria-label="Delete">🗑</button></div>`).join('') || '<p class="muted">No extra brands yet. Plan their targets in Annual Workflow.</p>'}</div>`)}`;
    el.querySelector('#nb').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); S.addExtraBrand({ name: f.get('name'), services: f.get('services'), notes: f.get('notes') }); UI.toast('Brand added'); };
    el.querySelectorAll('[data-delb]').forEach((b) => b.onclick = async () => { if (await UI.confirm('Delete brand', 'Remove this expansion brand?', 'Delete', true)) S.deleteExtraBrand(b.dataset.delb); });
  };

  // ================= PRODUCTION TABLES =================
  const tableF = {};
  function assetTable(el, key, base, title, sub, preset, params) {
    const f = tableF[key] = tableF[key] || {};
    if (params && !f._p) { Object.assign(f, params); f._p = 1; }
    S.metrics();
    const list = applyFilters(base, f);
    const pageSize = 50, page = Math.min(f.page || 0, Math.max(0, Math.ceil(list.length / pageSize) - 1));
    const rows = list.slice(page * pageSize, page * pageSize + pageSize);
    f._sel = f._sel || {};
    const selCount = Object.keys(f._sel).filter((k) => f._sel[k]).length;
    el.innerHTML = `<div class="page-h"><div><h2>${title}</h2><div class="muted">${sub}</div></div>${preset.stats || ''}</div>
      ${filterBar(f, preset.filters, null, key)}
      ${preset.extraFilter || ''}
      <div class="bulkbar ${selCount ? 'on' : ''}"><span>${selCount} selected</span><select id="${key}-bs">${UI.options(D.PROD_STATUSES, '', 'Set status…')}</select><select id="${key}-bp">${UI.options(D.PUB_STATUSES, '', 'Set publishing…')}</select><button class="btn small" id="${key}-ba">Apply</button><button class="btn small ghost" id="${key}-bc">Clear</button></div>
      <section class="card"><div class="tbl-wrap"><table class="tbl assets"><thead><tr><th><input type="checkbox" id="${key}-all" aria-label="Select page"></th><th>Content ID</th><th>Brand</th><th>Set</th>${preset.showType ? '<th>Type</th>' : ''}${preset.showVJ ? '<th>VJ</th>' : ''}<th>Topic</th><th>Stage</th><th>Production Status</th><th>Deadline</th><th>Flag</th><th>Publishing</th><th></th></tr></thead><tbody>
      ${rows.map((a) => `<tr><td><input type="checkbox" data-sel="${a.id}" ${f._sel[a.id] ? 'checked' : ''} aria-label="Select ${a.id}"></td><td><span class="link" data-edit="${a.id}">${a.id}</span></td><td>${esc(a.brand)}</td><td>${UI.setLabel(a.set)}</td>${preset.showType ? `<td>${UI.typeChip(a.type)}</td>` : ''}${preset.showVJ ? `<td>${a.vj ? esc(UI.vjName(a.vj)) : '—'}</td>` : ''}<td class="clip">${esc(a.topic) || '<span class="muted">—</span>'}</td><td class="small">${esc(a.__stage)}</td><td><select class="st-sel" data-st="${a.id}" style="--c:${D.STATUS_COLORS[a.status]}">${UI.options(D.PROD_STATUSES, a.status)}</select></td><td>${UI.fmt(a.deadline)}</td><td>${UI.flagChip(a.__flag)}</td><td><select class="st-sel" data-pub="${a.id}" style="--c:${D.STATUS_COLORS[a.pubStatus]}">${UI.options(D.PUB_STATUSES, a.pubStatus)}</select></td><td><button class="icon-btn" data-edit="${a.id}" aria-label="Edit ${a.id}">✎</button></td></tr>`).join('') || `<tr><td colspan="12" class="muted">No assets match these filters.</td></tr>`}
      </tbody></table></div>
      <div class="pager"><span>${list.length} asset(s) · page ${page + 1} of ${Math.max(1, Math.ceil(list.length / pageSize))}</span><button class="btn small ghost" data-pg="-1" ${page === 0 ? 'disabled' : ''}>◀ Prev</button><button class="btn small ghost" data-pg="1" ${(page + 1) * pageSize >= list.length ? 'disabled' : ''}>Next ▶</button></div></section>`;
    const re = () => assetTable(el, key, base, title, sub, preset);
    bindFilters(el, f, re, key);
    el.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => { f.page = page + Number(b.dataset.pg); re(); });
    el.querySelectorAll('[data-st]').forEach((s) => s.onchange = async () => { if (!(await UI.changeAssets([s.dataset.st], { status: s.value }))) re(); });
    el.querySelectorAll('[data-pub]').forEach((s) => s.onchange = async () => { if (!(await UI.changeAssets([s.dataset.pub], { pubStatus: s.value }))) re(); });
    el.querySelectorAll('[data-sel]').forEach((c) => c.onchange = () => { f._sel[c.dataset.sel] = c.checked; re(); });
    el.querySelector(`#${key}-all`).onchange = (e) => { rows.forEach((a) => { f._sel[a.id] = e.target.checked; }); re(); };
    el.querySelector(`#${key}-bc`).onclick = () => { f._sel = {}; re(); };
    el.querySelector(`#${key}-ba`).onclick = async () => {
      const ids = Object.keys(f._sel).filter((k) => f._sel[k]); const st = el.querySelector(`#${key}-bs`).value, pb = el.querySelector(`#${key}-bp`).value;
      if (!ids.length || (!st && !pb)) return UI.toast('Select assets and a status first');
      const patch = {}; if (st) patch.status = st; if (pb) patch.pubStatus = pb;
      if (await UI.changeAssets(ids, patch)) { f._sel = {}; UI.toast(`${ids.length} assets updated`, 'ok'); }
    };
  }
  P.assetTable = assetTable;

  P.production = (el, params) => {
    const key = JSON.stringify(params || {});
    if (P._prodKey !== key) { P._prodKey = key; tableF.production = Object.assign({}, params, { _p: 1 }); } // a new link resets the view
    assetTable(el, 'production', S.state.assets, 'All Production Records', `${S.state.assets.length} unique assets · filtered view`, { filters: ['q', 'festival', 'set', 'brand', 'type', 'vj', 'priority', 'flag', 'status', 'pubStatus'], showType: true, showVJ: true });
  };
  P.posters = (el) => {
    const g = S.state.assets.filter((a) => a.type === 'Poster'); const d = g.filter(D.isDone).length;
    assetTable(el, 'posters', g, 'Poster Production', `${g.length} poster assignments · ${d} completed · ${g.length - d} pending`, { filters: ['q', 'festival', 'set', 'brand', 'priority', 'flag', 'status', 'pubStatus'], stats: `<div class="row-gap">${CH.ring(g.length ? d / g.length : 0, '#2E9E4F', 64)}</div>` });
  };
  P.ai = (el) => {
    const g = S.state.assets.filter((a) => a.type === 'AI Video'); const d = g.filter(D.isDone).length;
    assetTable(el, 'ai', g, 'AI Video Production', `${g.length} AI video assignments · ${d} completed · ${g.length - d} pending`, { filters: ['q', 'festival', 'set', 'brand', 'priority', 'flag', 'status', 'pubStatus'], stats: `<div class="row-gap">${CH.ring(g.length ? d / g.length : 0, '#1E6FD9', 64)}</div>` });
  };
  // ================= VJ TRACKERS =================
  [1, 2, 3].forEach((n) => {
    P['vj' + n] = (el) => {
      const id = D.VJ_IDS[n - 1], v = S.state.settings.vjs[n - 1];
      const g = S.state.assets.filter((a) => a.vj === id); S.metrics();
      const c = (fn) => g.filter(fn).length;
      const done = c(D.isDone);
      const stats = [['Assigned videos', g.length], ['Completed scripts', c((a) => a.scriptStatus === 'Completed')], ['Completed shoots', c((a) => a.shootStatus === 'Completed')], ['Completed edits', c((a) => a.editStatus === 'Completed')], ['Approved videos', c((a) => a.finalApproval === 'Approved' || D.isDone(a))], ['Published videos', c((a) => a.pubStatus === 'Published')], ['Pending assignments', g.length - done], ['Overdue assignments', c((a) => a.__flag === 'OVERDUE')], ['Completion', UI.pct(g.length ? done / g.length : 0)]];
      const head = `<div class="vj-head">${UI.avatar(v.pic, v.name, 'lg')}<div><h3>${esc(v.name)} <span class="muted small">${id}</span></h3><div class="muted small">${D.BRANDS.filter((b) => b.vjMember === id).map((b) => b.name).join(' · ')} · 4 videos per set · Christmas 16 · New Year 4 · Pongal 8</div></div>${CH.ring(g.length ? done / g.length : 0, '#7E57C2', 70)}</div><div class="kpi-grid sm">${stats.map(([l, x]) => kpi(l, x, '', null, l.startsWith('Overdue') && x ? 'bad' : '')).join('')}</div>`;
      assetTable(el, 'vj' + n, g, `${id} Tracker`, `Rename ${id} in Settings – every record, report and chart updates automatically.`, { filters: ['q', 'festival', 'set', 'brand', 'flag', 'status', 'pubStatus'], extraFilter: head });
    };
  });

  root.MAHI_PAGES = P;
})(window);
